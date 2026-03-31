import type { ValidIdType } from "./borrower";

export type CoMakerRelationship =
  | "spouse"
  | "parent"
  | "sibling"
  | "relative"
  | "friend"
  | "colleague"
  | "other";

export interface CoMaker {
  id: number;
  co_maker_code: string;
  borrower_id: number;
  loan_id: number;
  full_name: string;
  relationship: CoMakerRelationship;
  phone: string;
  address?: string;
  occupation?: string;
  employer?: string;
  monthly_income?: number;
  valid_id_type?: ValidIdType;
  valid_id_number?: string;
  valid_id_photo?: string;
  photo?: string;
  created_at: string;
}
