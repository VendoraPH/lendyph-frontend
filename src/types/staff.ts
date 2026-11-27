/**
 * One row of `GET /staff`: an active user as the Account Officer pickers need
 * them, and nothing else. `full_name` is the same accessor a loan returns for
 * `account_officer.full_name`, so a picked row and a loan's current officer
 * render identically.
 */
export interface StaffMember {
  id: number;
  full_name: string;
}
