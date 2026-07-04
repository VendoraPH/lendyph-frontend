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
