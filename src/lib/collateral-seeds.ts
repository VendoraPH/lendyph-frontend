import type { CollateralType } from "@/types";

const NOW = "2026-04-26T00:00:00.000Z";

export const DEFAULT_COLLATERAL_TYPES: CollateralType[] = [
  {
    id: 1,
    name: "Land Title",
    detail_field_label: "Title No.",
    amount_field_label: "Appraised Value",
    source: "manual",
    display_order: 1,
    is_visible: true,
    is_seed: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 2,
    name: "Chattel",
    detail_field_label: "Chattel No.",
    amount_field_label: "Appraised Value",
    source: "manual",
    display_order: 2,
    is_visible: true,
    is_seed: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 3,
    name: "Share Capital",
    detail_field_label: "Reference",
    amount_field_label: "Total Share Balance",
    source: "share_capital",
    display_order: 3,
    is_visible: true,
    is_seed: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 4,
    name: "Stock Certificate",
    detail_field_label: "Stock Certificate No.",
    amount_field_label: "Amount",
    source: "manual",
    display_order: 4,
    is_visible: true,
    is_seed: true,
    created_at: NOW,
    updated_at: NOW,
  },
];
