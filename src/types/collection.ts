export interface Collection {
  id: number;
  loan_id: number;
  borrower_id: number;
  borrower_name: string;
  amount_due: number;
  due_date: string;
  days_overdue: number;
  status: "due_today" | "upcoming" | "overdue" | "collected";
  loan_schedule_id: number;
}
