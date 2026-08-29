import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPORT_CHUNK_SIZE,
  MAX_IMPORT_CHUNK_SIZE,
  missingChunks,
  planChunks,
} from "./import-chunks";
import {
  IMPORT_SESSION_TTL_MS,
  clearImportSession,
  isImportSession,
  loadImportSession,
  recordUploadedChunk as record,
  resumableChunks,
  sameFile,
  saveImportSession,
  type ImportSession,
  type NewImportSession,
  type SessionStore,
} from "./import-session";

const STORAGE_KEY = "lendyph.import_session";

function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const store: SessionStore & { map: Map<string, string> } = {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  return store;
}

const MEMBERS = {
  name: "binhs-members.csv",
  size: 6144,
  lastModified: 1_756_000_000_000,
  totalChunks: 1,
  uploadedChunks: [] as number[],
};

const SESSION: ImportSession = {
  sessionId: "imp_9f3c2b",
  branchId: 2,
  productMap: { "SALARY LOAN": 4, "EMERGENCY LOAN": 7 },
  hasHeaderRow: true,
  dateFormat: "dd/MM/yyyy",
  chunkSize: IMPORT_CHUNK_SIZE,
  files: { members: MEMBERS, loans: { ...MEMBERS, name: "binhs-loans.csv", size: 20480 } },
  startedAt: 1_756_400_000_000,
};

// --- round trip ---------------------------------------------------------------

test("every decision survives the round trip, not just the session id", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  const loaded = loadImportSession({ storage, now: SESSION.startedAt + 1000 });
  // Re-answering these by hand is exactly what the record exists to prevent, so
  // the assertion is on the whole object rather than on a field or two.
  assert.deepEqual(loaded, SESSION);
});

test("the storage key is locked, because renaming it silently loses every resume", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  assert.equal(storage.map.size, 1);
  assert.ok(storage.map.has(STORAGE_KEY));
});

test("startedAt is stamped once and not refreshed by later saves", () => {
  const storage = fakeStore();
  const fresh: NewImportSession = { ...SESSION, startedAt: undefined };
  saveImportSession(fresh, { storage, now: 1000 });
  assert.equal(loadImportSession({ storage, now: 1000 })?.startedAt, 1000);

  // Saving progress an hour later must not extend the lifetime: the server's
  // TTL runs from when IT issued the session, so refreshing here would keep
  // offering a resume the server has already dropped.
  const progressed = loadImportSession({ storage, now: 1000 })!;
  saveImportSession(progressed, { storage, now: 3_600_000 });
  assert.equal(loadImportSession({ storage, now: 3_600_000 })?.startedAt, 1000);
});

test("no stored session reads as null rather than as an empty one", () => {
  assert.equal(loadImportSession({ storage: fakeStore() }), null);
});

test("clearing means the next import starts from the first screen", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  clearImportSession({ storage });
  assert.equal(storage.map.size, 0);
  assert.equal(loadImportSession({ storage }), null);
});

// --- expiry -------------------------------------------------------------------

test("a session past the server's TTL is refused and swept up", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  const now = SESSION.startedAt + IMPORT_SESSION_TTL_MS + 1;
  assert.equal(loadImportSession({ storage, now }), null);
  // Deleted, not merely hidden, so it is not re-parsed on every mount.
  assert.equal(storage.map.size, 0);
});

test("a session inside the TTL is still offered, right up to the boundary", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  const atBoundary = SESSION.startedAt + IMPORT_SESSION_TTL_MS;
  assert.equal(loadImportSession({ storage, now: atBoundary })?.sessionId, SESSION.sessionId);
});

test("the TTL is overridable, so it can follow whatever the server advertises", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  const now = SESSION.startedAt + 61_000;
  assert.equal(loadImportSession({ storage, now, ttlMs: 60_000 }), null);
});

// --- entries that cannot be trusted ------------------------------------------

test("unparseable JSON is discarded instead of crashing the page on mount", () => {
  const storage = fakeStore({ [STORAGE_KEY]: "{not json" });
  assert.equal(loadImportSession({ storage }), null);
  assert.equal(storage.map.size, 0);
});

test("a shape from an older release is discarded rather than half-resumed", () => {
  // uploadedChunks as null is the one that matters: it reaches missingChunks()
  // and throws inside a mount effect, and the admin cannot get past the screen.
  const broken = {
    ...SESSION,
    files: { members: { ...MEMBERS, uploadedChunks: null } },
  };
  const storage = fakeStore({ [STORAGE_KEY]: JSON.stringify(broken) });
  assert.equal(loadImportSession({ storage }), null);
  assert.equal(storage.map.size, 0);
});

test("isImportSession rejects each missing piece on its own", () => {
  assert.equal(isImportSession(SESSION), true);
  assert.equal(isImportSession({ ...SESSION, sessionId: "" }), false);
  assert.equal(isImportSession({ ...SESSION, branchId: "2" }), false);
  assert.equal(isImportSession({ ...SESSION, hasHeaderRow: "yes" }), false);
  assert.equal(isImportSession({ ...SESSION, dateFormat: null }), false);
  assert.equal(isImportSession({ ...SESSION, chunkSize: "1mb" }), false);
  assert.equal(isImportSession({ ...SESSION, startedAt: undefined }), false);
  assert.equal(isImportSession({ ...SESSION, productMap: null }), false);
  // A product label mapped to a name instead of an id imports every loan under
  // the wrong product, so it is not a shape to be lenient about.
  assert.equal(isImportSession({ ...SESSION, productMap: { SALARY: "4" } }), false);
  assert.equal(isImportSession({ ...SESSION, files: null }), false);
  assert.equal(isImportSession(null), false);
  assert.equal(isImportSession("imp_9f3c2b"), false);
});

// --- storage that fights back -------------------------------------------------

// localStorage does not merely return null when it is unavailable — it throws
// (Safari lockdown, an in-app browser with storage blocked). The import has to
// keep working without a resume; it must never fail to start.
const hostile: SessionStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

test("a store that throws on getItem degrades to 'no resume', not to a crash", () => {
  assert.doesNotThrow(() => loadImportSession({ storage: hostile }));
  assert.equal(loadImportSession({ storage: hostile }), null);
});

test("a store that throws on setItem still lets the import run", () => {
  assert.doesNotThrow(() => saveImportSession(SESSION, { storage: hostile }));
  assert.doesNotThrow(() => record(SESSION, "members", 0, { storage: hostile }));
  // The in-memory session is still correct — only the crash-recovery path is lost.
  const updated = record(SESSION, "members", 0, { storage: hostile });
  assert.deepEqual(updated.files.members.uploadedChunks, [0]);
});

test("a store that throws on removeItem does not break cancelling an import", () => {
  assert.doesNotThrow(() => clearImportSession({ storage: hostile }));
});

test("no storage at all (SSR, or a blocked window.localStorage) is inert", () => {
  assert.equal(loadImportSession({ storage: null }), null);
  assert.doesNotThrow(() => saveImportSession(SESSION, { storage: null }));
  assert.doesNotThrow(() => clearImportSession({ storage: null }));
});

// --- the file identity guard --------------------------------------------------

const PICKED = { name: "binhs-members.csv", size: 6144, lastModified: 1_756_000_000_000 };

test("the same file re-picked from disk resumes", () => {
  assert.equal(sameFile(MEMBERS, PICKED), true);
});

test("a different name is refused", () => {
  assert.equal(sameFile(MEMBERS, { ...PICKED, name: "binhs-members (1).csv" }), false);
});

test("a different size is refused", () => {
  assert.equal(sameFile(MEMBERS, { ...PICKED, size: 6145 }), false);
});

// The one the other two miss: the same file, edited in place to fix a typo,
// same name and coincidentally the same length. Resuming it appends new bytes
// to old chunks and the server assembles a CSV that parses into garbage rows.
test("a different lastModified is refused, even with the name and size unchanged", () => {
  assert.equal(sameFile(MEMBERS, { ...PICKED, lastModified: 1_756_000_000_001 }), false);
});

test("a missing side is refused rather than treated as a match", () => {
  assert.equal(sameFile(MEMBERS, null), false);
  assert.equal(sameFile(null, PICKED), false);
  assert.equal(sameFile(undefined, undefined), false);
});

test("a real File satisfies the identity shape without a DOM", () => {
  const file = new File(["member_no,name\n1,Dela Cruz\n"], "binhs-members.csv", {
    lastModified: 1_756_000_000_000,
  });
  assert.equal(sameFile({ ...MEMBERS, size: file.size }, file), true);
  assert.equal(sameFile(MEMBERS, file), false); // size differs from the stored 6144
});

// --- chunk bookkeeping --------------------------------------------------------

test("each acknowledged chunk is persisted immediately, not batched", () => {
  const storage = fakeStore();
  let session = SESSION;
  saveImportSession(session, { storage });
  session = record(session, "loans", 0, { storage });
  // Whatever is on disk at this instant is what a crash right here would leave.
  const onDisk = loadImportSession({ storage, now: SESSION.startedAt })!;
  assert.deepEqual(onDisk.files.loans.uploadedChunks, [0]);
});

test("a chunk acknowledged twice is not counted twice", () => {
  const storage = fakeStore();
  const once = record(SESSION, "members", 0, { storage });
  const twice = record(once, "members", 0, { storage });
  assert.deepEqual(twice.files.members.uploadedChunks, [0]);
  assert.equal(twice, once, "an already-known chunk is a no-op");
});

test("out-of-order acknowledgements are kept ascending", () => {
  const storage = fakeStore();
  let session = SESSION;
  for (const index of [2, 0, 1]) session = record(session, "loans", index, { storage });
  assert.deepEqual(session.files.loans.uploadedChunks, [0, 1, 2]);
});

test("an unknown slot is left alone rather than invented", () => {
  const storage = fakeStore();
  const same = record(SESSION, "collaterals", 0, { storage });
  assert.equal(same, SESSION);
  assert.equal(storage.map.size, 0);
});

test("recording a chunk does not disturb the other file's progress", () => {
  const storage = fakeStore();
  const session = record(SESSION, "members", 0, { storage });
  assert.deepEqual(session.files.loans.uploadedChunks, []);
});

// --- the whole point ----------------------------------------------------------

test("a dropped connection mid-upload resumes at the gap, not from zero", () => {
  const storage = fakeStore();
  const file = {
    name: "binhs-loans.csv",
    size: 5 * IMPORT_CHUNK_SIZE,
    lastModified: 1_756_000_000_000,
  };
  const plan = planChunks(file);
  assert.equal(plan.totalChunks, 5);

  let session: ImportSession = {
    ...SESSION,
    files: { loans: { ...file, totalChunks: plan.totalChunks, uploadedChunks: [] } },
  };
  saveImportSession(session, { storage });
  for (const index of [0, 1, 2]) session = record(session, "loans", index, { storage });

  // ...the link drops and the tab is closed. Nothing is left but the store.
  const resumed = loadImportSession({ storage, now: SESSION.startedAt + 5000 })!;
  assert.ok(sameFile(resumed.files.loans, file), "the admin re-picked the same file");
  assert.deepEqual(missingChunks(plan, resumed.files.loans.uploadedChunks), [3, 4]);
  // And the answers came back with it, so nothing is re-asked.
  assert.equal(resumed.branchId, 2);
  assert.equal(resumed.dateFormat, "dd/MM/yyyy");
  assert.deepEqual(resumed.productMap, SESSION.productMap);
});

test("resuming a different file into a half-uploaded session is refused", () => {
  const storage = fakeStore();
  saveImportSession(SESSION, { storage });
  const resumed = loadImportSession({ storage, now: SESSION.startedAt })!;
  const wrongFile = { name: "binhs-members-v2.csv", size: 6144, lastModified: 1_756_000_000_000 };
  assert.equal(sameFile(resumed.files.members, wrongFile), false);
});

// --- the resume guard ---------------------------------------------------------
//
// A landed chunk index names a byte range relative to BOTH the file it was cut
// from and the size it was cut with. sameFile covers the first. These cover the
// second, which nothing else would have caught: the file is identical, so every
// other check passes, and the indices silently point at the wrong bytes.

test("the same file and the same advertised chunk size resumes at the gap", () => {
  const session = { ...SESSION, files: { members: { ...MEMBERS, uploadedChunks: [0, 1] } } };
  assert.deepEqual(resumableChunks(session, "members", PICKED, session.chunkSize), [0, 1]);
});

test("a server that re-advertises a different chunk size invalidates the landed set", () => {
  const session = { ...SESSION, files: { members: { ...MEMBERS, uploadedChunks: [0, 1] } } };
  assert.deepEqual(resumableChunks(session, "members", PICKED, 256 * 1024), []);
  assert.deepEqual(resumableChunks(session, "members", PICKED, MAX_IMPORT_CHUNK_SIZE), []);
});

test("a different file invalidates it too, through the same door", () => {
  const session = { ...SESSION, files: { members: { ...MEMBERS, uploadedChunks: [0, 1] } } };
  const renamed = { ...PICKED, name: "binhs-members (1).csv" };
  assert.deepEqual(resumableChunks(session, "members", renamed, session.chunkSize), []);
  assert.deepEqual(resumableChunks(session, "members", null, session.chunkSize), []);
});

test("an unknown slot yields nothing rather than throwing on mount", () => {
  assert.deepEqual(resumableChunks(SESSION, "collaterals", PICKED, SESSION.chunkSize), []);
});

// The comparison is between the sizes that would actually be USED, not the raw
// values, so JSON that happens to be a string still lines up with the plan.
test("the advertised size is normalised before comparing, on both sides", () => {
  const session = { ...SESSION, files: { members: { ...MEMBERS, uploadedChunks: [0] } } };
  // Junk resolves to the default, which is what this session was planned with.
  assert.deepEqual(resumableChunks(session, "members", PICKED, "524288"), [0]);
  assert.deepEqual(resumableChunks(session, "members", PICKED, null), [0]);
  // And two different oversized values both resolve to the ceiling, so they
  // agree with a session that was already planned at the ceiling.
  const clamped = {
    ...session,
    chunkSize: MAX_IMPORT_CHUNK_SIZE,
    files: { members: { ...MEMBERS, uploadedChunks: [0] } },
  };
  assert.deepEqual(resumableChunks(clamped, "members", PICKED, 50 * 1024 * 1024), [0]);
  assert.deepEqual(resumableChunks(clamped, "members", PICKED, 20 * 1024 * 1024), [0]);
});

test("the caller gets a copy, so a resume cannot mutate the stored record", () => {
  const session = { ...SESSION, files: { members: { ...MEMBERS, uploadedChunks: [0] } } };
  const landed = resumableChunks(session, "members", PICKED, session.chunkSize);
  landed.push(99);
  assert.deepEqual(session.files.members.uploadedChunks, [0]);
});

test("on drift the upload restarts from zero rather than corrupting the file", () => {
  const file = {
    name: "binhs-loans.csv",
    size: 5 * IMPORT_CHUNK_SIZE,
    lastModified: 1_756_000_000_000,
  };
  // Three of five chunks are in: 1.5 MiB of a 2.5 MiB file.
  const session: ImportSession = {
    ...SESSION,
    chunkSize: IMPORT_CHUNK_SIZE,
    files: { loans: { ...file, totalChunks: 5, uploadedChunks: [0, 1, 2] } },
  };

  // The server now advertises 768 KiB instead, so the same file is 4 chunks and
  // the stored indices 0,1,2 point at bytes that no longer line up. A plain
  // literal, not a constant: the point is "a different size", and pinning it to
  // whichever cap is nearest today would make this test drift with the caps.
  const advertised = 768 * 1024;
  const plan = planChunks(file, advertised);
  assert.equal(plan.totalChunks, 4);

  const landed = resumableChunks(session, "loans", file, advertised);
  assert.deepEqual(landed, [], "the landed set is discarded, not translated");
  assert.deepEqual(missingChunks(plan, landed), [0, 1, 2, 3]);

  // Reading the field directly is the bug this function exists to make hard: it
  // claims 3 of 4 chunks are done and sends only the last one, leaving a file
  // stitched from two different chunkings.
  assert.deepEqual(missingChunks(plan, session.files.loans.uploadedChunks), [3]);
});
