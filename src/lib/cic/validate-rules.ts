// The Dependent (D) conditions of the CIC data format, as written in the
// workbook's rule text. Each rule looks at one record and says which D fields
// its condition makes required, which must be left empty, and any other
// inconsistency. A D field whose condition does not apply is never required.
import { cicDateKey, isCicEmpty } from "./format";
import type { CicRecordType, CicRecordValues, CicValidationContext } from "./types";

export interface RuleFinding {
  fieldId: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface RuleResult {
  /** D fields required by a condition, with the reason shown when one is missing. */
  required: Map<string, string>;
  /** Fields the condition says must be left empty, with the reason. */
  mustBeEmpty: Map<string, string>;
  findings: RuleFinding[];
}

type Ctx = Pick<CicValidationContext, "mfi">;

const id = (t: CicRecordType, n: number) => `${t}${n}`;

function makeResult(): RuleResult {
  return { required: new Map(), mustBeEmpty: new Map(), findings: [] };
}

function has(values: CicRecordValues, fieldId: string): boolean {
  return !isCicEmpty(values[fieldId]);
}

function text(values: CicRecordValues, fieldId: string): string {
  const v = values[fieldId];
  return isCicEmpty(v) ? "" : String(v).trim().toUpperCase();
}

// ---------------------------------------------------------------- addresses

/** Offsets within an address block: type, full, street, postal, subdivision, barangay, city, province, country. */
const ADDR = { type: 0, full: 1, street: 2, postal: 3, subdivision: 4, barangay: 5, city: 6, province: 7, country: 8 };

interface AddressBlock {
  label: string;
  base: number;
  /** The block must be reported even when nothing in it is filled. */
  required: (ctx: Ctx) => boolean;
  expectedType?: string;
}

const ADDRESS_BLOCKS: Partial<Record<CicRecordType, AddressBlock[]>> = {
  ID: [
    { label: "Address 1", base: 32, required: () => true, expectedType: "MI" },
    { label: "Address 2", base: 43, required: (ctx) => !ctx.mfi, expectedType: "AI" },
    { label: "Sole Trader address 1", base: 94, required: () => false },
    { label: "Sole Trader address 2", base: 105, required: () => false },
  ],
  BD: [
    { label: "Address 1", base: 20, required: () => true },
    { label: "Address 2", base: 31, required: () => false },
  ],
};

function addressRules(t: CicRecordType, values: CicRecordValues, ctx: Ctx, out: RuleResult) {
  for (const block of ADDRESS_BLOCKS[t] ?? []) {
    const f = (k: keyof typeof ADDR) => id(t, block.base + ADDR[k]);
    const splitKeys = ["street", "postal", "subdivision", "barangay", "city", "province", "country"] as const;
    const anySplit = splitKeys.some((k) => has(values, f(k)));
    const active = block.required(ctx) || anySplit || has(values, f("type")) || has(values, f("full"));
    if (!active) continue;

    const why = block.required(ctx)
      ? `${block.label} must be reported`
      : `part of ${block.label} is filled in`;
    out.required.set(f("type"), why);
    if (!has(values, f("full"))) {
      const unlessFull = `${why}, and no FullAddress is given`;
      out.required.set(f("city"), unlessFull);
      out.required.set(f("province"), unlessFull);
      out.required.set(ctx.mfi ? f("subdivision") : f("street"), unlessFull);
    } else if (anySplit) {
      out.findings.push({
        fieldId: f("full"),
        code: "FULL_ADDRESS_IGNORED",
        severity: "warning",
        message: `${block.label}: FullAddress and the separate address fields are both filled in; CIC ignores FullAddress.`,
      });
    }
    const type = text(values, f("type"));
    if (block.expectedType && type && type !== block.expectedType) {
      out.findings.push({
        fieldId: f("type"),
        code: "ADDRESS_TYPE_UNEXPECTED",
        severity: "warning",
        message: `${block.label} should be address type ${block.expectedType}, not ${type}.`,
      });
    }
  }
}

// -------------------------------------------------------------- pairs

/** Fields that must be both filled in or both left empty (type ↔ number / value). */
const PAIRS: Partial<Record<CicRecordType, [number, number][]>> = {
  ID: [[54, 55], [56, 57], [58, 59], [60, 61], [66, 67], [72, 73], [78, 79], [80, 81], [116, 117], [118, 119], [120, 121], [122, 123]],
  BD: [[42, 43], [44, 45], [46, 47], [48, 49]],
  CI: [[31, 32], [33, 34]],
  CC: [[30, 31]],
};

function pairRules(t: CicRecordType, values: CicRecordValues, out: RuleResult) {
  for (const [a, b] of PAIRS[t] ?? []) {
    const [ia, ib] = [id(t, a), id(t, b)];
    if (has(values, ia) && !has(values, ib)) out.required.set(ib, `${ia} is filled in`);
    if (has(values, ib) && !has(values, ia)) out.required.set(ia, `${ib} is filled in`);
  }
}

function subjectRules(t: CicRecordType, values: CicRecordValues, ctx: Ctx, out: RuleResult) {
  if (t !== "ID") return;
  if (![54, 56, 58].some((n) => has(values, id(t, n)))) {
    out.required.set("ID54", "at least one Identification (1, 2 or 3) must be reported");
  }
  if (!ctx.mfi && ![78, 80].some((n) => has(values, id(t, n)))) {
    out.required.set("ID78", "at least one Contact must be reported");
  }
}

// -------------------------------------------------------------- contracts

interface ContractLayout {
  phase: number;
  type: number;
  refDate: number;
  start: number;
  endPlanned: number;
  endActual: number;
  /** Required while the contract is Active, Closed or Closed in advance. */
  whenOpened: number[];
  /** Required while Active (and, for CI, before the planned end). */
  whenActive: number[];
  /** Must be empty once Closed / Closed in advance. */
  emptyWhenClosed: number[];
  /** Must be empty while Requested, Renounced or Refused. */
  emptyWhenNotGranted: number[];
  guaranteeBase: number;
  linkedBase: number;
}

const CONTRACTS: Partial<Record<CicRecordType, ContractLayout>> = {
  CI: {
    phase: 9, type: 8, refDate: 4, start: 13, endPlanned: 15, endActual: 16,
    whenOpened: [13, 15, 26, 28, 35], whenActive: [31, 32], emptyWhenClosed: [31, 32],
    emptyWhenNotGranted: [33, 34], guaranteeBase: 42, linkedBase: 126,
  },
  CN: {
    phase: 9, type: 8, refDate: 4, start: 13, endPlanned: 15, endActual: 16,
    whenOpened: [13, 15, 23], whenActive: [], emptyWhenClosed: [],
    emptyWhenNotGranted: [], guaranteeBase: 26, linkedBase: 110,
  },
  CC: {
    phase: 9, type: 8, refDate: 4, start: 13, endPlanned: 15, endActual: 16,
    whenOpened: [13, 27, 32], whenActive: [26], emptyWhenClosed: [26],
    emptyWhenNotGranted: [30, 31], guaranteeBase: 42, linkedBase: 126,
  },
};

const OPENED = new Set(["AC", "CL", "CA"]);
const CLOSED = new Set(["CL", "CA"]);
const NOT_GRANTED = new Set(["RQ", "RN", "RF"]);
const PHASE_LABEL: Record<string, string> = {
  RQ: "Requested", RN: "Renounced", RF: "Refused", AC: "Active", CL: "Closed", CA: "Closed in advance",
};
/** Credit card contract types (CC8) for which periodicity and installment type are mandatory. */
const CREDIT_CARD_TYPES = new Set(["31", "32", "33"]);

function contractRules(t: CicRecordType, values: CicRecordValues, out: RuleResult) {
  const c = CONTRACTS[t];
  if (!c) return;
  const f = (n: number) => id(t, n);
  const phase = text(values, f(c.phase));
  const phaseWhy = `the contract phase is ${PHASE_LABEL[phase] ?? phase}`;

  if (OPENED.has(phase)) for (const n of c.whenOpened) out.required.set(f(n), phaseWhy);
  if (CLOSED.has(phase)) {
    out.required.set(f(c.endActual), phaseWhy);
    for (const n of c.emptyWhenClosed) out.mustBeEmpty.set(f(n), phaseWhy);
  }
  if (NOT_GRANTED.has(phase)) for (const n of c.emptyWhenNotGranted) out.mustBeEmpty.set(f(n), phaseWhy);
  if (phase === "AC" && c.whenActive.length) {
    // CI: outstanding figures are due only before the planned end date.
    const ref = cicDateKey(values[f(c.refDate)]);
    const end = cicDateKey(values[f(c.endPlanned)]);
    const beforeEnd = t !== "CI" || ref === null || end === null || ref < end;
    if (beforeEnd) for (const n of c.whenActive) out.required.set(f(n), phaseWhy);
  }
  if (t === "CC" && CREDIT_CARD_TYPES.has(text(values, f(c.type)))) {
    out.required.set("CC22", "the contract is a credit card");
    out.required.set("CC33", "the contract is a credit card");
  }

  const start = cicDateKey(values[f(c.start)]);
  const ref = cicDateKey(values[f(c.refDate)]);
  const order = (n: number, label: string) => {
    const d = cicDateKey(values[f(n)]);
    if (start !== null && d !== null && d <= start) {
      out.findings.push({
        fieldId: f(n), code: "DATE_ORDER", severity: "error",
        message: `${label} must be later than the Contract Start Date.`,
      });
    }
  };
  if (start !== null && ref !== null && start >= ref) {
    out.findings.push({
      fieldId: f(c.start), code: "DATE_ORDER", severity: "error",
      message: "Contract Start Date must be earlier than the Contract Reference Date.",
    });
  }
  order(c.endPlanned, "Contract End Planned Date");
  order(c.endActual, "Contract End Actual Date");

  guaranteeRules(t, values, c.guaranteeBase, out);
  linkedSubjectRules(t, values, c.linkedBase, out);
}

/** Six guarantee blocks of 14 fields: no, subject, name, amount, currency, start, end, type, … */
function guaranteeRules(t: CicRecordType, values: CicRecordValues, base: number, out: RuleResult) {
  for (let k = 0; k < 6; k++) {
    const b = base + 14 * k;
    const [subject, name, amount, currency, type] = [b + 1, b + 2, b + 3, b + 4, b + 7].map((n) => id(t, n));
    const label = `Guarantee ${k + 1}`;
    if (has(values, type) && !has(values, subject) && !has(values, name)) {
      out.required.set(subject, `${label} has a type: give the guarantor's subject number or name`);
    }
    if (has(values, amount) && !has(values, type)) out.required.set(type, `${label} has an amount`);
    if (has(values, type) && !has(values, amount)) out.required.set(amount, `${label} has a type`);
    if (has(values, amount)) out.required.set(currency, `${label} has an amount`);
    const cur = text(values, currency);
    if (cur && cur !== "PHP") {
      out.findings.push({
        fieldId: currency, code: "GUARANTEE_CURRENCY", severity: "error",
        message: `${label}: the currency must be PHP, not ${cur}.`,
      });
    }
  }
}

/** Six linked subjects of 3 fields: subject number, role, name. */
function linkedSubjectRules(t: CicRecordType, values: CicRecordValues, base: number, out: RuleResult) {
  for (let k = 0; k < 6; k++) {
    const [subject, role, name] = [0, 1, 2].map((n) => id(t, base + 3 * k + n));
    const label = `Linked subject ${k + 1}`;
    if ((has(values, subject) || has(values, name)) && !has(values, role)) {
      out.required.set(role, `${label} is filled in`);
    }
    if (has(values, role) && !has(values, subject)) {
      out.required.set(name, `${label} has a role but no subject number`);
    }
  }
}

export function applyDependentRules(
  t: CicRecordType,
  values: CicRecordValues,
  ctx: Ctx,
): RuleResult {
  const out = makeResult();
  addressRules(t, values, ctx, out);
  pairRules(t, values, out);
  subjectRules(t, values, ctx, out);
  contractRules(t, values, out);
  return out;
}
