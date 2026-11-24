/**
 * Receipt share links (finish run round 2, decision 6): a link that opens one
 * payment receipt, masked, without signing in, for 30 days.
 */

export type ReceiptShareLinkStatus = "active" | "expired" | "revoked";

/** A link as staff see it. Never its token: that is answered once, when it is made. */
export interface ReceiptShareLink {
  id: number;
  status: ReceiptShareLinkStatus;
  /** "Active", "Expired" or "Revoked". */
  status_label: string;
  /** Manila time, "2026-11-24 09:15:00". */
  created_at: string | null;
  created_by: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

/** GET and revoke: the receipt's newest link, or null when it never had one. */
export interface ReceiptShareLinkState {
  link: ReceiptShareLink | null;
}

/** POST: the new link and its token, shown once. */
export interface ReceiptShareLinkCreated {
  token: string;
  link: ReceiptShareLink;
}

/**
 * The masked receipt a working link opens (GET /public/receipts/{token}).
 * Figures are the server's 2-decimal strings, in the staff receipt's field
 * names; nothing else about the member or the loan is sent.
 */
export interface PublicReceipt {
  cooperative: { name: string; logo_url: string | null };
  receipt_number: string;
  payment_date: string | null;
  /** Initials and surname: "M. C. D. Santos". */
  member_name: string;
  /** The method in words: "GCash". */
  method: string | null;
  /** The last 4 characters of the reference, or null (none, or 4 characters or fewer). */
  reference_last4: string | null;
  amount_paid: string;
  principal_applied: string;
  interest_applied: string;
  penalty_applied: string;
  insurance_applied: string;
  overpayment: string;
  build_up_credited: string | null;
  overpayment_kept: string | null;
  status: "completed" | "voided";
  voided_on: string | null;
}
