import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField, fieldAria } from "@/components/portal/form-field";
import { CIVIL_STATUS, NONE } from "@/lib/portal/labels";
import type { FormErrors, ProfileForm } from "@/lib/portal/request-forms";
import type { RequestOptions } from "@/lib/portal/types";

/** A profile change: only the fields the member fills in are sent; the current values show masked. */
export function ProfileFields({
  form,
  onChange,
  options,
  errors,
}: {
  form: ProfileForm;
  onChange: (form: ProfileForm) => void;
  options: RequestOptions;
  errors: FormErrors;
}) {
  if (options.profile_fields.length === 0) {
    return <p className="text-sm text-muted-foreground">Profile changes can&apos;t be requested here right now. Please visit your branch.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Fill in only what changed. Your branch checks each change before it&apos;s saved.</p>
      {options.profile_fields.map((field) => {
        const id = `pf-${field.field}`;
        const value = form[field.field] ?? "";
        const set = (next: string) => onChange({ ...form, [field.field]: next });
        return (
          <FormField key={field.field} id={id} label={field.label} hint={`Now: ${field.current ?? NONE}`} error={errors[field.field]}>
            {field.field === "civil_status" ? (
              <NativeSelect id={id} className="w-full" value={value} onChange={(e) => set(e.target.value)} {...fieldAria(id, errors[field.field], true)}>
                <NativeSelectOption value="">No change</NativeSelectOption>
                {Object.entries(CIVIL_STATUS).map(([key, label]) => (
                  <NativeSelectOption key={key} value={key}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input
                id={id}
                type={field.field === "email" ? "email" : field.field === "contact_number" ? "tel" : "text"}
                maxLength={255}
                value={value}
                onChange={(e) => set(e.target.value)}
                {...fieldAria(id, errors[field.field], true)}
              />
            )}
          </FormField>
        );
      })}
      {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}
    </div>
  );
}
