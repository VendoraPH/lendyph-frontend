import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { LoanDisclosure, LoanPromissoryNote } from "@/types";

export const loanDocumentService = {
  disclosure: (loanId: number) =>
    api.get<LoanDisclosure>(API_ENDPOINTS.LOAN_DOCUMENTS.DISCLOSURE(loanId)),

  promissoryNote: (loanId: number) =>
    api.get<LoanPromissoryNote>(API_ENDPOINTS.LOAN_DOCUMENTS.PROMISSORY_NOTE(loanId)),
};
