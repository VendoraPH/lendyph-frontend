import { formatCurrency, formatDateTime } from "@/lib/format";
import type { LindaAiStatus, LindaModelOption, LindaMonth, LindaSettings } from "@/types/linda";

/**
 * Settings → Linda in words. Every figure is the server's: the page formats
 * the peso strings and counts it is sent, and works nothing out itself.
 */

const AI_OFF_TEXT: Readonly<Record<string, string>> = {
  linda_off: "Linda is switched off on this server.",
  model_off:
    "The AI model is off on this server, so Linda answers only its suggested questions and their usual variants.",
  test_driver: "This server uses Linda's test model.",
  no_key: "The AI model has no key on this server.",
  no_prices: "The AI model's prices aren't set correctly on this server, so the AI model is off.",
};

/** A server peso figure, or a dash when the server sent none: a missing price is never ₱0.00. */
function money(value: string | null): string {
  return value === null ? "—" : formatCurrency(value);
}

/** Whether the AI model answers on this server, in words. A reason the page doesn't know reads as off. */
export function lindaAiStatusText(ai: LindaAiStatus): string {
  if (ai.on) return "The AI model is on.";
  return ai.reason && Object.hasOwn(AI_OFF_TEXT, ai.reason)
    ? AI_OFF_TEXT[ai.reason]
    : "The AI model is off on this server.";
}

const count = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

/** "₱12.34 of ₱1,000.00 used this month (November 2026) · 456 questions, 123 sent to the AI model". */
export function lindaMonthText(month: LindaMonth): string {
  const questions = `${count.format(month.questions)} ${month.questions === 1 ? "question" : "questions"}`;
  return (
    `${formatCurrency(month.cost)} of ${money(month.cap)} used this month (${month.label})` +
    ` · ${questions}, ${count.format(month.model_questions)} sent to the AI model`
  );
}

/** "about ₱0.01 a question", the server's figure for a typical question. */
export function lindaPerQuestionText(model: LindaModelOption): string {
  if (model.per_question === null) return "— a question";
  const perQuestion = parseFloat(model.per_question);
  if (Number.isFinite(perQuestion) && perQuestion === 0) return "less than ₱0.01 a question";
  return `about ${formatCurrency(model.per_question)} a question`;
}

/** "₱6.20 per million tokens in, ₱31.00 out". */
export function lindaTokenPriceText(model: LindaModelOption): string {
  return `${money(model.input_per_million)} per million tokens in, ${money(model.output_per_million)} out`;
}

/** A model option's name for screen readers: "Claude Haiku 5.5, in use". */
export function lindaModelOptionName(model: Pick<LindaModelOption, "label">, inUse: boolean): string {
  return inUse ? `${model.label}, in use` : model.label;
}

/** Who last chose the model and when, in Manila time. */
export function lindaLastChangedText(settings: Pick<LindaSettings, "updated_at" | "updated_by">): string {
  const { updated_at: at, updated_by: by } = settings;
  if (!at && !by) return "Not changed yet. Linda uses the server's default model.";
  const when = at ? formatDateTime(at) : null;
  if (by) return `Last changed by ${by}${when ? `, ${when}` : ""}.`;
  return `Last changed ${when}.`;
}

/** True when the model in use is one of the choices the server offers. */
export function lindaModelListed(settings: Pick<LindaSettings, "model" | "models">): boolean {
  return settings.models.some((m) => m.id === settings.model);
}

/** Save is allowed for a model the server offers that isn't the one in use, and not while saving. */
export function lindaSaveAllowed(
  settings: Pick<LindaSettings, "model" | "models">,
  selected: string,
  saving: boolean,
): boolean {
  return !saving && selected !== settings.model && settings.models.some((m) => m.id === selected);
}
