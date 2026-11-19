/**
 * Keeps a list box's scrollbars drawn (the system's overlay ones hide until
 * scrolled), so a wide table's last columns are findable at 1024 px, as the
 * executive dashboard's branch table does.
 */
export const VISIBLE_SCROLLBAR =
  "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-muted/40";
