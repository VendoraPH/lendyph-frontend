export interface LoanDisclosure {
  loan_id: number;
  application_number?: string;
  borrower_name: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: string;
  term_months: number;
  payment_frequency: string;
  processing_fee: number;
  service_fee: number;
  other_deductions: number;
  net_proceeds: number;
  total_payable: number;
  amortization_schedule: {
    period: number;
    due_date: string;
    principal: number;
    interest: number;
    amount_due: number;
    balance: number;
  }[];
}

export interface LoanPromissoryNote {
  loan_id: number;
  application_number?: string;
  borrower_name: string;
  borrower_address?: string;
  co_maker_name?: string;
  co_maker_address?: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: string;
  term_months: number;
  payment_frequency: string;
  total_payable: number;
  maturity_date?: string;
  release_date?: string;
}
