"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "./input";

/**
 * A password field with a reveal toggle.
 *
 * Takes everything `<Input>` takes except `type`, which it owns.
 *
 * The toggle is a real `<button type="button">`, not a styled `<span>`, so it
 * is reachable by keyboard and announced. `type="button"` is load-bearing: the
 * default inside a `<form>` is `submit`, which would post the form on every
 * reveal. It is also `tabIndex={-1}`, keeping Tab on the path
 * current → new → confirm → submit; the toggle is a convenience, and putting it
 * in the tab order makes a three-field form take six stops to cross.
 *
 * `aria-pressed` reports the state rather than the action, which is what a
 * toggle button should do, and the label switches with it so a screen reader
 * user is told the password is currently visible.
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
