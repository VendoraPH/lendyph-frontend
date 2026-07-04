export type CivilStatus = "single" | "married" | "widowed" | "separated" | "divorced";
export type Gender = "male" | "female";
export type BorrowerStatus = "active" | "inactive" | "blacklisted";
export type ValidIdType =
  | "philippine_id"
  | "drivers_license"
  | "passport"
  | "sss"
  | "umid"
  | "voters_id"
  | "postal_id"
  | "prc_id"
  | "tin_id";
export type EmploymentType = "employed" | "self_employed" | "ofw" | "unemployed" | "retired";

export interface BorrowerBranch {
  id: number;
  name: string;
  code: string;
}

export interface BorrowerLedgerEntry {
  id: number;
  date: string;
  type: "debit" | "credit";
  description: string;
  amount: number;
  running_balance: number;
  reference_id?: number;
  reference_type?: string;
}

export interface Borrower {
  id: number;
  borrower_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
  full_name: string;
  birthdate?: string | null;
  civil_status?: CivilStatus | null;
  gender?: Gender | null;
  address?: string | null;
  contact_number?: string | null;
  email?: string | null;
  employer_or_business?: string | null;
  monthly_income?: number | string | null;
  photo_url?: string | null;
  // The backend can also return "pending" for unapproved registrants on the
  // shared `/borrowers` list. UI code that consumes the members list should
  // filter pending records out — they belong on the Pending Registrations
  // tab. BorrowerStatus itself stays narrow so badge/filter maps that key
  // off it don't have to grow.
  status: BorrowerStatus | "pending";
  branch?: BorrowerBranch | null;
  // The list endpoint may return only the FK without the nested relation;
  // keep it so the table can resolve the branch name from the branches list.
  branch_id?: number | null;
  // Legacy fields (kept for compatibility with existing components)
  phone?: string;
  photo?: string;
  total_loans?: number;
  total_outstanding?: number;
  created_at: string;
  updated_at: string;
}
