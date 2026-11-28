import assert from "node:assert/strict";
import { test } from "node:test";

import type { CicSubmissionDetail } from "@/types/cic";
import { encryptBlockedReason } from "./encrypt-gate";

type Gate = Parameters<typeof encryptBlockedReason>[0];
const ready = {
  status: "generated",
  active_key: { usable: true, unusable_reason: null },
  validation: { errors: 0, warnings: 0, top_issues: [] },
  encryption: { gpg_available: true },
  actions: { encrypt: true, download: false, mark_submitted: false, acknowledge: false, correct: false },
} as unknown as Gate;

test("only the server's usable key and its encrypt action open encryption", () => {
  assert.equal(encryptBlockedReason(ready), null);
  assert.match(encryptBlockedReason({ ...ready, active_key: null }) ?? "", /no active CIC public key/);
  assert.equal(
    encryptBlockedReason({ ...ready, active_key: { ...ready.active_key, usable: false, unusable_reason: "The key has expired." } as CicSubmissionDetail["active_key"] }),
    "The key has expired.",
  );
  assert.match(encryptBlockedReason({ ...ready, validation: { ...ready.validation, errors: 1 } }) ?? "", /errors/);
  assert.match(encryptBlockedReason({ ...ready, encryption: { ...ready.encryption, gpg_available: false } }) ?? "", /isn't installed/);
  assert.match(encryptBlockedReason({ ...ready, actions: { ...ready.actions, encrypt: false } }) ?? "", /can't encrypt/);
  assert.match(encryptBlockedReason({ ...ready, status: "encrypted" }) ?? "", /already encrypted/);
});
