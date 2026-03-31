import type { BorrowerStatus } from "@/types";

export const statusBadgeColor: Record<BorrowerStatus, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
  blacklisted: "bg-gray-900 text-white border-gray-700",
};

export function generateBorrowerCode(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `BRW-${year}${seq}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function buildFullName(form: {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
}): string {
  const middle = form.middle_name ? ` ${form.middle_name.charAt(0)}.` : "";
  const suffix = form.suffix ? ` ${form.suffix}` : "";
  return `${form.first_name}${middle} ${form.last_name}${suffix}`.trim();
}
