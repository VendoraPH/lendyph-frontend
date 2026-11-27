// Made-up records for the CIC tests. Synthetic values only: never paste a
// real member's data here.
import type { CicRecordValues, CicValidationContext } from "./types";

export const CTX: CicValidationContext = {
  mfi: false,
  providerCode: "TEST0001",
  fileReferenceDate: "2026-10-31",
};

export function individual(overrides: CicRecordValues = {}): CicRecordValues {
  return {
    ID4: "2026-10-31",
    ID5: "M-0001",
    ID7: "JUAN",
    ID8: "DELA CRUZ",
    ID13: "M",
    ID14: "1990-05-17",
    ID32: "MI", ID34: "12 RIZAL ST", ID38: "QUEZON CITY", ID39: "METRO MANILA",
    ID43: "AI", ID45: "12 RIZAL ST", ID49: "QUEZON CITY", ID50: "METRO MANILA",
    ID54: "10", ID55: "123-456-789",
    ID78: "3", ID79: "09170000000",
    ...overrides,
  };
}

export function installment(overrides: CicRecordValues = {}): CicRecordValues {
  return {
    CI4: "2026-10-31",
    CI5: "M-0001",
    CI6: "B",
    CI7: "LN-0001",
    CI8: "12",
    CI9: "AC",
    CI11: "PHP",
    CI12: "PHP",
    CI13: "2026-01-15",
    CI15: "2027-01-15",
    CI20: 50000,
    CI21: 12,
    CI22: "NA",
    CI24: "M",
    CI26: 4583.33,
    CI28: 4583.33,
    CI31: 3,
    CI32: 13750,
    CI35: "0",
    ...overrides,
  };
}
