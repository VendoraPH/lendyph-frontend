import { NONE, RATE_PERIOD, labelOf } from "./labels";

/**
 * A rate as the server stores it, with its trailing zeros dropped and nothing
 * else changed: "3.0000" reads "3%", "2.7500" reads "2.75%". The digits are
 * never parsed or rounded (rates are never rounded).
 */
export function rateText(rate: string | null | undefined, period?: string | null): string {
  if (rate === null || rate === undefined || rate.trim() === "") return NONE;
  const trimmed = rate.trim().replace(/(\.\d*?)0+$/, (_, kept: string) => kept).replace(/\.$/, "");
  const shown = `${trimmed}%`;
  return period ? `${shown} ${labelOf(RATE_PERIOD, period)}` : shown;
}

const sizeFmt = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });

/** A file's size in bytes, in words ("240 KB", "1.5 MB"). */
export function fileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return NONE;
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${sizeFmt.format(bytes / 1024)} KB`;
  return `${sizeFmt.format(bytes / (1024 * 1024))} MB`;
}

/** "1 loan", "2 loans". */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * A notification's link, kept only when it is a path inside the member
 * portal: `/member` or `/member/...`. Anything else (another site, a staff
 * screen, a protocol-relative `//host`, a backslash or a `..` step) is
 * dropped, so a notice can never send a member out of the portal.
 */
export function safeMemberLink(link: string | null | undefined): string | null {
  if (typeof link !== "string") return null;
  const value = link.trim();
  if (value !== "/member" && !value.startsWith("/member/")) return null;
  if (value.includes("\\") || value.includes("//") || /(^|\/)\.\.?(\/|$|\?|#)/.test(value)) return null;
  if ([...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null;
  return value;
}

/** The monthly late penalty in words ("Penalty: 2 months late"); null when no month was charged. */
export function penaltyMonthsText(months: number | null | undefined): string | null {
  if (typeof months !== "number" || !Number.isInteger(months) || months < 1) return null;
  return `Penalty: ${plural(months, "month")} late`;
}
