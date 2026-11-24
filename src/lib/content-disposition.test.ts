import { test } from "node:test";
import assert from "node:assert/strict";
import { filenameFrom } from "./content-disposition";

test("a quoted file name", () => {
  assert.equal(filenameFrom('attachment; filename="Covered Transactions.pdf"'), "Covered Transactions.pdf");
});

test("an unquoted file name, as Laravel sends a plain one", () => {
  assert.equal(filenameFrom("attachment; filename=covered-transactions-20261121-093015.pdf"), "covered-transactions-20261121-093015.pdf");
});

test("an encoded UTF-8 name (filename*) wins over the plain fallback", () => {
  assert.equal(filenameFrom("attachment; filename=Report.pdf; filename*=UTF-8''Ulat%20%E2%82%B1.pdf"), "Ulat ₱.pdf");
  assert.equal(filenameFrom("attachment; filename*=utf-8''r%C3%A9sum%C3%A9.csv"), "résumé.csv");
});

test("a name whose encoding is broken gives none, so the caller's fallback name is used", () => {
  assert.equal(filenameFrom("attachment; filename*=UTF-8''%E0%A4%A.pdf"), null);
});

test("no header, or one with no name, gives none", () => {
  assert.equal(filenameFrom(undefined), null);
  assert.equal(filenameFrom(null), null);
  assert.equal(filenameFrom(""), null);
  assert.equal(filenameFrom("attachment"), null);
});
