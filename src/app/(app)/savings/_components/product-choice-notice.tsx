import Link from "next/link";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ProductChoiceEmpty } from "@/lib/savings/product-choice";

/** Why no product can be picked, in words, with a link for a user who can fix it. */
export function ProductChoiceNotice({ id, empty }: { id?: string; empty: ProductChoiceEmpty }) {
  return (
    <Alert id={id} role="status">
      <Info />
      <AlertDescription>
        <p>
          {empty.message}
          {empty.link && (
            <>
              {" "}
              <Link href={empty.link.href} className="font-medium text-foreground underline underline-offset-2">
                {empty.link.label}
              </Link>
            </>
          )}
        </p>
      </AlertDescription>
    </Alert>
  );
}
