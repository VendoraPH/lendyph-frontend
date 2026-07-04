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

  loanList: (loanId: number) =>
    api.get<Document[]>(API_ENDPOINTS.DOCUMENTS.LOAN_LIST(loanId)),

  loanUpload: (loanId: number, formData: FormData) =>
    api.upload<Document>(API_ENDPOINTS.DOCUMENTS.LOAN_UPLOAD(loanId), formData),

  detail: (id: number) =>
    api.get<Document>(API_ENDPOINTS.DOCUMENTS.DETAIL(id)),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.DOCUMENTS.DELETE(id)),
};
