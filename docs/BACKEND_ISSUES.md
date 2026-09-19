# Backend Issues — Pending Resolution

Issues blocked on backend fixes. Will revisit once backend resolves.

---

## 1. Borrower document images return 404 from `/storage/...`

**Status:** Resolved — verified 2026-06-11
**Reported:** 2026-05-01
**Affects:** Document preview modal in borrower details page (`/borrowers/[id]` → Documents tab)
**Frontend branch:** `feat/document-preview-modal`

### Problem

`GET /api/borrowers/{id}/documents` returned documents whose `url` field pointed to files that 404'd on the storage server.

### Example URL (previously failing, now serving)

```
https://api-lendyph.abedubas.dev/storage/documents/valid_id/borrower/3/iW9j7M7PtWFbIEk85M8qzuxbsBBzNkQDRys4I27S.png
```

Response as of 2026-06-11: `200 OK`, `content-type: image/png`.

### Root cause

The `public/storage` symlink was missing on the VPS. The backend deploy workflow
now runs `php artisan storage:link --force` on every deploy
(`backend/.github/workflows/deploy.yml`), which fixed the existing URLs. The
`valid_id` segment in the path is the document *type* folder
(`documents/{type}/borrower/{id}/…`), not a placeholder bug.

### Resume work

Unblocked — the in-app document preview modal for the Documents tab can be
implemented and verified end-to-end against real document images.

---

## 2. `GET /credit-scoring/score-history` rows carry no borrower name

**Status:** Decided 2026-09-19 — frontend shipped, waiting on the field
**Reported:** 2026-09-19
**Affects:** Borrower column on `/credit-scoring/score-history`, and Recent Score Changes on the `/credit-scoring` dashboard
**Frontend branch:** `fix/credit-scoring-polish`

### Problem

`CreditScoreHistoryEntry` (`src/types/credit-scoring.ts`) had no `borrower_name`, so both screens
that render it printed a literal `Borrower #123` where staff expect a person. The sibling types on
the same endpoints — `CreditScore`, `BorrowerScoreRow`, `RiskAlert` — all carry `borrower_name`
already, so the gap was in this one type, not in the contract's vocabulary.

`docs/CREDIT_SCORING_BACKEND_HANDOFF.md` (endpoint 5) posed this as a question for the backend:
*"If adding `borrower_name` is cheap, propose it … Do not add it silently."*

### Root cause

Not a backend defect — the Credit Scoring backend does not exist yet; all 11 endpoints 404. The
question had no second party to answer it, because we are the backend. It was left open and read
as blocked.

### Decision

`borrower_name` is **in the contract, optional on the wire**. The backend must resolve the name
server-side and send it on endpoint 5, on `recent_score_changes` in endpoint 1, and on endpoint 4 —
all three carry this same type. Use the same name the borrower resource sends (`full_name`).

The frontend must **not** join it client-side via `borrowerService.listAll()`; that drains the whole
borrower portfolio to label one table.

Frontend side is done: the field is on the type, and both cells render through `borrowerLabel()`
(`src/lib/credit-scoring/borrower-label.ts`) — the house fallback chain from
`src/app/(app)/share-capital/ledger/page.tsx:92`, narrowed to the two fields a score row carries.
It keeps `Borrower #{borrower_id}` as the last resort and treats a blank name as absent, so a
backend that never sends the field renders exactly what it renders today.

### Resume work

Nothing blocked. When the endpoints land with `borrower_name`, both screens pick it up with no
frontend change — verify the Borrower column shows names, and that a row with the field missing
still shows the id rather than an empty cell.

---

## 3. `PUT /credit-scoring/settings` must reject a write to `score_model_version`

**Status:** Decided 2026-09-19 — frontend shipped, backend rule pending
**Reported:** 2026-09-19
**Affects:** `/credit-scoring/settings` — the Score Model Version card and its Save
**Frontend branch:** `fix/credit-scoring-polish`

### Problem

The Settings page rendered `score_model_version` as an editable `<Input>`, inviting staff to type a
new model version into a field that nothing downstream honours. The design spec
(`docs/superpowers/specs/2026-09-15-credit-scoring-design.md:271`) calls it a *"current model
version display (read-only)"*, and its own versioning rule (`:289`) has the value *"stamped at
calculation time, immutable per history row"* — endpoints 3 and 5 both return it per score.

`docs/CREDIT_SCORING_BACKEND_HANDOFF.md` (endpoint 11) posed this as a question for the backend:
*"reject writes to it with a 422 and tell us, so the input can be made read-only."*

### Root cause

Same as #2 — no second party to answer, so the question sat open. The editable input was UI
scaffolding that outlived the spec it was built from, not a decision anyone made.

### Decision

The field is **immutable and backend-owned**. It changes when a scoring model is deployed, not when
a member of staff edits settings.

Frontend side is done: the card now renders the version as plain text beside the Confidence and
Hard Flag definition cards it sits with, and `handleSave` **omits the key from the PUT body**.
Making the input read-only alone would not have been enough — `handleSave` PUTs the entire `current`
object, so the value went on the wire whether or not anyone touched it. `updateSettings` is typed
`Partial<CreditScoringSettings>`, so an absent key is already in contract.

The backend must:

1. Keep returning `score_model_version` on `GET` and in the `PUT` response.
2. **Not** mark it `required` on the PUT validator — this app no longer sends it, and a `required`
   rule would 422 every save from the Settings page.
3. **422 any request body that does carry the key** (`score_model_version: ["This field is
   read-only."]`), rather than silently accepting and discarding the write.

### Resume work

Nothing blocked. When the endpoint lands, verify a save from the Settings page succeeds with the key
absent, and that a hand-rolled PUT including the key comes back 422 rather than 200.
