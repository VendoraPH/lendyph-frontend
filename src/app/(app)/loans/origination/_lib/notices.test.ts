import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_REFUSAL,
  NOTICE_TYPES,
  noticePayload,
  publishBlocker,
  versionsOf,
  type NoticeForm,
} from "./notices";
import type { OriginationNotice } from "@/types/loan-origination";

test("the notice types and their words are the server's (OriginationNotice::TYPES and TYPE_LABELS)", () => {
  assert.deepEqual(
    NOTICE_TYPES.map((t) => [t.type, t.label]),
    [
      ["privacy_notice", "Privacy notice"],
      ["terms", "Terms and conditions"],
      ["declaration", "Declaration"],
      ["credit_authorization", "Credit authorization"],
    ],
  );
});

const form = (patch: Partial<NoticeForm> = {}): NoticeForm => ({
  type: "privacy_notice",
  version: "2026.1",
  title: "",
  body: "We keep your details to assess your application.",
  final: false,
  ...patch,
});

test("a version is published with its type, version, text and whether it is final; a blank title is left out", () => {
  assert.deepEqual(noticePayload(form({ version: " 2026.1 ", final: true })), {
    payload: { type: "privacy_notice", version: "2026.1", body: "We keep your details to assess your application.", final: true },
    problem: null,
  });
  assert.deepEqual(noticePayload(form({ title: " Privacy notice " })).payload.title, "Privacy notice");
});

test("what the server would refuse is caught first, in its own words", () => {
  assert.equal(noticePayload(form({ type: "" })).problem, "Choose the privacy notice, terms and conditions, declaration or credit authorization.");
  assert.equal(noticePayload(form({ version: "  " })).problem, "Give this text a version, like 2026.1.");
  assert.equal(noticePayload(form({ version: "v 1" })).problem, "A version uses letters, digits, dots and dashes, like 2026.1.");
  assert.equal(noticePayload(form({ version: ".1" })).problem, "A version uses letters, digits, dots and dashes, like 2026.1.");
  assert.equal(noticePayload(form({ body: "   " })).problem, "Enter the text applicants will read.");
  assert.equal(noticePayload(form({ body: "x".repeat(50001) })).problem, "The text can be at most 50,000 characters.");
  assert.equal(noticePayload(form({ version: "2026.1-draft-b" })).problem, null);
});

test("publishing needs the settings permission and access to all branches, refused in the server's words", () => {
  assert.equal(publishBlocker(true), null);
  assert.equal(publishBlocker(false), NOTICE_REFUSAL);
  assert.equal(
    NOTICE_REFUSAL,
    "Online application notices apply to every branch, so publishing one needs the online applications settings permission and access to all branches.",
  );
});

const notice = (id: number, type: OriginationNotice["type"], version: string): OriginationNotice => ({
  id,
  type,
  type_label: "",
  version,
  title: null,
  body: "…",
  body_hash: "h",
  final: false,
  published_at: "2026-11-24T01:00:00Z",
  published_by: { id: 1, name: "Admin" },
});

test("each type's history keeps the server's order, newest first", () => {
  const versions = [notice(5, "terms", "2026.2"), notice(4, "privacy_notice", "2026.1"), notice(3, "terms", "2026.1")];
  assert.deepEqual(versionsOf(versions, "terms").map((n) => n.version), ["2026.2", "2026.1"]);
  assert.deepEqual(versionsOf(versions, "declaration"), []);
});
