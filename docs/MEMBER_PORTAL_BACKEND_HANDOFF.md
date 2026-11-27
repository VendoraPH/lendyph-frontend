# Member Portal: where the API contract lives

The Member Portal's backend is built (lendyph-backend #287, #289 and #291), so
this file no longer describes a contract to build. The contract is the
backend's own OpenAPI documentation, served by its Swagger UI at
`/api/documentation` on any backend deployment, under the tags
"Member Portal" (the member side, `/api/portal/*`) and
"Member Portal (staff)" (`/api/portal-admin/*`).

In this repo:

- Staff side: `src/types/portal-admin.ts` (shapes) and
  `src/services/portal-admin.service.ts` (calls), used by
  `src/app/(app)/member-portal/`, the member page's portal access card and
  Settings → Member Portal.
- Member side: `src/lib/portal/` (its own client, token and endpoints), used
  by `src/app/member/`.

Where an earlier draft of this file (on #511–#514) and the backend disagree,
the backend wins.
