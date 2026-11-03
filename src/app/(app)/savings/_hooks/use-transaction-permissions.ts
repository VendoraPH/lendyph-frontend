import { usePermission } from "@/hooks";
import { useAuthStore } from "@/store";

/** Who may reverse and approve, and who the user is (maker ≠ checker). */
export function useTransactionPermissions() {
  const { can } = usePermission();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return { canReverse: can("savings:reverse"), canApprove: can("savings:approve"), userId };
}
