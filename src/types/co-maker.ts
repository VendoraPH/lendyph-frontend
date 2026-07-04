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
  co_maker_code?: string;
  borrower_id?: number;
  loan_id?: number;
  // API returns individual name fields
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  full_name?: string;
  name?: string;
  // API returns relationship_to_borrower
  relationship_to_borrower?: string;
  relationship?: CoMakerRelationship;
  // API returns contact_number
  contact_number?: string;
  phone?: string;
  address?: string;
  occupation?: string;
  employer?: string;
  monthly_income?: number;
  valid_id_type?: ValidIdType;
  valid_id_number?: string;
  valid_id_photo?: string;
  photo?: string;
  status?: string;
  created_at?: string;
}
