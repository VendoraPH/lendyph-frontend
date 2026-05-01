# Backend Issues — Pending Resolution

Issues blocked on backend fixes. Will revisit once backend resolves.

---

## 1. Borrower document images return 404 from `/storage/...`

**Status:** Open — waiting on backend fix
**Reported:** 2026-05-01
**Affects:** Document preview modal in borrower details page (`/borrowers/[id]` → Documents tab)
**Frontend branch:** `feat/document-preview-modal`

### Problem

`GET /api/borrowers/{id}/documents` returns documents whose `url` field points to files that don't exist on the storage server.

### Failing URL example

```
https://api-lendyph.abedubas.dev/storage/documents/valid_id/borrower/3/iW9j7M7PtWFbIEk85M8qzuxbsBBzNkQDRys4I27S.png
```

Response: `404 Not Found` (HTML error page, `content-type: text/html`)

### Reproduction

1. Open `https://api-lendyph.abedubas.dev/api/borrowers/3/documents`
2. Take any `url` field from the response
3. Open that URL in a browser → 404

### Frontend status

Frontend is working correctly:
- Renders the URL as returned by the API
- `next.config.ts` has `api-lendyph.abedubas.dev/storage/**` in `images.remotePatterns`
- Uses Next.js `<Image>` with `unoptimized` for arbitrary user uploads
- The 404 is from the storage server, not from the frontend app

### Concerns raised to backend

1. **`valid_id` literal string in path** — path contains `/documents/valid_id/borrower/3/...`. Looks like the upload code is saving the placeholder string `valid_id` instead of an actual ID.
2. **`php artisan storage:link`** — confirm this has been run on the server.
3. **File existence on disk** — DB record may exist while the actual file is missing on storage.
4. **Nginx config** — confirm `/storage/*` is served properly (test with a known-good file).
5. **`FILESYSTEM_DISK` config** — if using S3/cloud, confirm disk URL config matches upload code.

### Awaiting from backend

- A working sample document URL to test against
- Confirmation of root cause
- Fix on the upload pipeline so future uploads return URLs that actually serve the file

### Resume work when

- Backend confirms a working URL pattern
- Then verify modal end-to-end with real document images
