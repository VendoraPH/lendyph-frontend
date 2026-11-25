/**
 * The public application link form (`POST`/`PATCH /loan-origination/links`).
 * Links have no logo upload; a test link stays out of the dashboard, and only
 * a test link shows staging's test codes.
 */

import { calendarDate, formatDateISO } from "@/lib/format";
import type { ApplicationLink, ApplicationLinkInput } from "@/types/loan-origination";

/** Said where a link has no `url`: the server builds none until its public address is set up. */
export const NO_ADDRESS =
  "No link to share yet: the server's public address for online applications isn't set up. An administrator sets it on the server.";

/** Under the form's Test link switch: who sees a code on screen, as the server decides it (`TestCodes::serves()`). */
export const TEST_LINK_NOTE =
  "Its applications stay out of the dashboard. On staging, only a test link shows test codes, for the mobile number on an active staff account (Settings → Profile, or User Management) or another allowed staff number.";

export function emptyLinkInput(branchId: number | null): ApplicationLinkInput {
  return {
    name: "",
    active: true,
    is_test: false,
    branch_id: branchId,
    loan_product_ids: [],
    expires_at: null,
    display_name: null,
    contact_phone: null,
    contact_email: null,
  };
}

/** A saved link in the form's shape, its expiry as the Manila day picked. */
export function linkInputFrom(link: ApplicationLink): ApplicationLinkInput {
  return {
    name: link.name,
    active: link.active,
    is_test: link.is_test,
    branch_id: link.branch_id,
    loan_product_ids: link.loan_product_ids,
    expires_at: link.expires_at ? formatDateISO(calendarDate(link.expires_at)) : null,
    display_name: link.display_name,
    contact_phone: link.contact_phone,
    contact_email: link.contact_email,
  };
}
