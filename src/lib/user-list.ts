// What the users screen shows, computed from a drain of `/users`.
//
// Split out of the page so the parts that were wrong can be tested without a
// browser. The screen loaded `userService.list()` with no arguments — the
// endpoint's default page of 15, newest first — and computed everything below
// over that array in the browser. Past 15 users the table, the search box, the
// Total card and every per-role count were all silently short, and nothing on
// screen said so.
//
// Dependency-free apart from `userBranches()`, so it runs under `tsx --test`.

import type { DrainResult } from "@/lib/paginate";
import { userBranches } from "@/lib/user-branches";
import type { User } from "@/types";

/** Set only when the drain gave up with pages outstanding. Null means complete. */
export interface UserListShortfall {
  /** How many users the screen actually has in hand. */
  shown: number;
  /** `meta.total` — how many exist. Null when the response carried no usable total. */
  total: number | null;
}

export interface UserList {
  users: User[];
  shortfall: UserListShortfall | null;
}

/**
 * The users a screen holds after a load, and whether that is all of them.
 *
 * Takes the whole `DrainResult`, not `rows`, so it cannot be called in a way
 * that drops `truncated` — the same reason `toShareCapitalBalance()` does. A
 * shortfall is for the caller to render, never to swallow.
 */
export function toUserList(drain: DrainResult<User>): UserList {
  return {
    users: drain.rows,
    shortfall: drain.truncated
      ? { shown: drain.rows.length, total: drain.total }
      : null,
  };
}

/**
 * The users screen's search box: a case-insensitive substring match on the
 * full name, username, email, any assigned branch, or the role. An empty query
 * matches everyone.
 *
 * It filters the rows in hand, so it is only as complete as the list it is
 * given — over one default page it could only ever search 15 users.
 */
export function filterUsers(users: User[], query: string): User[] {
  const q = query.toLowerCase();
  return users.filter((user) => {
    const role = user.roles?.[0] ?? "";
    return (
      user.full_name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      userBranches(user).some((b) => b.name.toLowerCase().includes(q)) ||
      role.toLowerCase().includes(q)
    );
  });
}

/** How many users hold `roleName` as their role — the number on each role card. */
export function countUsersWithRole(users: User[], roleName: string): number {
  return users.filter((u) => u.roles?.[0] === roleName).length;
}
