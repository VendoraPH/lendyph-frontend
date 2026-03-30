export interface Borrower {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  province?: string;
  valid_id_type?: string;
  valid_id_number?: string;
  photo?: string;
  status: "active" | "inactive" | "blacklisted";
  total_loans: number;
  total_outstanding: number;
  created_at: string;
  updated_at: string;
}
