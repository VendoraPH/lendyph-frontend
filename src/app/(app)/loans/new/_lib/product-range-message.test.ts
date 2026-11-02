import { test } from "node:test";
import assert from "node:assert/strict";
import { formatProductRangeMessage } from "./product-range-message";

test("the server's minimum amount message shows the amount in pesos", () => {
  assert.equal(
    formatProductRangeMessage("Minimum loan amount for this product is 5000.00."),
    "Minimum loan amount for this product is ₱5,000.00."
  );
});

test("the server's maximum amount message shows the amount in pesos, centavos kept", () => {
  assert.equal(
    formatProductRangeMessage("Maximum loan amount for this product is 1500000.5."),
    "Maximum loan amount for this product is ₱1,500,000.50."
  );
});

test("any other message is left as it is", () => {
  assert.equal(
    formatProductRangeMessage("Term must be between 1 and 12 months for this product."),
    "Term must be between 1 and 12 months for this product."
  );
  assert.equal(formatProductRangeMessage("We couldn't update this loan."), "We couldn't update this loan.");
});
