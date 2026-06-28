import { useCallback, useEffect, useState } from "react";

import {
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/back-office/notifications-api";
import type { UserNotificationRecord } from "@/lib/back-office/notifications-types";

const POLL_MS = 60_000;

export function useBackOfficeNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<UserNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const data = await fetchUserNotifications();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void reload();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  const markAllRead = useCallback(async () => {
    const ok = await markAllNotificationsRead();
    if (ok) void reload();
    return ok;
  }, [reload]);

  const markRead = useCallback(
    async (notificationId: string) => {
      const ok = await markNotificationRead(notificationId);
      if (ok) void reload();
      return ok;
    },
    [reload],
  );

  return {
    notifications,
    unreadCount,
    loading,
    reload,
    markAllRead,
    markRead,
  };
}
