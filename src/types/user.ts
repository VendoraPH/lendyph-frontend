import type { Role, Permission } from "./rbac";

export type UserStatus = "active" | "inactive";

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  mobile: string;
  role: Role;
  branch: string;
  status: UserStatus;
  permissions?: Permission[];
  avatar?: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
}
