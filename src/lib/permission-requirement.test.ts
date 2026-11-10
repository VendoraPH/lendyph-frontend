import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import { meetsPermission } from "./permission-requirement";

const holds = (...held: Permission[]) => (p: Permission) => held.includes(p);

describe("meetsPermission", () => {
  test("a single permission needs exactly that permission", () => {
    assert.equal(meetsPermission("loans:view", holds("loans:view")), true);
    assert.equal(meetsPermission("loans:view", holds("loans:create")), false);
    assert.equal(meetsPermission("loans:view", holds()), false);
  });

  test("a list needs any one of its permissions", () => {
    const required: Permission[] = ["loans:approve", "loans:release"];
    assert.equal(meetsPermission(required, holds("loans:release")), true);
    assert.equal(meetsPermission(required, holds("loans:approve", "loans:release")), true);
    assert.equal(meetsPermission(required, holds("loans:view")), false);
  });

  test("an empty list grants nothing", () => {
    assert.equal(meetsPermission([], holds("loans:view")), false);
  });
});
