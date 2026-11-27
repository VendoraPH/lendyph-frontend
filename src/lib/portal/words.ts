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

/** A made-up origin to resolve links against; a link that resolves anywhere else is refused. */
const LINK_BASE = "https://portal.invalid";

/**
 * A notification's link, kept only when it resolves to a path inside the
 * member portal: `/member` or `/member/...`. The link is resolved as a URL
 * first, so dot segments, percent-encoded ones included (`%2e%2e`, `.%2E`),
 * are applied before the check, and the resolved path is what is returned.
 * Anything else (another site, a staff screen, a protocol-relative `//host`,
 * a backslash or a control character) is dropped, so a notice can never send
 * a member out of the portal.
 */
export function safeMemberLink(link: string | null | undefined): string | null {
  if (typeof link !== "string") return null;
  const value = link.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if ([...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null;
  let url: URL;
  try {
    url = new URL(value, LINK_BASE);
  } catch {
    return null;
  }
  if (url.origin !== LINK_BASE) return null;
  const { pathname } = url;
  if (pathname !== "/member" && !pathname.startsWith("/member/")) return null;
  if (pathname.includes("//") || /%2e/i.test(pathname)) return null;
  return `${pathname}${url.search}${url.hash}`;
}

/** The monthly late penalty in words ("Penalty: 2 months late"); null when no month was charged. */
export function penaltyMonthsText(months: number | null | undefined): string | null {
  if (typeof months !== "number" || !Number.isInteger(months) || months < 1) return null;
  return `Penalty: ${plural(months, "month")} late`;
}

/**
 * The months-late note for a penalty balance: only while penalty is still
 * owed (`balance`, the server's figure, above ₱0.00), so a penalty that was
 * paid or waived reads nothing under its ₱0.00. Compares the server's figure;
 * adds nothing.
 */
export function penaltyOwedNote(months: number | null | undefined, balance: string | null | undefined): string | null {
  if (typeof balance !== "string" || !/^\d+(\.\d+)?$/.test(balance) || !/[1-9]/.test(balance)) return null;
  return penaltyMonthsText(months);
}

/**
 * The label for a payment's date: "Past due since" once the date is before
 * `today` (Manila's, `todayISO()`), else "Due on". Dates compare as
 * YYYY-MM-DD.
 */
export function dueDateLabel(dueDate: string, today: string): string {
  return dueDate.slice(0, 10) < today ? "Past due since" : "Due on";
}
