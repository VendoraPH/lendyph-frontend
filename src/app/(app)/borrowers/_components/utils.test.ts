import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewerLabel } from "./utils";

test("reviewerLabel prefers the relation's full_name when the API sends one", () => {
  assert.equal(
    reviewerLabel({
      rejected_by: 7,
      rejected_by_user: { full_name: "Rosario Dela Peña", name: "rosario" },
    }),
    "Rosario Dela Peña",
  );
});

test("reviewerLabel falls back to the relation's name", () => {
  assert.equal(
    reviewerLabel({ rejected_by: 7, rejected_by_user: { name: "rosario" } }),
    "rosario",
  );
});

test("reviewerLabel degrades to the bare id BorrowerResource actually sends", () => {
  // The resource returns `'rejected_by' => $this->rejected_by` and never loads
  // the rejectedByUser relation, so this is the production path today.
  assert.equal(reviewerLabel({ rejected_by: 7 }), "Reviewer #7");
  assert.equal(
    reviewerLabel({ rejected_by: 7, rejected_by_user: null }),
    "Reviewer #7",
  );
});

test("reviewerLabel treats user id 0 as a reviewer, not as missing", () => {
  // `if (source.rejected_by)` would swallow this one and blame nobody.
  assert.equal(reviewerLabel({ rejected_by: 0 }), "Reviewer #0");
});

test("reviewerLabel returns null when no reviewer was recorded", () => {
  assert.equal(reviewerLabel({}), null);
  assert.equal(reviewerLabel({ rejected_by: null }), null);
  assert.equal(
    reviewerLabel({ rejected_by: undefined, rejected_by_user: undefined }),
    null,
  );
});

test("reviewerLabel ignores an empty-string name rather than rendering blank", () => {
  assert.equal(
    reviewerLabel({ rejected_by: 4, rejected_by_user: { full_name: "", name: "" } }),
    "Reviewer #4",
  );
});
