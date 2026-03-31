import type { ValidIdType } from "./borrower";

export interface CoMaker {
  id: number;
  borrower_id: number;
  loan_id: number;
  full_name: string;
  relationship: string;
  phone: string;
  address?: string;
  valid_id_type?: ValidIdType;
  valid_id_number?: string;
  created_at: string;
}
