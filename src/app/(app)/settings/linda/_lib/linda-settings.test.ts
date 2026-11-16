import { test } from "node:test";
import assert from "node:assert/strict";
import type { LindaModelOption, LindaSettings } from "@/types/linda";
import {
  lindaAiStatusText,
  lindaLastChangedText,
  lindaModelListed,
  lindaModelOptionName,
  lindaMonthText,
  lindaPerQuestionText,
  lindaSaveAllowed,
  lindaTokenPriceText,
} from "./linda-settings";

/** Manila times must read the same on a computer in another zone. */
process.env.TZ = "America/New_York";

const HAIKU: LindaModelOption = {
  id: "claude-haiku-5-5",
  label: "Claude Haiku 5.5",
  description: "Fast and low cost.",
  input_per_million: "6.20",
  output_per_million: "31.00",
  per_question: "0.01",
};

const SETTINGS: LindaSettings = {
  model: "claude-haiku-5-5",
  models: [HAIKU, { ...HAIKU, id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }],
  ai: { on: false, reason: "model_off" },
  month: { label: "November 2026", cost: "12.34", cap: "1000.00", questions: 456, model_questions: 123 },
  updated_at: "2026-11-16T09:00:00+08:00",
  updated_by: "Jane Admin",
};

test("the AI status line reads each server state in words", () => {
  assert.equal(lindaAiStatusText({ on: true, reason: null }), "The AI model is on.");
  assert.equal(lindaAiStatusText({ on: false, reason: "linda_off" }), "Linda is switched off on this server.");
  assert.equal(
    lindaAiStatusText({ on: false, reason: "model_off" }),
    "The AI model is off on this server, so Linda answers only its suggested questions and their usual variants.",
  );
  assert.equal(lindaAiStatusText({ on: false, reason: "test_driver" }), "This server uses Linda's test model.");
  assert.equal(lindaAiStatusText({ on: false, reason: "no_key" }), "The AI model has no key on this server.");
});

test("an AI state the page doesn't know reads as off, never as a raw key", () => {
  const text = lindaAiStatusText({ on: false, reason: "something_new" });
  assert.equal(text, "The AI model is off on this server.");
});

test("this month reads the server's cost, cap and counts", () => {
  assert.equal(
    lindaMonthText(SETTINGS.month),
    "₱12.34 of ₱1,000.00 used this month (November 2026) · 456 questions, 123 sent to the AI model",
  );
});

test("this month groups large counts and says one question in the singular", () => {
  assert.equal(
    lindaMonthText({ label: "December 2026", cost: "0.00", cap: "1000.00", questions: 1, model_questions: 0 }),
    "₱0.00 of ₱1,000.00 used this month (December 2026) · 1 question, 0 sent to the AI model",
  );
  assert.equal(
    lindaMonthText({ label: "December 2026", cost: "1000.5", cap: "1000.00", questions: 12345, model_questions: 1000 }),
    "₱1,000.50 of ₱1,000.00 used this month (December 2026) · 12,345 questions, 1,000 sent to the AI model",
  );
});

test("a model's prices read in pesos with two decimals, from the server's figures", () => {
  assert.equal(lindaPerQuestionText(HAIKU), "about ₱0.01 a question");
  assert.equal(lindaTokenPriceText(HAIKU), "₱6.20 per million tokens in, ₱31.00 out");
  assert.equal(
    lindaTokenPriceText({ ...HAIKU, input_per_million: "124", output_per_million: "1240.5" }),
    "₱124.00 per million tokens in, ₱1,240.50 out",
  );
});

test("a question priced below a centavo says so instead of ₱0.00", () => {
  assert.equal(lindaPerQuestionText({ ...HAIKU, per_question: "0.00" }), "less than ₱0.01 a question");
});

test("last changed reads the name and the Manila time", () => {
  assert.equal(lindaLastChangedText(SETTINGS), "Last changed by Jane Admin, Nov 16, 2026, 09:00 AM.");
  assert.equal(
    lindaLastChangedText({ ...SETTINGS, updated_at: "2026-11-16T01:30:00Z", updated_by: null }),
    "Last changed Nov 16, 2026, 09:30 AM.",
  );
  assert.equal(
    lindaLastChangedText({ ...SETTINGS, updated_at: null, updated_by: null }),
    "Not changed yet. Linda uses the server's default model.",
  );
});

test("Save is allowed only for a listed model that differs from the saved one, and never while saving", () => {
  assert.equal(lindaSaveAllowed(SETTINGS, "claude-haiku-5-5", false), false);
  assert.equal(lindaSaveAllowed(SETTINGS, "claude-sonnet-5-5", false), true);
  assert.equal(lindaSaveAllowed(SETTINGS, "claude-sonnet-5-5", true), false);
  assert.equal(lindaSaveAllowed(SETTINGS, "gpt-9", false), false);
  assert.equal(lindaSaveAllowed(SETTINGS, "", false), false);
});

test("a saved model the server no longer offers is noticed", () => {
  assert.equal(lindaModelListed(SETTINGS), true);
  assert.equal(lindaModelListed({ ...SETTINGS, model: "claude-old-1" }), false);
});

// Backend review: with the server's price settings broken the AI is off with
// `no_prices`, and the price figures and the cap may be null.
const NO_PRICES: LindaModelOption = { ...HAIKU, per_question: null, input_per_million: null, output_per_million: null };

test("broken price settings read in words", () => {
  assert.equal(
    lindaAiStatusText({ on: false, reason: "no_prices" }),
    "The AI model's prices aren't set correctly on this server, so the AI model is off.",
  );
});

test("a missing price shows a dash, never ₱0.00 or 'less than ₱0.01'", () => {
  assert.equal(lindaPerQuestionText(NO_PRICES), "— a question");
  assert.equal(lindaTokenPriceText(NO_PRICES), "— per million tokens in, — out");
  assert.equal(
    lindaTokenPriceText({ ...HAIKU, input_per_million: null }),
    "— per million tokens in, ₱31.00 out",
  );
  for (const text of [lindaPerQuestionText(NO_PRICES), lindaTokenPriceText(NO_PRICES)]) {
    assert.doesNotMatch(text, /₱0\.00|less than/);
  }
});

test("a missing cap shows a dash", () => {
  const text = lindaMonthText({ ...SETTINGS.month, cap: null });
  assert.equal(text, "₱12.34 of — used this month (November 2026) · 456 questions, 123 sent to the AI model");
});

test("Save still works while the prices are missing", () => {
  const broken: LindaSettings = {
    ...SETTINGS,
    ai: { on: false, reason: "no_prices" },
    models: SETTINGS.models.map((m) => ({ ...m, per_question: null, input_per_million: null, output_per_million: null })),
    month: { ...SETTINGS.month, cap: null },
  };
  assert.equal(lindaSaveAllowed(broken, "claude-sonnet-5-5", false), true);
});

test("a model option's accessible name separates the in-use mark", () => {
  assert.equal(lindaModelOptionName(HAIKU, true), "Claude Haiku 5.5, in use");
  assert.equal(lindaModelOptionName(HAIKU, false), "Claude Haiku 5.5");
});
