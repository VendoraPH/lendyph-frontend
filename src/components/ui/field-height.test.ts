import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

// Every field is 32 px tall (h-8, the shared default), so fields side by side
// line up. A page that gives one field its own height (h-9, h-10) leaves its
// row uneven, and on a SelectTrigger such a height doesn't even apply: the
// trigger's own data-[size=default]:h-8 wins. A compact field uses the
// component's `size="sm"` instead. This guard fails on a field, or an element
// drawn as one (border-input), whose fixed height isn't h-8.

const ROOT = resolve(process.cwd(), "src");

const FIELDS = new Set([
  "Input",
  "PasswordInput",
  "NativeSelect",
  "SelectTrigger",
  "InputGroup",
  "ComboboxInput",
  "SearchPicker",
  "MemberSearchPicker",
  "LoanSearchPicker",
  "StaffPicker",
  "SubjectPicker",
  "BranchSelectField",
  "BranchFilter",
  "OptionSelect",
  "AccountSelect",
  "SearchInput",
  "TextField",
  "MoneyField",
  "SelectField",
]);

// src/components/ui defines the heights. The sign-in pages keep theirs: they
// stay exactly as they are (product decision, 2026-11-17).
const SKIPPED = [join("components", "ui"), join("app", "(auth)"), join("app", "member", "(auth)")];

// The data template's column header title is edited in place: a borderless
// h-7 field inside the table heading, sized to the heading's h-7 controls.
const ALLOWED = new Set([
  join("app", "(app)", "printables", "data-template", "_components", "column-header-cell.tsx"),
]);

const FIXED_HEIGHT = /^(?:[^:\s]+:)*h-(?:\d+(?:\.\d+)?|\[[^\]]+\])$/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : tsxFiles(path);
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

// The class names written in a className attribute: string literals, template
// text, and the strings handed to cn(...).
function classNames(attribute: ts.JsxAttribute): string[] {
  const texts: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      texts.push(node.head.text);
      for (const span of node.templateSpans) {
        visit(span.expression);
        texts.push(span.literal.text);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  if (attribute.initializer) visit(attribute.initializer);
  return texts.join(" ").split(/\s+/).filter(Boolean);
}

function unevenFields(source: string, fileName = "file.tsx"): number[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attribute = node.attributes.properties.find(
        (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText() === "className",
      );
      const classes = attribute ? classNames(attribute) : [];
      const isField = FIELDS.has(node.tagName.getText()) || classes.includes("border-input");
      if (isField && classes.some((name) => FIXED_HEIGHT.test(name) && name !== "h-8")) {
        lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

test("the guard flags a field, or an element drawn as one, taller or shorter than h-8", () => {
  const raw = `const a = (
    <div>
      <Input className="pl-9 h-9" />
      <SelectTrigger className="h-10 w-full" />
      <MemberSearchPicker value={m} className={cn("h-10", wide && "w-full")} />
      <button className="flex h-9 items-center rounded-lg border border-input px-3" />
      <Input className="sm:h-11" />
    </div>
  );`;
  assert.deepEqual(unevenFields(raw), [3, 4, 5, 6, 7]);
});

test("the guard accepts the default height, h-8, sizes, and other elements", () => {
  const ok = `const a = (
    <div className="h-9">
      <Input className="pl-9" />
      <Input className="h-8 w-40" />
      <SelectTrigger size="sm" className="w-28" />
      <button className="flex h-8 items-center rounded-lg border border-input px-3" />
      <Button className="h-10">Big call to action</Button>
      <Textarea className="min-h-24" />
      <Input className="h-full" />
    </div>
  );`;
  assert.deepEqual(unevenFields(ok), []);
});

test("every field under src/ keeps the shared height", () => {
  const offenders = tsxFiles(ROOT)
    .filter((path) => {
      const inSrc = relative(ROOT, path);
      return !SKIPPED.some((dir) => inSrc.startsWith(dir)) && !ALLOWED.has(inSrc);
    })
    .flatMap((path) =>
      unevenFields(readFileSync(path, "utf8"), path).map((line) => `${relative(process.cwd(), path)}:${line}`),
    );
  assert.deepEqual(offenders, [], `Drop these fields' own heights (fields are h-8; use size="sm" for a compact one):\n${offenders.join("\n")}`);
});
