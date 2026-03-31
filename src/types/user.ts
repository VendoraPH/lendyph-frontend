import type { Permission } from "./rbac";

export type UserStatus = "active" | "inactive";

export interface UserBranch {
  id: number;
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  email: string;
  mobile_number?: string | null;
  status: UserStatus;
  last_login_at?: string | null;
  branch?: UserBranch | null;
  roles: string[];
  permissions: Permission[];
  avatar?: string | null;
  created_at: string;
  updated_at: string;
}
