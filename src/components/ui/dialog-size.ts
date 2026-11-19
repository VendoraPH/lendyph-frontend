export type DialogSize = "sm" | "default" | "md" | "lg" | "xl" | "full"

const dialogSizeClasses: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  default: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[calc(100vw-4rem)] sm:max-h-[calc(100vh-4rem)] h-full",
}

/** A width class with no breakpoint prefix, such as `max-w-2xl`. */
const UNPREFIXED_MAX_WIDTH = /(^|\s)!?max-w-\S+/

/**
 * The size's width class for `DialogContent`. A dialog that passes its own
 * unprefixed `max-w-*` gets none: tailwind-merge treats `sm:max-w-md` and
 * `max-w-2xl` as different variants and keeps both, so the default would win
 * from the `sm` breakpoint up. `full` always keeps its classes.
 */
export function dialogSizeClass(size: DialogSize, className?: string): string {
  if (size !== "full" && className && UNPREFIXED_MAX_WIDTH.test(className)) return ""
  return dialogSizeClasses[size]
}
