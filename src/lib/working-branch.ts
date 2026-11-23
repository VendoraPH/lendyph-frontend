/**
 * The working branch (Phase 6, multi-branch): the branch a user is working in,
 * picked in the header, that presets every branch filter and form branch
 * picker. It is a browser convenience only: kept per user in localStorage,
 * never sent as proof of anything (the server checks every `branch_id`), so
 * switching it isn't audited. Pure, so it runs under `tsx --test`.
 */

import { ALL_BRANCHES } from "./branch-filter";
import { pickableBranches, type NamedBranch } from "./branch-choice";
import type { BranchSelectItem, BranchViewer } from "./user-branches";

const KEY_PREFIX = "lendy-working-branch:";

/** The localStorage key of one user's working branch. */
export function workingBranchKey(userId: number): string {
  return `${KEY_PREFIX}${userId}`;
}

/** The part of `Storage` used here, so tests can hand in a Map. */
export interface WorkingBranchStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

type StorageSource = () => WorkingBranchStorage;
type UserId = number | null | undefined;

/** A stored working branch: its id, and its name when it was kept (so the header shows it at once). */
export interface StoredWorkingBranch {
  id: number;
  name: string | null;
}

/**
 * The stored value, read: `{"id":2,"name":"South"}`, or a bare id stored before
 * names were kept. Anything else, or a storage that can't be reached (blocked,
 * server render), reads as none.
 */
function readStored(storage: StorageSource, userId: UserId): StoredWorkingBranch | null {
  if (userId === null || userId === undefined) return null;
  let raw: string | null;
  try {
    raw = storage().getItem(workingBranchKey(userId));
  } catch {
    return null;
  }
  if (raw === null) return null;
  if (/^\d+$/.test(raw)) return Number(raw) > 0 ? { id: Number(raw), name: null } : null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const { id, name } = parsed as { id?: unknown; name?: unknown };
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  return { id, name: typeof name === "string" && name.trim() !== "" ? name : null };
}

/** The user's stored working branch id, or null. */
export function readWorkingBranch(storage: StorageSource, userId: UserId): number | null {
  return readStored(storage, userId)?.id ?? null;
}

/** The stored working branch's name, or null (none stored, or stored without one). */
export function readWorkingBranchName(storage: StorageSource, userId: UserId): string | null {
  return readStored(storage, userId)?.name ?? null;
}

/** Stores the user's working branch with its name; null (All) removes it. A failed write is dropped. */
export function writeWorkingBranch(storage: StorageSource, userId: UserId, branch: NamedBranch | null): void {
  if (userId === null || userId === undefined) return;
  try {
    if (branch === null) storage().removeItem(workingBranchKey(userId));
    else storage().setItem(workingBranchKey(userId), JSON.stringify({ id: branch.id, name: branch.name }));
  } catch {
    // Not saved: the working branch is only a convenience.
  }
}

/** Forgets the user's working branch, at sign-out. */
export function forgetWorkingBranch(storage: StorageSource, userId: UserId): void {
  writeWorkingBranch(storage, userId, null);
}

/**
 * The working branch that counts, or null. With the flag off there is none, so
 * every filter keeps today's default. A branch user's stored branch counts only
 * while it is still theirs; view_all may hold any branch. Once the branch list
 * (`GET /branches`, active branches only) is loaded, a branch it no longer
 * lists stops counting too.
 */
export function workingBranchFor(args: {
  enabled: boolean;
  stored: number | null;
  viewer: BranchViewer;
  listed?: readonly { id: number }[] | null;
}): number | null {
  const { enabled, stored, viewer, listed } = args;
  if (!enabled || stored === null) return null;
  if (!viewer.viewAll && !viewer.branchIds.includes(stored)) return null;
  if (listed && listed.length > 0 && !listed.some((b) => b.id === stored)) return null;
  return stored;
}

/**
 * A list's branch filter default: the page's own `?branch=` first, then the
 * working branch, then the page's default today (`fallback`).
 */
export function branchFilterDefault(args: {
  url?: string | null;
  working: number | null;
  fallback: string;
}): string {
  const { url, working, fallback } = args;
  if (url) return url;
  if (working !== null) return String(working);
  return fallback;
}

/**
 * A form branch picker's preselection: the working branch when the form offers
 * it, else the form's own preselection.
 */
export function workingBranchPreset<T extends string | null>(
  working: number | null,
  offered: readonly string[],
  own: T,
): string | T {
  if (working !== null && offered.includes(String(working))) return String(working);
  return own;
}

export type WorkingBranchSelector =
  /** No branch and no view_all: the header shows nothing. */
  | { kind: "none" }
  /** One branch and no view_all: the header names it, as plain text. */
  | { kind: "single"; branch: NamedBranch }
  | { kind: "select"; items: BranchSelectItem[] };

/**
 * What the header's selector offers: only the caller's branches, after an
 * "All" option meaning no working branch: "All branches" with view_all, "All
 * my branches" for a branch user with several (the filters' own default). A
 * branch user's own branches stand in while the list loads; once loaded, only
 * the ones it lists (active) are offered. While a view_all list loads, the
 * stored branch is offered by its stored name, so the header never shows an id.
 */
export function workingBranchSelector<T extends NamedBranch>(source: {
  viewAll: boolean;
  own: readonly T[];
  listed: readonly T[];
  stored?: StoredWorkingBranch | null;
}): WorkingBranchSelector {
  const toItem = (b: NamedBranch) => ({ value: String(b.id), label: b.name });
  if (source.viewAll) {
    const branches: NamedBranch[] = pickableBranches(source);
    const { stored } = source;
    if (source.listed.length === 0 && stored?.name && !branches.some((b) => b.id === stored.id)) {
      branches.push({ id: stored.id, name: stored.name });
    }
    return { kind: "select", items: [{ value: ALL_BRANCHES, label: "All branches" }, ...branches.map(toItem)] };
  }
  const listedIds = new Set(source.listed.map((b) => b.id));
  const branches =
    source.listed.length > 0 ? source.own.filter((b) => listedIds.has(b.id)) : [...source.own];
  if (branches.length === 0) return { kind: "none" };
  if (branches.length === 1) return { kind: "single", branch: branches[0] };
  return { kind: "select", items: [{ value: ALL_BRANCHES, label: "All my branches" }, ...branches.map(toItem)] };
}

/** The selector's value: the working branch, else the "All" option. */
export function workingBranchSelectorValue(working: number | null): string {
  return working === null ? ALL_BRANCHES : String(working);
}

/** The selector's value when its items name it, else null: the header shows a loading state, never an id. */
export function selectorShownValue(value: string, items: readonly BranchSelectItem[]): string | null {
  return items.some((i) => i.value === value) ? value : null;
}

/** A value picked on a page, with the working branch it was picked under. */
export interface PickedUnder<T> {
  value: T;
  working: number | null;
}

/**
 * A page's value that follows the working branch: its pick while the working
 * branch is the one it was picked under, else the preset. So a header switch
 * puts a branch filter back on the working branch and a paged list on page 1.
 */
export function followWorkingBranch<T>(picked: PickedUnder<T> | null, working: number | null, preset: T): T {
  return picked !== null && picked.working === working ? picked.value : preset;
}

/**
 * A filter object that carries the branch as `branch_id` (Reminders,
 * Applications), the working branch its branch was last picked under, and the
 * one it was last set under (`undefined`: never, on the page).
 */
export interface BranchScopedFilters<T extends { branch_id?: number; page?: number }> {
  filters: T;
  pickedUnder: number | null | undefined;
  setUnder: number | null | undefined;
}

export function initialBranchFilters<T extends { branch_id?: number; page?: number }>(
  filters: T,
): BranchScopedFilters<T> {
  return { filters, pickedUnder: undefined, setUnder: undefined };
}

/**
 * The filters the page shows: as stored once its branch was picked under the
 * current working branch, otherwise with the branch following the working
 * branch (none: every branch, today's default). A paged list set under another
 * working branch goes back to page 1. Other filters always stay.
 */
export function shownBranchFilters<T extends { branch_id?: number; page?: number }>(
  state: BranchScopedFilters<T>,
  working: number | null,
): T {
  if (state.pickedUnder !== undefined && state.pickedUnder === working) return state.filters;
  const rest = { ...state.filters };
  delete rest.branch_id;
  if (rest.page !== undefined && state.setUnder !== undefined && state.setUnder !== working) rest.page = 1;
  return working === null ? rest : { ...rest, branch_id: working };
}

/** Stores the page's next filters; a changed `branch_id` counts as a pick under `working`. */
export function nextBranchFilters<T extends { branch_id?: number; page?: number }>(
  prev: BranchScopedFilters<T>,
  next: T,
  working: number | null,
): BranchScopedFilters<T> {
  const shown = shownBranchFilters(prev, working);
  return {
    filters: next,
    pickedUnder: next.branch_id !== shown.branch_id ? working : prev.pickedUnder,
    setUnder: working,
  };
}
