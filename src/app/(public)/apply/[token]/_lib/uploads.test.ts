import { test } from "node:test";
import assert from "node:assert/strict";
import { fileProblem, uploadAccept, uploadPercent, uploadRules, uploadRulesText } from "./uploads";

// The merged upload rules (OriginationFileStore): JPEG, PNG or PDF only, by
// the file name's extension and the content (the server checks the content),
// within the settings' accepted types, at most the settings' size and never
// above 10 MB. The browser only saves a doomed upload; the server decides.

const ALL = { accepted_file_types: ["jpg", "jpeg", "jpe", "jfif", "png", "pdf"], max_upload_mb: 10 };

test("the rules are the settings' types the server takes, and its size", () => {
  assert.deepEqual(uploadRules(ALL), { extensions: ["jpg", "jpeg", "jpe", "jfif", "png", "pdf"], maxMb: 10 });
});

test("a type the server never takes is left out, whatever the settings say", () => {
  assert.deepEqual(uploadRules({ accepted_file_types: [".PDF", "docx", "doc", "png", "png"], max_upload_mb: 5 }).extensions, ["pdf", "png"]);
});

test("the size is the settings', between 1 and 10 MB", () => {
  assert.equal(uploadRules({ ...ALL, max_upload_mb: 25 }).maxMb, 10);
  assert.equal(uploadRules({ ...ALL, max_upload_mb: 0 }).maxMb, 1);
  assert.equal(uploadRules({ ...ALL, max_upload_mb: 4 }).maxMb, 4);
});

test("the file picker offers the accepted names", () => {
  assert.equal(uploadAccept(uploadRules({ accepted_file_types: ["jpg", "pdf"], max_upload_mb: 10 })), ".jpg,.pdf");
});

test("a file of a type the server refuses is stopped with its words", () => {
  const rules = uploadRules(ALL);
  assert.equal(fileProblem({ name: "payslip.docx", size: 1000 }, rules), "Upload a JPEG, PNG or PDF file.");
  assert.equal(fileProblem({ name: "noextension", size: 1000 }, rules), "Upload a JPEG, PNG or PDF file.");
});

test("when the settings narrow the types, the words name only those", () => {
  const pdfOnly = uploadRules({ accepted_file_types: ["pdf"], max_upload_mb: 10 });
  assert.equal(fileProblem({ name: "id.jpg", size: 1000 }, pdfOnly), "Upload a PDF file.");
  const pictures = uploadRules({ accepted_file_types: ["jpeg", "png"], max_upload_mb: 10 });
  assert.equal(fileProblem({ name: "id.pdf", size: 1000 }, pictures), "Upload a JPEG or PNG file.");
});

test("JPEG's other names are accepted, in any case", () => {
  const rules = uploadRules(ALL);
  for (const name of ["a.JPG", "a.jpeg", "a.jpe", "a.jfif", "a.Png", "a.PDF"]) {
    assert.equal(fileProblem({ name, size: 1000 }, rules), null, name);
  }
});

test("a file over the size is stopped with the server's words", () => {
  const rules = uploadRules({ ...ALL, max_upload_mb: 2 });
  assert.equal(fileProblem({ name: "a.pdf", size: 2 * 1024 * 1024 }, rules), null);
  assert.equal(fileProblem({ name: "a.pdf", size: 2 * 1024 * 1024 + 1 }, rules), "A file can be at most 2 MB.");
});

test("an empty file is stopped", () => {
  assert.equal(fileProblem({ name: "a.pdf", size: 0 }, uploadRules(ALL)), "This file is empty. Choose another.");
});

test("with no type left to take, nothing can be uploaded", () => {
  const none = uploadRules({ accepted_file_types: ["docx"], max_upload_mb: 10 });
  assert.equal(fileProblem({ name: "a.pdf", size: 10 }, none), "Files can't be uploaded here right now. Please contact the office.");
});

test("upload progress is a whole percent, or nothing while the size is unknown", () => {
  assert.equal(uploadPercent(512, 1024), 50);
  assert.equal(uploadPercent(1, 3), 33);
  assert.equal(uploadPercent(10, undefined), null);
  assert.equal(uploadPercent(10, 0), null);
});

test("the rule reads as the file names and size the server takes", () => {
  assert.equal(uploadRulesText(uploadRules({ accepted_file_types: ["jpg", "png", "pdf"], max_upload_mb: 5 })), "JPG, PNG, PDF, up to 5 MB each.");
});
