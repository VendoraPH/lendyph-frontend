import type { ValidIdType } from "./borrower";
import type { LoanStatus } from "./loan";

export type CoMakerRelationship =
  | "spouse"
  | "parent"
  | "sibling"
  | "relative"
  | "friend"
  | "colleague"
  | "other";

/** A loan a co-maker is on, as `GET /borrowers/{id}/co-makers` lists it. */
export interface CoMakerLoan {
  id: number;
  application_number: string;
  loan_account_number: string | null;
  status: LoanStatus;
}

export interface CoMaker {
  id: number;
  co_maker_code?: string;
  borrower_id?: number;
  /** The loans this co-maker is on; absent from payloads that predate it. */
  loans?: CoMakerLoan[];
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
