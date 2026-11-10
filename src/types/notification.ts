import type { PaginatedResponse } from "./api";

/**
 * The in-app notification kinds the backend sends (staff only; borrowers are
 * never notified this way). The bell treats any other string as a plain
 * notification, so a type added on the server later still shows.
 */
export type NotificationType =
  | "approval_needed"
  | "loan_approved"
  | "loan_rejected"
  | "loan_sent_back"
  | "loan_released"
  | "payment_voided"
  | "loan_past_due"
  | "extension_applied"
  | "restructure_applied"
  | "adjustment_pending"
  // Reminders (backend #232), about a member's reminders; never sent to the
  // member. A reminder showed the member's contact is bad; a loan reached the
  // long-past-due rule and needs the officer's follow up; a reminder could not
  // go out after every attempt.
  | "reminder_contact_invalid"
  | "reminder_follow_up"
  | "reminder_failed"
  // Savings (Phase 3): the nightly control found the savings records and the
  // books (2050, 2060) apart, for holders of savings:post; a savings
  // transaction at or above the large-transaction alert.
  | "savings_gl_difference"
  | "savings_large_transaction";

/**
 * One row of `GET /notifications`, the signed-in user's own notifications.
 *
 * - `id` is the Laravel database notification id (a UUID string).
 * - `title` and `body` are plain English written by the server, ₱ amounts
 *   included; the browser shows them as sent and never reformats a figure.
 * - `url` is a frontend path such as `/loans/12`.
 * - `read_at` is null while unread. Timestamps are UTC ISO strings.
 * - `data` holds the ids the notification is about (loan, repayment, …).
 */
export interface AppNotification {
  id: string;
  /** One of `NotificationType`, or a kind added on the server later. */
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

/** `GET /notifications` answers a raw Laravel paginator, newest first. */
export type NotificationPage = PaginatedResponse<AppNotification>;

/** `GET /notifications/unread-count`, after the `data` envelope is unwrapped. */
export interface NotificationUnreadCount {
  count: number;
}
