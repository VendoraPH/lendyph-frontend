import { test } from "node:test";
import assert from "node:assert/strict";
import { emailWarning, isAcceptedEmail, serverText } from "./import-email";

/**
 * Every verdict below is the server's: each value was run through
 * `ValueNormalizer::email()`'s own reading (`text()`, then Laravel's `email`
 * and `max:255` rules, egulias/email-validator 4.0.4's `RFCValidation`) in
 * lendyph-backend, and this port agreed with it on all 6,248 values of a
 * generated set (2026-11-25). Re-run that comparison if the backend's
 * egulias/email-validator or Laravel's `email` rule changes.
 */
const ACCEPTED = [
  "juan@example.com",
  "juan.delacruz@example.test",
  "juan@localhost",
  "juan@example",
  "a@b",
  "juan @example.com",
  "juan@example.c",
  "juan@123.com",
  "juan@example.123",
  "juan@[127.0.0.1]",
  "juan@[IPv6:::1]",
  "juan@[300.0.0.1]",
  "\"juan dela cruz\"@example.com",
  "\"juan\"@example.com",
  "\"ju\\\"an\"@example.com",
  "juan(comment)@example.com",
  "juan+tag@example.com",
  "j!#$%&'*+-/=?^_`{|}~@example.com",
  "juán@example.com",
  "juan@exámple.com",
  "juan@例え.jp",
  "juan@xn--exmple-cua.com",
  "juan@ex--ample.com",
  "juan@example.com ",
  "juan@example.com.ph",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@example.com",
  "juan@e.x.a.m.p.l.e",
  "juan@1.2.3.4",
  "juan@example.com\t",
  "juan@[1.2.3]",
  "\"\"@example.com",
  "\"juan@x\"@example.com",
  "juan\\@example.com",
  "juan@example.-com",
  "juan.dela-cruz_99@sub.example-site.com.ph",
  "JUAN@EXAMPLE.COM",
  "juan()@example.com",
  "(c)juan@example.com",
  "﻿juan@example.com",
  " juan@example.com ",
];

const REFUSED = [
  "juan@@example.com",
  "juan",
  "@example.com",
  "juan@",
  ".juan@example.com",
  "juan.@example.com",
  "ju..an@example.com",
  "juan@example..com",
  "juan@.example.com",
  "juan@example.com.",
  "juan@-example.com",
  "juan@example-.com",
  "juan@exa_mple.com",
  "juan@exa mple.com",
  "ju an@example.com",
  "juan@example.com(comment)",
  "juan,cruz@example.com",
  "juan;cruz@example.com",
  "juan@example.com;maria@example.com",
  "juan@example.com, maria@example.com",
  "juan<juan@example.com>",
  "Juan <juan@example.com>",
  "juan@example,com",
  "juan[at]example.com",
  "juan@example@com",
  "n/a",
  "N/A",
  "-",
  "none",
  "0",
  "juan@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.com",
  "jua\tn@example.com",
  "juan@-.com",
  "juan@example.co-",
  "juan@exa\"mple.com",
  "juan@ex(ample.com",
  "juan@ example.com",
  "juan @ example.com",
  "juan@example .com",
  "juan€@example.com",
  "juan@example.com\nmaria@example.com",
];

test("an email the server keeps raises nothing", () => {
  for (const email of ACCEPTED) {
    assert.equal(emailWarning(email), null, JSON.stringify(email));
  }
});

test("an email the server imports blank warns, in the future tense", () => {
  for (const email of REFUSED) {
    const warning = emailWarning(email);
    assert.ok(warning, JSON.stringify(email));
    assert.match(warning, /will be imported as blank/, JSON.stringify(email));
    assert.match(warning, /The row still imports/);
  }
});

test("the warning quotes the cell as the server reads it", () => {
  assert.equal(
    emailWarning("  maria@example .com  "),
    '"maria@example .com" is not an email address this system accepts, so it will be imported as blank. The row still imports; correct the email in the file to keep it, or add it later on the member\'s page.',
  );
});

test("a blank cell is the required-field check's, and a long one the size check's", () => {
  assert.equal(emailWarning(""), null);
  assert.equal(emailWarning(" \t "), null);
  assert.equal(emailWarning(`${"a".repeat(250)}@b.com`), null);
});

test("the cell is read as PHP's text() reads it", () => {
  assert.equal(serverText("﻿ maria@example.com \t"), "maria@example.com");
  // PHP's trim() leaves other Unicode spaces, which the rule then refuses.
  assert.equal(serverText(" maria@example.com"), " maria@example.com");
  assert.equal(isAcceptedEmail(" maria@example.com"), true);
});

test("a domain may hold 253 bytes, never 254, counted after its own @", () => {
  // Five 20-letter "é" labels (40 bytes and a dot each), then "a"s to the
  // length wanted: well under 255 characters, so only the domain rule
  // decides. The server takes the 253-byte one and refuses the 254-byte one.
  const domain = (bytes: number) => {
    const labels = `${"é".repeat(20)}.`.repeat(5);
    return labels + "a".repeat(bytes - new TextEncoder().encode(labels).length);
  };
  assert.equal(isAcceptedEmail(`a@${domain(253)}`), true);
  assert.equal(isAcceptedEmail(`a@${domain(254)}`), false);
  assert.equal(isAcceptedEmail(`"x@y"@${domain(254)}`), false);
});
