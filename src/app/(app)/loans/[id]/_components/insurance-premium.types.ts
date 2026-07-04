export type InsurancePaymentType = "full" | "partial";

export type InsurancePremiumValue = {
  percentage: string;
  paymentType: InsurancePaymentType;
  partialAmount: string;
};

export const INSURANCE_PREMIUM_INITIAL: InsurancePremiumValue = {
  percentage: "",
  paymentType: "full",
  partialAmount: "",
};
