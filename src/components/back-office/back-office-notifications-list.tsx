import { CheckCheck } from "lucide-react";

import type { UserNotificationRecord } from "@/lib/back-office/notifications-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

type Props = {
  notifications: UserNotificationRecord[];
  loading?: boolean;
  compact?: boolean;
  onMarkAllRead?: () => void;
  onMarkRead?: (id: string) => void;
  showMarkAll?: boolean;
  className?: string;
};

function formatRelative(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMin = Math.max(0, Math.round((nowMs - then) / 60_000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `há ${diffD} d`;
}

export function BackOfficeNotificationsList({
  notifications,
  loading = false,
  compact = false,
  onMarkAllRead,
  onMarkRead,
  showMarkAll = false,
  className,
}: Props) {
  const { t } = useI18n();
  const { dateTime } = useFormat();
  const nowMs = Date.now();

  if (loading) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  if (notifications.length === 0) {
    return (
      <p className={cn("text-sm text-text-secondary", className)}>
        {t("notifications.empty")}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showMarkAll && onMarkAllRead ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <CheckCheck className="size-3.5" aria-hidden />
            {t("common.markAllRead")}
          </button>
        </div>
      ) : null}

      {notifications.map((item) => {
        const unread = item.readAt == null;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (unread) onMarkRead?.(item.id);
            }}
            className={cn(
              "theme-card w-full rounded-xl p-3 text-left transition-colors",
              unread && "ring-1 ring-primary/25",
              onMarkRead && unread && "hover:bg-bg-card-hover",
              compact ? "p-2.5" : "p-3",
            )}
          >
            <p className={cn("font-semibold text-text-primary", compact ? "text-sm" : "text-sm")}>
              {item.title}
            </p>
            <p className="mt-1 text-xs text-text-secondary">{item.body}</p>
            <p className="mt-2 text-[10px] text-text-secondary">
              {compact
                ? formatRelative(item.createdAt, nowMs)
                : dateTime(item.createdAt)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
