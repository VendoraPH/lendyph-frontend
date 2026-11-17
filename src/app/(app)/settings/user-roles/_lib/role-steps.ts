/**
 * The role dialog's steps (Arvin, 2026-11-17: long forms become steps):
 * Details (name and description), then Permissions (the module grid).
 *
 * The checks are the save's own, in its order, split by step. A step reports
 * one problem: the missing fields (one "Please complete" toast, as before) or
 * one message (its own toast, as before).
 */

import type { FormStepDef, StepErrors } from "@/lib/form-stepper";
import { slugify } from "./role-item";

export const ROLE_STEPS: readonly FormStepDef[] = [
  { id: "details", title: "Details", fields: ["label", "description"] },
  { id: "permissions", title: "Permissions", fields: ["permissions"] },
];

export interface RoleStepInput {
  label: string;
  description: string;
  permissionCount: number;
  isEdit: boolean;
  /** The edited role's key; null on create. */
  roleKey: string | null;
  existingKeys: readonly string[];
}

export type RoleStepProblem =
  | { kind: "missing"; fields: { key: string; label: string }[] }
  | { kind: "message"; field: string; message: string }
  | null;

/** The first thing the save would refuse on this step, or null. */
export function roleStepProblem(stepId: string, input: RoleStepInput): RoleStepProblem {
  if (stepId === "details") {
    const missing: { key: string; label: string }[] = [];
    if (!input.label.trim()) missing.push({ key: "label", label: "Role name" });
    if (!input.description.trim()) missing.push({ key: "description", label: "Description" });
    if (missing.length > 0) return { kind: "missing", fields: missing };
    const key = input.isEdit && input.roleKey ? input.roleKey : slugify(input.label);
    if (!key) {
      return { kind: "message", field: "label", message: "Role name must contain at least one letter or number" };
    }
    if (!input.isEdit && input.existingKeys.includes(key)) {
      return { kind: "message", field: "label", message: `A role named "${input.label}" already exists` };
    }
    return null;
  }
  if (stepId === "permissions" && input.permissionCount === 0) {
    return { kind: "message", field: "permissions", message: "Select at least one permission" };
  }
  return null;
}

/** A problem as the stepper's errors: field key to message (a missing field reads its label). */
export function roleStepErrors(problem: RoleStepProblem): StepErrors {
  if (!problem) return {};
  if (problem.kind === "message") return { [problem.field]: problem.message };
  return Object.fromEntries(problem.fields.map((f) => [f.key, f.label]));
}

/**
 * A save's 422 field errors as the form names its fields: the key (`name`,
 * create only) and the display name (`display_name`) are both typed in the
 * one Role Name field (`label`).
 */
export function roleFormErrors(errors: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = key === "name" || key === "display_name" ? "label" : key;
    out[field] = [...(out[field] ?? []), ...messages];
  }
  return out;
}
