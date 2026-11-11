/**
 * A formula fee's expression, e.g. `(Principal Amount * 2.5%) / 365`.
 *
 * Parsed by hand into a tree and walked; nothing is ever passed to `eval` or
 * `Function`, so an administrator's text can only ever be arithmetic. The
 * server evaluates the same grammar against the loan at release and is the
 * authority on the amount; this module checks the text before it is saved and
 * previews it against a sample loan.
 *
 * Grammar (usual precedence, left to right):
 *   expr    := term (("+" | "-") term)*
 *   term    := unary (("*" | "/") unary)*
 *   unary   := "-" unary | postfix
 *   postfix := primary "%"?          // "2.5%" is 0.025, "Interest Rate%" is the rate / 100
 *   primary := number | variable | "(" expr ")"
 * Variable names are case-insensitive; "×" and "÷" are read as "*" and "/".
 */

export type FeeFormulaVariableKey = "principal_amount" | "loan_amount" | "interest_rate" | "loan_term";

export interface FeeFormulaVariable {
  key: FeeFormulaVariableKey;
  label: string;
  hint: string;
  /** The value the Settings preview uses. Never used to charge a loan. */
  sample: number;
}

export const FEE_FORMULA_VARIABLES: readonly FeeFormulaVariable[] = [
  { key: "principal_amount", label: "Principal Amount", hint: "the principal released, in pesos", sample: 100_000 },
  { key: "loan_amount", label: "Loan Amount", hint: "the loan amount applied for, in pesos", sample: 100_000 },
  { key: "interest_rate", label: "Interest Rate", hint: "the loan's rate as a percent, so 3 means 3% (write Interest Rate% for 0.03)", sample: 3 },
  { key: "loan_term", label: "Loan Term", hint: "the term in months", sample: 12 },
];

export const FEE_FORMULA_MAX_LENGTH = 255;

export type FeeFormulaValues = Record<FeeFormulaVariableKey, number>;

export const SAMPLE_FORMULA_VALUES: FeeFormulaValues = Object.fromEntries(
  FEE_FORMULA_VARIABLES.map((v) => [v.key, v.sample]),
) as FeeFormulaValues;

type Node =
  | { kind: "num"; value: number }
  | { kind: "var"; key: FeeFormulaVariableKey }
  | { kind: "neg"; operand: Node }
  | { kind: "pct"; operand: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node };

type Token =
  | { kind: "num"; text: string }
  | { kind: "var"; key: FeeFormulaVariableKey }
  | { kind: "op"; op: "+" | "-" | "*" | "/" | "%" | "(" | ")" };

class FormulaError extends Error {}

const VARIABLE_BY_NAME = new Map(
  FEE_FORMULA_VARIABLES.flatMap((v) => [[v.label.toLowerCase(), v.key], [v.key.replace(/_/g, " "), v.key]] as const),
);
const LABEL_BY_KEY = new Map(FEE_FORMULA_VARIABLES.map((v) => [v.key, v.label]));
const VARIABLE_LIST = FEE_FORMULA_VARIABLES.map((v) => v.label).join(", ");

const OPERATOR_ALIASES: Record<string, "+" | "-" | "*" | "/" | "%" | "(" | ")"> = {
  "+": "+", "-": "-", "−": "-", "*": "*", "×": "*", "/": "/", "÷": "/", "%": "%", "(": "(", ")": ")",
};

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    const number = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(i));
    if (number) {
      tokens.push({ kind: "num", text: number[0] });
      i += number[0].length;
      continue;
    }
    // A variable name is words separated by spaces or underscores.
    const word = /^[A-Za-z_][A-Za-z_ ]*/.exec(text.slice(i));
    if (word) {
      const name = word[0].replace(/_/g, " ").replace(/\s+/g, " ").trim();
      const key = VARIABLE_BY_NAME.get(name.toLowerCase());
      if (!key) throw new FormulaError(`"${name}" is not a variable you can use. Use ${VARIABLE_LIST}.`);
      tokens.push({ kind: "var", key });
      i += word[0].length;
      continue;
    }
    const op = OPERATOR_ALIASES[ch];
    if (!op) throw new FormulaError(`"${ch}" is not allowed. Use numbers, variables, + - * / % and brackets.`);
    tokens.push({ kind: "op", op });
    i++;
  }
  return tokens;
}

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peekOp = () => {
    const t = tokens[pos];
    return t?.kind === "op" ? t.op : null;
  };

  function expr(): Node {
    let node = term();
    for (let op = peekOp(); op === "+" || op === "-"; op = peekOp()) {
      pos++;
      node = { kind: "bin", op, left: node, right: term() };
    }
    return node;
  }
  function term(): Node {
    let node = unary();
    for (let op = peekOp(); op === "*" || op === "/"; op = peekOp()) {
      pos++;
      node = { kind: "bin", op, left: node, right: unary() };
    }
    return node;
  }
  function unary(): Node {
    if (peekOp() === "-") {
      pos++;
      return { kind: "neg", operand: unary() };
    }
    const node = primary();
    if (peekOp() === "%") {
      pos++;
      return { kind: "pct", operand: node };
    }
    return node;
  }
  function primary(): Node {
    const t = tokens[pos];
    if (!t) throw new FormulaError("The formula ends too early. Is a number or variable missing after the last operator?");
    if (t.kind === "num") { pos++; return { kind: "num", value: Number(t.text) }; }
    if (t.kind === "var") { pos++; return { kind: "var", key: t.key }; }
    if (t.op === "(") {
      pos++;
      const inner = expr();
      if (peekOp() !== ")") throw new FormulaError("A bracket is opened but never closed.");
      pos++;
      return inner;
    }
    if (t.op === ")") throw new FormulaError("A closing bracket has nothing before it, or has no opening bracket.");
    throw new FormulaError(`"${t.op}" needs a number or variable before it.`);
  }

  const tree = expr();
  if (pos < tokens.length) {
    const t = tokens[pos];
    if (t.kind === "op" && t.op === ")") throw new FormulaError("There is a closing bracket without an opening one.");
    throw new FormulaError("Two values sit side by side. Put an operator (+ - * /) between them.");
  }
  return tree;
}

function evaluate(node: Node, values: FeeFormulaValues): number {
  switch (node.kind) {
    case "num": return node.value;
    case "var": return values[node.key];
    case "neg": return -evaluate(node.operand, values);
    case "pct": return evaluate(node.operand, values) / 100;
    case "bin": {
      const left = evaluate(node.left, values);
      const right = evaluate(node.right, values);
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      if (right === 0) throw new FormulaError("The formula divides by zero.");
      return left / right;
    }
  }
}

/** The tokens written back out with canonical variable names and spacing. */
function normalize(tokens: Token[]): string {
  let out = "";
  let prev: Token | null = null;
  for (const t of tokens) {
    if (t.kind === "num") out += t.text;
    else if (t.kind === "var") out += LABEL_BY_KEY.get(t.key);
    else if (t.op === "(" || t.op === ")" || t.op === "%") out += t.op;
    else if (t.op === "-" && (prev === null || (prev.kind === "op" && prev.op !== ")" && prev.op !== "%"))) out += "-";
    else out += ` ${t.op} `;
    prev = t;
  }
  return out.replace(/\s+/g, " ").trim();
}

function collectVariables(node: Node, into: Set<FeeFormulaVariableKey>): Set<FeeFormulaVariableKey> {
  if (node.kind === "var") into.add(node.key);
  else if (node.kind === "neg" || node.kind === "pct") collectVariables(node.operand, into);
  else if (node.kind === "bin") { collectVariables(node.left, into); collectVariables(node.right, into); }
  return into;
}

/** Pesos to two places, half away from zero, as the server rounds a fee. */
export function roundPesos(amount: number): number {
  return Math.sign(amount) * Math.round(Math.abs(amount) * 100 + 1e-9) / 100;
}

export type FeeFormulaCheck =
  | { ok: true; expression: string; variables: FeeFormulaVariableKey[]; raw: number; amount: number }
  | { ok: false; error: string };

/**
 * Check a formula and work it out for `values` (the sample loan by default).
 * `expression` is the text to save: same meaning, canonical names and spacing.
 */
export function checkFeeFormula(text: string, values: FeeFormulaValues = SAMPLE_FORMULA_VALUES): FeeFormulaCheck {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Enter a fee formula." };
  if (trimmed.length > FEE_FORMULA_MAX_LENGTH) {
    return { ok: false, error: `Keep the formula to ${FEE_FORMULA_MAX_LENGTH} characters or fewer.` };
  }
  try {
    const tokens = tokenize(trimmed);
    const tree = parse(tokens);
    const raw = evaluate(tree, values);
    if (!Number.isFinite(raw)) return { ok: false, error: "The formula does not work out to a number." };
    if (raw < 0) return { ok: false, error: "The formula works out to a negative fee for the sample loan." };
    return {
      ok: true,
      expression: normalize(tokens),
      variables: [...collectVariables(tree, new Set())],
      raw,
      amount: roundPesos(raw),
    };
  } catch (err) {
    if (err instanceof FormulaError) return { ok: false, error: err.message };
    throw err;
  }
}

/**
 * The loan figures a charged formula used, as a release line shows them:
 * "Principal Amount ₱100,000.00 · Loan Term 12 months". Unknown keys are
 * skipped; a figure the server sent as a string is read as a number.
 */
export function describeFormulaInputs(
  inputs: Record<string, number | string> | null | undefined,
  money: (amount: number) => string,
): string {
  if (!inputs) return "";
  return FEE_FORMULA_VARIABLES
    .filter((v) => inputs[v.key] != null && Number.isFinite(Number(inputs[v.key])))
    .map((v) => {
      const n = Number(inputs[v.key]);
      if (v.key === "interest_rate") return `${v.label} ${n}%`;
      if (v.key === "loan_term") return `${v.label} ${n} ${n === 1 ? "month" : "months"}`;
      return `${v.label} ${money(n)}`;
    })
    .join(" · ");
}
