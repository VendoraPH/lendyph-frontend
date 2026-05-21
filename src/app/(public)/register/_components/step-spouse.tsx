// Spouse fields are rendered inline inside StepPersonal when civil_status
// is "married" (matching the admin /borrowers/new layout). This file now
// only exports the shared StepSpouseData type used by the parent page.

export interface StepSpouseData {
  spouse_first_name: string;
  spouse_middle_name: string;
  spouse_last_name: string;
  spouse_contact_number: string;
  spouse_occupation: string;
}
