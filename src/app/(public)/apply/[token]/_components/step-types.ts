import type { WizardErrors } from "@/lib/loan-origination";
import type { ApplicationDraft } from "@/types/loan-origination";

/** What every data step receives: its slice of the draft, its errors, and a patcher. */
export interface StepProps<K extends keyof ApplicationDraft> {
  value: ApplicationDraft[K];
  errors: WizardErrors;
  onChange: (patch: Partial<ApplicationDraft[K]>) => void;
}
