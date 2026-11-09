import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getErrorMessage } from "@/lib/api-error";

const GENERIC = "We couldn't upload the document. Please try again.";
const dir = join(process.cwd(), "src/app/(app)/borrowers/[id]/_components");
const sources = {
  "member documents tab": readFileSync(join(dir, "documents-tab.tsx"), "utf8"),
  "co-maker documents dialog": readFileSync(join(dir, "co-maker-documents-dialog.tsx"), "utf8"),
};

// A refused upload (a 422 on the file's type or size) says why, in the server's
// words, as the loan page's documents card does since f2c-fe.
test("a refused upload shows the server's message, and the generic text only without one", () => {
  const refused = {
    isAxiosError: true,
    response: { status: 422, data: { message: "The file must be a file of type: pdf, jpg, jpeg, png." } },
  };
  assert.equal(getErrorMessage(refused, GENERIC), "The file must be a file of type: pdf, jpg, jpeg, png.");
  // No answer from the server to explain it: the generic text.
  assert.equal(getErrorMessage(new Error("render failed"), GENERIC), GENERIC);
});

for (const [name, source] of Object.entries(sources)) {
  test(`the ${name} reports a refused upload through the server's message`, () => {
    assert.ok(source.includes(`notifyError(err, "${GENERIC}")`), name);
    assert.ok(!source.includes(`toast.error("${GENERIC}")`), name);
  });
}
