// Settings → Menu Visibility, as the page shows it (finish run round 6).
// Dependency-light, so it runs under `tsx --test`.

import { MENU_MODULES, menuModule } from "@/constants/menu-modules";
import { getErrorMessage, httpStatusOf, looksHuman } from "@/lib/api-error";
import { formatTime } from "@/lib/format";
import type { MenuVisibilityModule } from "@/types/menu-visibility";

/** One switch on the page. */
export interface MenuVisibilityRow {
  key: string;
  label: string;
  /** 1 for a submenu, indented under its parent. */
  depth: 0 | 1;
  /** Its own switch: on means shown. */
  shown: boolean;
  /** A submenu's switch can't change while its parent is off. */
  disabled: boolean;
  /** Why it is disabled, in words. */
  note: string | null;
}

const ORDER = new Map<string, number>(MENU_MODULES.map((m, i) => [m.key, i]));
const position = (key: string) => ORDER.get(key) ?? Number.MAX_SAFE_INTEGER;

/** Whether this build has a module: it is in the module map and its flag is on. */
export function moduleInBuild(key: string): boolean {
  return menuModule(key)?.inBuild ?? false;
}

/** The server's switched-off keys, as the page's working copy. */
export function draftFrom(modules: readonly MenuVisibilityModule[]): Set<string> {
  return new Set(modules.filter((m) => m.hidden).map((m) => m.key));
}

function labelOf(modules: readonly MenuVisibilityModule[], key: string): string {
  return modules.find((m) => m.key === key)?.label?.trim() || menuModule(key)?.label || key;
}

/**
 * The switches, in the side menu's order with each submenu under its parent:
 * only the modules this build has. A submenu whose parent is off keeps its own
 * state but can't change ("Shown only when Loans is on").
 */
export function menuVisibilityRows(
  modules: readonly MenuVisibilityModule[],
  draft: ReadonlySet<string>,
  inBuild: (key: string) => boolean = moduleInBuild,
): MenuVisibilityRow[] {
  return modules
    .filter((m) => ORDER.has(m.key) && inBuild(m.key))
    .sort((a, b) => position(a.key) - position(b.key))
    .map((m) => {
      const parent = menuModule(m.key)?.parent ?? null;
      const parentOff = parent !== null && draft.has(parent);
      return {
        key: m.key,
        label: labelOf(modules, m.key),
        depth: parent === null ? 0 : 1,
        shown: !draft.has(m.key),
        disabled: parentOff,
        note: parentOff ? `Shown only when ${labelOf(modules, parent)} is on` : null,
      };
    });
}

/** The confirmation's sentence ("Hide: Savings, Linda. Show: CDA."), or null when nothing changed. */
export function saveSummary(
  saved: ReadonlySet<string>,
  draft: ReadonlySet<string>,
  modules: readonly MenuVisibilityModule[],
): string | null {
  const names = (keys: string[]) => keys.sort((a, b) => position(a) - position(b)).map((k) => labelOf(modules, k)).join(", ");
  const hide = [...draft].filter((k) => !saved.has(k));
  const show = [...saved].filter((k) => !draft.has(k));
  const parts = [hide.length ? `Hide: ${names(hide)}.` : null, show.length ? `Show: ${names(show)}.` : null].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** What a save sends: every switched-off key, in the menu's order (a key this build doesn't list stays as it was). */
export function hiddenPayload(draft: ReadonlySet<string>): string[] {
  return [...draft].sort((a, b) => position(a) - position(b) || a.localeCompare(b));
}

/** How a refused password reads: under the field (422), as a message (429, 503, other), or access denied (403). */
export interface OverrideRefusal {
  field?: string;
  message?: string;
  denied?: true;
}

const OVERRIDE_FALLBACK = "We couldn't check the password. Please try again.";

function bodyOf(err: unknown): { message?: unknown; code?: unknown; errors?: Record<string, unknown> } | undefined {
  return (err as { response?: { data?: { message?: unknown; code?: unknown; errors?: Record<string, unknown> } } })?.response
    ?.data;
}

export function overrideRefusal(err: unknown): OverrideRefusal {
  const status = httpStatusOf(err);
  const body = bodyOf(err);
  if (status === 403) return { denied: true };
  if (status === 422) {
    const first = Array.isArray(body?.errors?.password) ? body.errors.password.find((m) => typeof m === "string") : null;
    if (typeof first === "string" && looksHuman(first)) return { field: first };
  }
  if ((status === 429 || status === 503) && typeof body?.message === "string" && looksHuman(body.message)) {
    return { message: body.message };
  }
  return { message: getErrorMessage(err, OVERRIDE_FALLBACK) };
}

/** A 403 that asks for the administrator password (no override, or it ended). */
export function isOverrideRequired(err: unknown): boolean {
  return httpStatusOf(err) === 403 && bodyOf(err)?.code === "override_required";
}

/** "Access ends at 4:15 PM", in Philippine time; null without an override. */
export function accessEndsText(expiresAt: string | null | undefined): string | null {
  return expiresAt ? `Access ends at ${formatTime(expiresAt)}` : null;
}

/** Milliseconds until the override ends (0 when it already has). */
export function msUntil(expiresAt: string, now: number): number {
  const at = Date.parse(expiresAt);
  return Number.isNaN(at) ? 0 : Math.max(0, at - now);
}

/**
 * Reads the password from its field and empties the field at once, so the
 * password lives only in the request being sent: never in React state,
 * storage or the page afterwards.
 */
export function takePassword(field: { value: string } | null | undefined): string {
  if (!field) return "";
  const value = field.value;
  field.value = "";
  return value;
}
