import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  ShareCapitalLedgerEntry,
  Pledge,
  AutoCreditStatus,
  AutoCreditProcessResult,
  CreateLedgerEntryData,
  UpdatePledgeData,
  CreatePledgeEntryData,
  BulkPledgeEntryData,
  PaginatedResponse,
} from "@/types";

export const shareCapitalService = {
  // ── Ledger ──

  ledgerList: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<ShareCapitalLedgerEntry>>(
      API_ENDPOINTS.SHARE_CAPITAL.LEDGER_LIST,
      { params }
    ),

  ledgerCreate: (data: CreateLedgerEntryData) =>
    api.post<ShareCapitalLedgerEntry>(
      API_ENDPOINTS.SHARE_CAPITAL.LEDGER_CREATE,
      data
    ),

  // ── Pledges ──

  pledgeList: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Pledge>>(API_ENDPOINTS.PLEDGES.LIST, { params }),

  pledgeUpdate: (id: number, data: UpdatePledgeData) =>
    api.put<Pledge>(API_ENDPOINTS.PLEDGES.UPDATE(id), data),

  pledgeToggleAutoCredit: (id: number) =>
    api.patch<Pledge>(API_ENDPOINTS.PLEDGES.TOGGLE_AUTO_CREDIT(id)),

  pledgeCreateEntry: (id: number, data: CreatePledgeEntryData) =>
    api.post<ShareCapitalLedgerEntry>(
      API_ENDPOINTS.PLEDGES.CREATE_ENTRY(id),
      data
    ),

  pledgeBulkEntries: (data: BulkPledgeEntryData) =>
    api.post<{ processed_count: number }>(
      API_ENDPOINTS.PLEDGES.BULK_ENTRIES,
      data
    ),

  // ── Auto-Credit ──

  autoCreditStatus: () =>
    api.get<AutoCreditStatus>(API_ENDPOINTS.AUTO_CREDIT.STATUS),

  autoCreditProcess: () =>
    api.post<AutoCreditProcessResult>(API_ENDPOINTS.AUTO_CREDIT.PROCESS),
};
