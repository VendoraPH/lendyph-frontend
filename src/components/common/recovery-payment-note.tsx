import { Info } from "lucide-react";
import { RECOVERY_PAYMENT_NOTE, isRecoveryPayment } from "@/lib/recovery-payment";
import { cn } from "@/lib/utils";

/**
 * The payment dialog's note on a defaulted loan: it stays Defaulted until paid
 * in full, and no new penalty is charged. Renders nothing for any other loan.
 * Import it by path.
 */
export function RecoveryPaymentNote({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!isRecoveryPayment(status)) return null;
  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
        className,
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{RECOVERY_PAYMENT_NOTE}</span>
    </p>
  );
}
