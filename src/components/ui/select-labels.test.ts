import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

// A Base UI Select shows its stored value in the trigger ("drivers_license",
// "all", "1-30") unless it gets `items`, or <SelectValue> is given what to
// show: a render function, or a label the component already worked out. This
// guard fails on any dropdown that has none of these.

const ROOT = resolve(process.cwd(), "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function hasAttribute(node: ts.JsxOpeningLikeElement, name: string): boolean {
  return node.attributes.properties.some(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText() === name,
  );
}

// True when a <SelectValue> below `root` is told what to show: a render
// function such as {(value) => LABELS[value]}, or a label such as {statusLabel}.
function hasRenderedValue(root: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(node) && tagName(node.openingElement) === "SelectValue") {
      found = node.children.some((child) => ts.isJsxExpression(child) && !!child.expression);
      if (found) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

// Comments are not part of the syntax tree, so a `<Select items>` mentioned in
// a comment is never counted as a dropdown.
function unlabelledSelects(source: string, fileName = "file.tsx"): number[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (opening && tagName(opening) === "Select") {
      if (!hasAttribute(opening, "items") && !hasRenderedValue(node)) {
        lines.push(file.getLineAndCharacterOfPosition(opening.getStart(file)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

test("the guard flags a Select without items or a rendered value", () => {
  const raw = `const a = (
    <Select value={v}>
      <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
    </Select>
  );
  const b = (
    <Select value={v}>
      <SelectValue>{/* the value */}</SelectValue>
    </Select>
  );`;
  assert.deepEqual(unlabelledSelects(raw), [2, 7]);
});

test("the guard accepts items, a render function, a label, and ignores comments", () => {
  const ok = `
    // Passed to <Select items>: a comment, not a dropdown.
    /* <Select value={x}></Select> */
    const a = <Select items={OPTIONS} value={v}><SelectValue /></Select>;
    const b = (
      <Select value={v}>
        <SelectTrigger>
          <SelectValue>{(value: string) => LABELS[value]}</SelectValue>
        </SelectTrigger>
      </Select>
    );
    const c = (
      <Select value={v}>
        <SelectValue placeholder="Pick">{relationshipLabel}</SelectValue>
      </Select>
    );
    const d = <div>{/* <Select value={y}> */}</div>;
  `;
  assert.deepEqual(unlabelledSelects(ok), []);
});

test("every Base UI Select under src/ shows its label", () => {
  const offenders = tsxFiles(ROOT).flatMap((path) =>
    unlabelledSelects(readFileSync(path, "utf8"), path).map(
      (line) => `${relative(process.cwd(), path)}:${line}`,
    ),
  );
  assert.deepEqual(offenders, [], `Give these Selects \`items\` or a render function in <SelectValue>:\n${offenders.join("\n")}`);
});
