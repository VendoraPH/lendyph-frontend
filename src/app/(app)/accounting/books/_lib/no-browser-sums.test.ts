import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

// Every figure in the books is the server's. This walks the code of every
// file under books/ and fails on anything that could add amounts up.

const root = join(process.cwd(), "src/app/(app)/accounting/books");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const ADDING = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.MinusEqualsToken,
]);
const SUMMING_NAMES = new Set(["reduce", "reduceRight", "sumCentavos"]);

function findings(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const at = (node: ts.Node) =>
    `${relative(root, path)}:${file.getLineAndCharacterOfPosition(node.getStart()).line}`;

  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && ADDING.has(node.operatorToken.kind)) {
      found.push(`${at(node)} ${node.getText()}`);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      found.push(`${at(node)} ${node.getText()}`);
    }
    if (ts.isIdentifier(node) && SUMMING_NAMES.has(node.text)) {
      found.push(`${at(node)} ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

test("the books screen has code to check", () => {
  const files = sourceFiles(root).map((path) => relative(root, path));
  assert.ok(files.includes("page.tsx"));
  assert.ok(files.includes(join("_components", "column-book.tsx")));
  assert.ok(files.includes(join("_lib", "column-book.ts")));
});

test("nothing under books/ adds, subtracts or reduces amounts", () => {
  assert.deepEqual(sourceFiles(root).flatMap(findings), []);
});
