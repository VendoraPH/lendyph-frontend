"use client";

import Link from "next/link";
import { usePermission } from "@/hooks";
import { cn } from "@/lib/utils";
import { NEW_PRODUCT_PENALTY_LINE, penaltySourceLine, type PenaltySource } from "../_lib/penalty-source";

/**
 * The product's penalty source in words, from the server. A configuration
 * links to Settings → Penalties for users with `penalties:view`. `isNew` is a
 * product not saved yet, which no configuration covers.
 */
export function PenaltySourceLine({
  source,
  isNew = false,
  className,
}: {
  source: PenaltySource | null | undefined;
  isNew?: boolean;
  className?: string;
}) {
  const { can } = usePermission();
  const { text, linked } = isNew ? { text: NEW_PRODUCT_PENALTY_LINE, linked: false } : penaltySourceLine(source);
  if (linked && can("penalties:view")) {
    return (
      <Link href="/settings/penalties" className={cn("underline-offset-2 hover:underline", className)}>
        {text}
      </Link>
    );
  }
  return <span className={className}>{text}</span>;
}
