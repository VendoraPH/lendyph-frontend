import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { LoanProduct } from "@/types";

export interface CreateLoanProductData {
  name: string;
  min_interest_rate: number;
  max_interest_rate: number;
  interest_method: "straight" | "diminishing" | "upon_maturity";
  min_term: number;
  max_term: number;
  frequencies: string[];
  processing_fee?: number;
  service_fee?: number;
  notarial_fee?: number;
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
