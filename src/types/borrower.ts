export type CivilStatus = "single" | "married" | "widowed" | "separated" | "divorced";
export type Gender = "male" | "female";
export type BorrowerStatus = "active" | "inactive" | "blacklisted";
export type EmploymentType = "employed" | "self_employed" | "ofw" | "unemployed" | "retired";

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

export interface Borrower {
  id: number;
  borrower_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  suffix?: string;
  birthdate: string;
  civil_status: CivilStatus;
  gender: Gender;
  email?: string;
  phone: string;
  address?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zip_code?: string;
  employer_or_business?: string;
  employment_type?: EmploymentType;
  monthly_income?: number;
  valid_id_type?: ValidIdType;
  valid_id_number?: string;
  valid_id_photo?: string;
  photo?: string;
  status: BorrowerStatus;
  total_loans: number;
  total_outstanding: number;
  created_at: string;
  updated_at: string;
}
