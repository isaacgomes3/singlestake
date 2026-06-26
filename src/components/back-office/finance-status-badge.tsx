import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  paid: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-200 border-red-500/30",
};

const KNOWN_STATUSES = new Set(["pending", "approved", "paid", "rejected"]);

export function FinanceStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const label = KNOWN_STATUSES.has(status) ? t(`shared.status.${status}`) : status;

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30",
      )}
    >
      {label}
    </span>
  );
}
