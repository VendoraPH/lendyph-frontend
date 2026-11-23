import { test } from "node:test";
import assert from "node:assert/strict";
import { API_ENDPOINTS } from "./api-endpoints";

// The public application's paths take the link token from the page address
// (`useParams()` decodes it, so a typed `%2F` arrives as `/`) and a document
// id from the server. Each stays one path segment, so a crafted link like
// `/apply/..%2F..%2Fx` can't steer a call to another API path (security review
// of #657).

const P = API_ENDPOINTS.PUBLIC_APPLY;
const HOSTILE = "../../auth/me?x=1#y";
const TOKEN = encodeURIComponent(HOSTILE);

const BUILT: readonly [name: string, path: string, tail: readonly string[]][] = [
  ["PORTAL", P.PORTAL(HOSTILE), []],
  ["OTP_REQUEST", P.OTP_REQUEST(HOSTILE), ["otp"]],
  ["OTP_VERIFY", P.OTP_VERIFY(HOSTILE), ["otp", "verify"]],
  ["DRAFT", P.DRAFT(HOSTILE), ["draft"]],
  ["ESTIMATE", P.ESTIMATE(HOSTILE), ["estimate"]],
  ["DOCUMENTS", P.DOCUMENTS(HOSTILE), ["documents"]],
  ["DOCUMENT", P.DOCUMENT(HOSTILE, "../x"), ["documents", encodeURIComponent("../x")]],
  ["SUBMIT", P.SUBMIT(HOSTILE), ["submit"]],
  ["LOGOUT", P.LOGOUT(HOSTILE), ["logout"]],
  ["TRACK", P.TRACK(HOSTILE), ["track"]],
];

for (const [name, path, tail] of BUILT) {
  test(`${name} keeps a token holding / and .. in one path segment`, () => {
    assert.deepEqual(path.split("/"), ["", "public-apply", TOKEN, ...tail]);
  });
}

test("every public application path is checked", () => {
  assert.deepEqual(BUILT.map(([name]) => name).sort(), Object.keys(P).sort());
});

test("a real token and document id read as they are", () => {
  assert.equal(
    P.DOCUMENT("Tq7m2Xc9Lp4Rz8Kd1Vb6Nw3Hy5Gf0Sa2", "01jzq8r3m4n5p6q7r8s9t0v1w2"),
    "/public-apply/Tq7m2Xc9Lp4Rz8Kd1Vb6Nw3Hy5Gf0Sa2/documents/01jzq8r3m4n5p6q7r8s9t0v1w2",
  );
});
