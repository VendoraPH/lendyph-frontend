# Integrate All API Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate every endpoint from `docs/API_ENDPOINTS.md` into `api-endpoints.ts` config and corresponding service files, matching the existing codebase patterns.

**Architecture:** Each API section gets endpoints in `src/config/api-endpoints.ts` and a service file in `src/services/`. Services use the `api` client from `@/lib/api-client` and reference `API_ENDPOINTS` constants. New services are re-exported from `src/services/index.ts`.

**Tech Stack:** TypeScript, Axios (via `@/lib/api-client`)

---

## File Structure

- **Modify:** `src/config/api-endpoints.ts` — add missing endpoint paths
- **Modify:** `src/services/borrower.service.ts` — add deactivate, reactivate, uploadPhoto, deletePhoto
- **Modify:** `src/services/loan.service.ts` — add amortizationPreview, submit, void; fix HTTP methods
- **Modify:** `src/services/branch.service.ts` — add detail, create, update; use API_ENDPOINTS
- **Modify:** `src/services/role.service.ts` — already fixed (detail added)
- **Modify:** `src/services/auth.service.ts` — add refresh
- **Create:** `src/services/co-maker.service.ts` — all 5 co-maker endpoints
- **Create:** `src/services/document.service.ts` — all 6 document endpoints
- **Create:** `src/services/loan-product.service.ts` — all 5 loan-product endpoints
- **Modify:** `src/services/index.ts` — re-export new services

---

### Task 1: Update `api-endpoints.ts` with all missing endpoints

**Files:**
- Modify: `src/config/api-endpoints.ts`

- [ ] **Step 1: Add missing BORROWERS endpoints**

Add to the BORROWERS block:
```ts
DEACTIVATE: (id: number) => `/borrowers/${id}/deactivate`,
REACTIVATE: (id: number) => `/borrowers/${id}/reactivate`,
UPLOAD_PHOTO: (id: number) => `/borrowers/${id}/photo`,
DELETE_PHOTO: (id: number) => `/borrowers/${id}/photo`,
```

- [ ] **Step 2: Add CO_MAKERS section**

```ts
CO_MAKERS: {
  LIST: (borrowerId: number) => `/borrowers/${borrowerId}/co-makers`,
  CREATE: (borrowerId: number) => `/borrowers/${borrowerId}/co-makers`,
  DETAIL: (id: number) => `/co-makers/${id}`,
  UPDATE: (id: number) => `/co-makers/${id}`,
  DELETE: (id: number) => `/co-makers/${id}`,
},
```

- [ ] **Step 3: Add DOCUMENTS section**

```ts
DOCUMENTS: {
  BORROWER_LIST: (borrowerId: number) => `/borrowers/${borrowerId}/documents`,
  BORROWER_UPLOAD: (borrowerId: number) => `/borrowers/${borrowerId}/documents`,
  CO_MAKER_LIST: (coMakerId: number) => `/co-makers/${coMakerId}/documents`,
  CO_MAKER_UPLOAD: (coMakerId: number) => `/co-makers/${coMakerId}/documents`,
  DETAIL: (id: number) => `/documents/${id}`,
  DELETE: (id: number) => `/documents/${id}`,
},
```

- [ ] **Step 4: Add LOAN_PRODUCTS section**

```ts
LOAN_PRODUCTS: {
  LIST: "/loan-products",
  CREATE: "/loan-products",
  DETAIL: (id: number) => `/loan-products/${id}`,
  UPDATE: (id: number) => `/loan-products/${id}`,
  DELETE: (id: number) => `/loan-products/${id}`,
},
```

- [ ] **Step 5: Add missing LOANS endpoints**

Add to the LOANS block:
```ts
AMORTIZATION_PREVIEW: (id: number) => `/loans/${id}/amortization-preview`,
SUBMIT: (id: number) => `/loans/${id}/submit`,
VOID: (id: number) => `/loans/${id}/void`,
```

- [ ] **Step 6: Add SYSTEM section**

```ts
SYSTEM: {
  HEALTH: "/health",
},
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/config/api-endpoints.ts
git commit -m "feat: add all missing API endpoint paths from documentation"
```

---

### Task 2: Add missing borrower service methods

**Files:**
- Modify: `src/services/borrower.service.ts`

- [ ] **Step 1: Add deactivate, reactivate, uploadPhoto, deletePhoto methods**

Add after `delete`:
```ts
deactivate: (id: number) =>
  api.patch<Borrower>(API_ENDPOINTS.BORROWERS.DEACTIVATE(id)),

reactivate: (id: number) =>
  api.patch<Borrower>(API_ENDPOINTS.BORROWERS.REACTIVATE(id)),

uploadPhoto: (id: number, formData: FormData) =>
  api.upload<Borrower>(API_ENDPOINTS.BORROWERS.UPLOAD_PHOTO(id), formData),

deletePhoto: (id: number) =>
  api.delete(API_ENDPOINTS.BORROWERS.DELETE_PHOTO(id)),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/borrower.service.ts
git commit -m "feat: add deactivate, reactivate, photo upload/delete to borrower service"
```

---

### Task 3: Add missing loan service methods and fix HTTP methods

**Files:**
- Modify: `src/services/loan.service.ts`

- [ ] **Step 1: Fix HTTP methods for approve/reject/release (should be PATCH not POST per docs) and add amortizationPreview, submit, void**

Replace approve/reject/release and add new methods:
```ts
approve: (id: number, data?: { approval_remarks?: string }) =>
  api.patch<Loan>(API_ENDPOINTS.LOANS.APPROVE(id), data),

reject: (id: number, data?: { approval_remarks?: string }) =>
  api.patch<Loan>(API_ENDPOINTS.LOANS.REJECT(id), data),

release: (id: number) =>
  api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id)),

amortizationPreview: (id: number) =>
  api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.AMORTIZATION_PREVIEW(id)),

submit: (id: number) =>
  api.patch<Loan>(API_ENDPOINTS.LOANS.SUBMIT(id)),

void: (id: number) =>
  api.patch<Loan>(API_ENDPOINTS.LOANS.VOID(id)),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/loan.service.ts
git commit -m "feat: add submit, void, amortization-preview and fix HTTP methods in loan service"
```

---

### Task 4: Complete branch service

**Files:**
- Modify: `src/services/branch.service.ts`

- [ ] **Step 1: Add imports, update interface, add detail/create/update methods**

Replace entire file content:
```ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export interface ApiBranch {
  id: number;
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
  is_active: boolean;
}

export interface CreateBranchData {
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
}

export interface UpdateBranchData {
  name?: string;
  code?: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}

export const branchService = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiBranch[]>(API_ENDPOINTS.BRANCHES.LIST, { params }),

  detail: (id: number) =>
    api.get<ApiBranch>(API_ENDPOINTS.BRANCHES.DETAIL(id)),

  create: (data: CreateBranchData) =>
    api.post<ApiBranch>(API_ENDPOINTS.BRANCHES.CREATE, data),

  update: (id: number, data: UpdateBranchData) =>
    api.put<ApiBranch>(API_ENDPOINTS.BRANCHES.UPDATE(id), data),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/branch.service.ts
git commit -m "feat: complete branch service with detail, create, update methods"
```

---

### Task 5: Add auth refresh method

**Files:**
- Modify: `src/services/auth.service.ts`

- [ ] **Step 1: Add refresh method**

Add after `me`:
```ts
refresh: () =>
  api.post<{ token: string }>(API_ENDPOINTS.AUTH.REFRESH),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/auth.service.ts
git commit -m "feat: add refresh token method to auth service"
```

---

### Task 6: Create co-maker service

**Files:**
- Create: `src/services/co-maker.service.ts`

- [ ] **Step 1: Create the service file**

```ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { CoMaker } from "@/types";

export interface CreateCoMakerData {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  address?: string;
  contact_number?: string;
  occupation?: string;
  employer?: string;
  monthly_income?: number;
  relationship_to_borrower?: string;
}

export interface UpdateCoMakerData extends Partial<CreateCoMakerData> {
  status?: "active" | "inactive";
}

export const coMakerService = {
  list: (borrowerId: number) =>
    api.get<CoMaker[]>(API_ENDPOINTS.CO_MAKERS.LIST(borrowerId)),

  create: (borrowerId: number, data: CreateCoMakerData) =>
    api.post<CoMaker>(API_ENDPOINTS.CO_MAKERS.CREATE(borrowerId), data),

  detail: (id: number) =>
    api.get<CoMaker>(API_ENDPOINTS.CO_MAKERS.DETAIL(id)),

  update: (id: number, data: UpdateCoMakerData) =>
    api.put<CoMaker>(API_ENDPOINTS.CO_MAKERS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.CO_MAKERS.DELETE(id)),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/co-maker.service.ts
git commit -m "feat: create co-maker service with all 5 endpoints"
```

---

### Task 7: Create document service

**Files:**
- Create: `src/services/document.service.ts`

- [ ] **Step 1: Create the service file**

```ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export interface Document {
  id: number;
  type: string;
  label?: string;
  url: string;
  created_at: string;
}

export const documentService = {
  borrowerList: (borrowerId: number) =>
    api.get<Document[]>(API_ENDPOINTS.DOCUMENTS.BORROWER_LIST(borrowerId)),

  borrowerUpload: (borrowerId: number, formData: FormData) =>
    api.upload<Document>(API_ENDPOINTS.DOCUMENTS.BORROWER_UPLOAD(borrowerId), formData),

  coMakerList: (coMakerId: number) =>
    api.get<Document[]>(API_ENDPOINTS.DOCUMENTS.CO_MAKER_LIST(coMakerId)),

  coMakerUpload: (coMakerId: number, formData: FormData) =>
    api.upload<Document>(API_ENDPOINTS.DOCUMENTS.CO_MAKER_UPLOAD(coMakerId), formData),

  detail: (id: number) =>
    api.get<Document>(API_ENDPOINTS.DOCUMENTS.DETAIL(id)),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.DOCUMENTS.DELETE(id)),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/document.service.ts
git commit -m "feat: create document service with all 6 endpoints"
```

---

### Task 8: Create loan-product service

**Files:**
- Create: `src/services/loan-product.service.ts`

- [ ] **Step 1: Create the service file**

```ts
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { LoanProduct } from "@/types";

export interface CreateLoanProductData {
  name: string;
  interest_rate: number;
  interest_method: "straight" | "diminishing" | "upon_maturity";
  term: number;
  frequency: "daily" | "weekly" | "semi_monthly" | "monthly";
  processing_fee?: number;
  service_fee?: number;
  penalty_rate?: number;
  grace_period_days?: number;
  min_amount?: number;
  max_amount?: number;
}

export type UpdateLoanProductData = Partial<CreateLoanProductData>;

export const loanProductService = {
  list: (params?: Record<string, unknown>) =>
    api.get<LoanProduct[]>(API_ENDPOINTS.LOAN_PRODUCTS.LIST, { params }),

  detail: (id: number) =>
    api.get<LoanProduct>(API_ENDPOINTS.LOAN_PRODUCTS.DETAIL(id)),

  create: (data: CreateLoanProductData) =>
    api.post<LoanProduct>(API_ENDPOINTS.LOAN_PRODUCTS.CREATE, data),

  update: (id: number, data: UpdateLoanProductData) =>
    api.put<LoanProduct>(API_ENDPOINTS.LOAN_PRODUCTS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.LOAN_PRODUCTS.DELETE(id)),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/loan-product.service.ts
git commit -m "feat: create loan-product service with all 5 endpoints"
```

---

### Task 9: Update services index and final verification

**Files:**
- Modify: `src/services/index.ts`

- [ ] **Step 1: Add new service re-exports**

Add these lines:
```ts
export { coMakerService } from "./co-maker.service";
export { documentService } from "./document.service";
export { loanProductService } from "./loan-product.service";
export { auditService } from "./audit.service";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/services/index.ts
git commit -m "feat: export all new services from index"
```
