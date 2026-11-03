import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { NotificationPage, NotificationUnreadCount } from "@/types/notification";

/** The bell shows the latest 20; the list endpoint pages newest first. */
export const NOTIFICATION_FEED_SIZE = 20;

/**
 * The unread-count read gives up after this long. The poller skips a
 * scheduled read while one is in flight, so a hung request (axios's default is
 * 60 s) would otherwise hold the badge still.
 */
export const UNREAD_COUNT_TIMEOUT_MS = 15_000;

/**
 * The signed-in user's own in-app notifications. The server answers only the
 * caller's rows: another user's id is a 404, never someone else's data.
 */
export const notificationService = {
  /**
   * `GET /notifications` answers a raw Laravel paginator (`{ data, meta }`),
   * so it is read with `getRaw`; `api.get` would drop `meta`. Without
   * `unread`, the page holds read and unread rows alike, newest first.
   */
  list: (params?: { unread?: boolean; per_page?: number; page?: number }) =>
    api.getRaw<NotificationPage>(API_ENDPOINTS.NOTIFICATIONS.LIST, {
      params: {
        per_page: params?.per_page ?? NOTIFICATION_FEED_SIZE,
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.unread ? { unread: 1 } : {}),
      },
    }),

  /** `{ data: { count } }`, unwrapped to the number; rejects after `timeoutMs`. */
  unreadCount: async (timeoutMs: number = UNREAD_COUNT_TIMEOUT_MS): Promise<number> => {
    const res = await api.get<NotificationUnreadCount>(
      API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
      { timeout: timeoutMs },
    );
    const count = Number(res?.count);
    if (!Number.isFinite(count) || count < 0) {
      throw new Error("Unreadable unread notification count");
    }
    return Math.trunc(count);
  },

  markRead: async (id: string): Promise<void> => {
    await api.rawPost<unknown>(API_ENDPOINTS.NOTIFICATIONS.READ(id));
  },

  markAllRead: async (): Promise<void> => {
    await api.rawPost<unknown>(API_ENDPOINTS.NOTIFICATIONS.READ_ALL);
  },
};
