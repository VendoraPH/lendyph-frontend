import { redirect } from "next/navigation";

/**
 * Settings has no index of its own — the sidebar renders it as a group of
 * subpages. In the COLLAPSED rail, though, every top-level item is a real
 * `<Link href={item.href}>` (sidebar.tsx), so clicking the Settings icon there
 * navigated to this path and 404'd. Same shim as /loans/products.
 */
export default function SettingsRedirectPage() {
  redirect("/settings/profile");
}
