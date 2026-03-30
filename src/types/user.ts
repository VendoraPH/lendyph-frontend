import type { Role, Permission } from "./rbac";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  permissions?: Permission[];
  avatar?: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
}
