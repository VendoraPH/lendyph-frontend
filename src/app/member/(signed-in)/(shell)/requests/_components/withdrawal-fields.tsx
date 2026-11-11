import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField, fieldAria } from "@/components/portal/form-field";
import { Money } from "@/components/portal/money";
import { PAYOUT_METHOD, labelOf } from "@/lib/portal/labels";
import type { FormErrors, WithdrawalForm } from "@/lib/portal/request-forms";
import type { RequestOptions } from "@/lib/portal/types";
import { plural } from "@/lib/portal/words";

/** A withdrawal: which account, how much (up to the server's withdrawable), and how to receive it. */
export function WithdrawalFields({
  form,
  onChange,
  options,
  errors,
}: {
  form: WithdrawalForm;
  onChange: (form: WithdrawalForm) => void;
  options: RequestOptions;
  errors: FormErrors;
}) {
  const set = (patch: Partial<WithdrawalForm>) => onChange({ ...form, ...patch });
  const account = options.withdrawal_accounts.find((a) => String(a.id) === form.account_id);

  if (options.withdrawal_accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">None of your savings accounts can be withdrawn from here. Please visit your branch.</p>;
  }

  return (
    <div className="space-y-4">
      <FormField
        id="wd-account"
        label="From account"
        error={errors.account_id}
        hint={account ? <>Can withdraw now: <Money value={account.withdrawable} /></> : undefined}
      >
        <NativeSelect
          id="wd-account"
          className="w-full"
          value={form.account_id}
          onChange={(e) => set({ account_id: e.target.value })}
          {...fieldAria("wd-account", errors.account_id, !!account)}
        >
          <NativeSelectOption value="">Choose an account</NativeSelectOption>
          {options.withdrawal_accounts.map((a) => (
            <NativeSelectOption key={a.id} value={String(a.id)} disabled={a.has_open_request}>
              {a.account_number}
              {a.product_name ? ` · ${a.product_name}` : ""}
              {a.has_open_request ? " (a request is already open)" : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="wd-amount" label="Amount (₱)" error={errors.amount}>
        <Input
          id="wd-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => set({ amount: e.target.value })}
          {...fieldAria("wd-amount", errors.amount)}
        />
      </FormField>
      <FormField id="wd-method" label="Receive it by" error={errors.method}>
        <NativeSelect id="wd-method" className="w-full" value={form.method} onChange={(e) => set({ method: e.target.value })} {...fieldAria("wd-method", errors.method)}>
          <NativeSelectOption value="">Choose how</NativeSelectOption>
          {options.payout_methods.map((m) => (
            <NativeSelectOption key={m} value={m}>
              {labelOf(PAYOUT_METHOD, m)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      {form.method === "bank_transfer" && (
        <>
          <FormField id="wd-bank" label="Bank" error={errors.bank_name}>
            <Input id="wd-bank" maxLength={100} value={form.bank_name} onChange={(e) => set({ bank_name: e.target.value })} {...fieldAria("wd-bank", errors.bank_name)} />
          </FormField>
          <FormField id="wd-acct-name" label="Name on the bank account" error={errors.account_name}>
            <Input
              id="wd-acct-name"
              maxLength={150}
              value={form.account_name}
              onChange={(e) => set({ account_name: e.target.value })}
              {...fieldAria("wd-acct-name", errors.account_name)}
            />
          </FormField>
          <FormField id="wd-acct-no" label="Bank account number" error={errors.account_number}>
            <Input
              id="wd-acct-no"
              inputMode="numeric"
              maxLength={34}
              value={form.account_number}
              onChange={(e) => set({ account_number: e.target.value })}
              {...fieldAria("wd-acct-no", errors.account_number)}
            />
          </FormField>
        </>
      )}
      {form.method === "gcash" && (
        <FormField id="wd-gcash" label="GCash number" error={errors.gcash_number}>
          <Input
            id="wd-gcash"
            inputMode="tel"
            placeholder="09171234567"
            maxLength={13}
            value={form.gcash_number}
            onChange={(e) => set({ gcash_number: e.target.value })}
            {...fieldAria("wd-gcash", errors.gcash_number)}
          />
        </FormField>
      )}
      <p className="text-xs text-muted-foreground">
        The amount is set aside as soon as you send this, for up to {plural(options.hold_days, "day")}, while your branch reviews it. Your branch pays it out.
      </p>
    </div>
  );
}
