import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NO_BRANCH } from "@/lib/branch-choice";
import {
  BLANK_LINE,
  STATEMENT_LINES_MAX,
  buildCreateBody,
  createErrorMessages,
  parsePastedLines,
  signedCentavos,
  type StatementForm,
} from "./statement-form";

describe("signed pesos to centavos, through toCentavos", () => {
  test("money in and money out", () => {
    assert.equal(signedCentavos("2,000.00"), 200_000);
    assert.equal(signedCentavos("1500.5"), 150_050);
    assert.equal(signedCentavos("+20"), 2_000);
    assert.equal(signedCentavos("-150.00"), -15_000);
    assert.equal(signedCentavos("−150.00"), -15_000);
    assert.equal(signedCentavos("(150.00)"), -15_000);
    assert.equal(signedCentavos("-₱1,500.00"), -150_000);
    assert.equal(signedCentavos("₱ 0.10"), 10);
  });

  test("anything else is refused, not guessed", () => {
    for (const bad of ["", "  ", "abc", "--1", "1-", "(1", "1.2.3", "-"]) {
      assert.equal(signedCentavos(bad), null, JSON.stringify(bad));
    }
  });
});

describe("pasted statement rows", () => {
  test("tab-separated rows, as copied from a spreadsheet", () => {
    const { lines, errors } = parsePastedLines(
      "2026-10-05\tBank charge\t-150.00\tBC-1\n2026-10-06\tDeposit, branch 2\t2,000.00\t",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(lines, [
      { date: "2026-10-05", description: "Bank charge", amount: "-150.00", reference: "BC-1" },
      { date: "2026-10-06", description: "Deposit, branch 2", amount: "2,000.00", reference: "" },
    ]);
  });

  test("comma-separated rows with quotes; a header row and blank rows are skipped", () => {
    const { lines, errors } = parsePastedLines(
      'Date,Description,Amount,Reference\n\n2026-10-06,"Deposit, branch 2","2,000.00",DS-9\n',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(lines, [
      { date: "2026-10-06", description: "Deposit, branch 2", amount: "2,000.00", reference: "DS-9" },
    ]);
  });

  test("a row without date, description and amount is reported by its row number", () => {
    const { lines, errors } = parsePastedLines("2026-10-05\tBank charge\n2026-10-06\tFee\t-5");
    assert.equal(lines.length, 1);
    assert.deepEqual(errors, [
      "Pasted row 1: expected a date, a description, an amount and an optional reference.",
    ]);
  });
});

describe("the create payload", () => {
  const form = (overrides: Partial<StatementForm> = {}): StatementForm => ({
    accountId: 2,
    branch: "3",
    period: "",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    statementBalance: "24,850.50",
    lines: [
      { date: "2026-10-05", description: " Bank charge ", amount: "-150.00", reference: " BC-1 " },
      { date: "2026-10-06", description: "Deposit", amount: "2,000.00", reference: "" },
      { ...BLANK_LINE },
    ],
    ...overrides,
  });

  test("integer centavos, signed lines, trimmed text; blank rows and a blank period left out", () => {
    assert.deepEqual(buildCreateBody(form()), {
      ok: true,
      body: {
        account_id: 2,
        branch_id: 3,
        start_date: "2026-10-01",
        end_date: "2026-10-31",
        statement_balance: 2_485_050,
        lines: [
          { date: "2026-10-05", description: "Bank charge", amount: -15_000, external_reference: "BC-1" },
          { date: "2026-10-06", description: "Deposit", amount: 200_000 },
        ],
      },
    });
  });

  test("a typed period is sent; an overdrawn statement balance is negative; no lines is an empty list", () => {
    const result = buildCreateBody(
      form({ period: " Oct 2026 ", statementBalance: "-1,500.00", lines: [] }),
    );
    assert.ok(result.ok);
    assert.equal(result.body.period, "Oct 2026");
    assert.equal(result.body.statement_balance, -150_000);
    assert.deepEqual(result.body.lines, []);
  });

  test("every problem is listed in words, lines by number", () => {
    const result = buildCreateBody({
      accountId: null,
      branch: null,
      period: "",
      startDate: "2026-10-31",
      endDate: "2026-10-01",
      statementBalance: "lots",
      lines: [
        { date: "10/05/2026", description: "Fee", amount: "-5", reference: "" },
        { date: "2026-10-06", description: " ", amount: "0", reference: "x".repeat(65) },
        { date: "2026-10-07", description: "Fee", amount: "five", reference: "" },
      ],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(!result.ok && result.errors, [
      "Choose the money account.",
      "Choose the branch whose entries this reconciliation proves.",
      "The end date can't be before the start date.",
      "Enter the statement closing balance in pesos, for example 24,850.50 or -1,500.00.",
      "Line 1: enter the date as YYYY-MM-DD.",
      "Line 2: enter a description.",
      "Line 2: the amount can't be zero.",
      "Line 2: the reference can be at most 64 characters.",
      "Line 3: enter the amount in pesos; money out is negative.",
    ]);
  });

  test("All branches is sent as an explicit null", () => {
    const result = buildCreateBody(form({ branch: NO_BRANCH }));
    assert.ok(result.ok);
    assert.equal(result.body.branch_id, null);
    assert.ok("branch_id" in result.body);
  });

  test("missing dates, and more lines than the server takes", () => {
    const lines = Array.from({ length: STATEMENT_LINES_MAX + 1 }, () => ({
      date: "2026-10-05",
      description: "Fee",
      amount: "-1",
      reference: "",
    }));
    const result = buildCreateBody(form({ startDate: "", lines }));
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.includes("Enter the start and end dates."));
    assert.ok(!result.ok && result.errors.includes("A statement can have at most 1,000 lines."));
  });
});

describe("the server's refusals on create", () => {
  const httpError = (status: number, data: Record<string, unknown>) => ({
    isAxiosError: true,
    response: { status, data },
  });

  test("a line's error names the line by number; the others read as sent", () => {
    const messages = createErrorMessages(
      httpError(422, {
        message: "The given data was invalid.",
        errors: {
          period: ["1020 Cash in Bank already has a reconciliation for October 2026."],
          "lines.3.date": ["2025-10-05 is outside the period being reconciled."],
        },
      }),
      { canViewAll: true },
    );
    assert.deepEqual(messages, [
      "1020 Cash in Bank already has a reconciliation for October 2026.",
      "Line 4: 2025-10-05 is outside the period being reconciled.",
    ]);
  });

  test("a 403 for a branch user is explained", () => {
    const [message] = createErrorMessages(httpError(403, { message: "This action is unauthorized." }), {
      canViewAll: false,
    });
    assert.match(message, /your own branches/);
  });

  test("the server's branch refusal and a start collision read in its words", () => {
    assert.deepEqual(
      createErrorMessages(
        httpError(422, { errors: { branch_id: ["Pick the branch whose entries this reconciliation proves."] } }),
        { canViewAll: false },
      ),
      ["Pick the branch whose entries this reconciliation proves."],
    );
    const collided = "Someone else was starting a reconciliation at the same moment. Nothing was saved; try again.";
    assert.deepEqual(createErrorMessages(httpError(409, { message: collided }), { canViewAll: true }), [collided]);
  });
});
