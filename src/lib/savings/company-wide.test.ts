import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { companyWideBlocker, companyWideMissing } from "./company-wide";

const holding =
  (...held: string[]) =>
  (p: string) =>
    held.includes(p);

test("changing company-wide savings set-up needs savings:settings and access to all branches, as the backend's AuthorizesCompanyWideSavings does", () => {
  assert.equal(companyWideMissing(holding("savings:settings", "branches:view_all")), null);
  assert.equal(companyWideMissing(holding("savings:settings", "savings:view")), "branches:view_all");
  assert.equal(companyWideMissing(holding("savings:view", "branches:view_all")), "savings:settings");
  assert.equal(companyWideMissing(holding()), "savings:settings");
});

test("each screen gives the reason in words: the settings, tax rules, and products with their rates", () => {
  const settingsOnly = holding("savings:settings", "savings:view");
  const viewOnly = holding("savings:view", "branches:view_all");
  assert.equal(
    companyWideBlocker(settingsOnly, "settings"),
    "The savings settings apply to every branch, so changing them needs access to all branches.",
  );
  assert.equal(companyWideBlocker(viewOnly, "settings"), "Changing the savings settings needs the Savings configure permission.");
  assert.equal(
    companyWideBlocker(settingsOnly, "tax_rules"),
    "Tax rules apply to every branch, so changing them needs access to all branches.",
  );
  assert.equal(companyWideBlocker(viewOnly, "tax_rules"), "Adding a tax rule needs the Savings configure permission.");
  assert.equal(
    companyWideBlocker(settingsOnly, "products"),
    "Savings products and their rates apply to every branch, so changing them needs access to all branches.",
  );
  assert.equal(
    companyWideBlocker(viewOnly, "products"),
    "Changing savings products and their rates needs the Savings configure permission.",
  );
  for (const what of ["settings", "tax_rules", "products"] as const) {
    assert.equal(companyWideBlocker(holding("savings:settings", "branches:view_all"), what), null, what);
  }
});

// The screens that change company-wide savings set-up, where they are and
// where #650 moves them (Settings → Savings, Settings → Savings Products).
const SCREENS = [
  "src/app/(app)/savings/settings",
  "src/app/(app)/savings/products",
  "src/app/(app)/settings/savings",
  "src/app/(app)/settings/savings-products",
].map((dir) => join(process.cwd(), dir));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

function attribute(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find(
    (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText() === name,
  );
}

function stringValue(attr: ts.JsxAttribute | undefined): string | null {
  const init = attr?.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) return init.expression.text;
  return null;
}

/** Lines of a savings:settings button that doesn't give the company-wide reason (an ActionButton with blockedReason). */
function writesWithoutReason(source: string, fileName = "file.tsx"): number[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(file);
      const gated = (tag === "PermissionButton" || tag === "ActionButton") && stringValue(attribute(node, "permission")) === "savings:settings";
      if (gated && (tag !== "ActionButton" || !attribute(node, "blockedReason"))) {
        lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

test("the guard flags a savings:settings button that doesn't give the company-wide reason", () => {
  const source = `
    const a = <PermissionButton permission="savings:settings" onClick={add}>Add</PermissionButton>;
    const b = <ActionButton permission={"savings:settings"} onClick={add}>Add</ActionButton>;
    const c = <ActionButton permission="savings:settings" blockedReason={blocker} onClick={add}>Add</ActionButton>;
    const d = <PermissionButton permission="savings:view" onClick={open}>Open</PermissionButton>;
  `;
  assert.deepEqual(writesWithoutReason(source), [2, 3]);
});

test("every change on the savings settings and products screens gives the company-wide reason", () => {
  const roots = SCREENS.filter((dir) => existsSync(dir));
  assert.ok(roots.length > 0, "the savings settings and products screens are found");
  const offenders = roots
    .flatMap(tsxFiles)
    .flatMap((path) =>
      writesWithoutReason(readFileSync(path, "utf8"), path).map((line) => `${relative(process.cwd(), path)}:${line}`),
    );
  assert.deepEqual(
    offenders,
    [],
    `Use ActionButton with blockedReason={companyWideBlocker(…)} for these:\n${offenders.join("\n")}`,
  );
});
