/** "receipt-OR-00000123.png": the receipt number, safe as a file name. */
export function receiptImageFileName(receiptNumber: string): string {
  const safe = receiptNumber.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `receipt-${safe || "payment"}.png`;
}
