import { Card, CardContent } from "@/components/ui/card";

/**
 * Finding the account is a `savings:view` read. A role that may post but not
 * view accounts gets this instead of a lookup that would 403.
 */
export function NeedsAccountView({ action }: { action: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {action} needs access to look up savings accounts (Savings: view). Ask an administrator to add it to your role.
      </CardContent>
    </Card>
  );
}
