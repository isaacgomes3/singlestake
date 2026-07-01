import { ChevronRight } from "lucide-react";

import type { AdminUserRecord } from "@/lib/back-office/admin-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

function statusLabel(row: AdminUserRecord, t: (key: string) => string): string {
  if (row.accountStatus === "blocked") return t("admin.statusBlocked");
  if (row.accountActive) return t("admin.statusActive");
  return t("admin.statusPending");
}

type Props = {
  users: AdminUserRecord[];
  loading: boolean;
  onSelect: (userId: string) => void;
};

export function BackOfficeClientList({ users, loading, onSelect }: Props) {
  const { t } = useI18n();

  if (loading) return null;

  if (users.length === 0) {
    return <p className="mt-4 text-sm text-text-secondary">{t("admin.clientsListEmpty")}</p>;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border-color">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
            <th className="px-4 py-2.5 font-semibold">{t("admin.colName")}</th>
            <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">{t("admin.colEmail")}</th>
            <th className="px-4 py-2.5 font-semibold">{t("admin.colStatus")}</th>
            <th className="hidden px-4 py-2.5 font-semibold md:table-cell">{t("admin.colAutomation")}</th>
            <th className="w-10 px-2 py-2.5" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {users.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-border-color/60 transition-colors last:border-0 hover:bg-bg-secondary/60"
              onClick={() => onSelect(row.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(row.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${t("admin.clientsOpenProfile")}: ${row.name}`}
            >
              <td className="px-4 py-3 text-text-primary">
                {row.name}
                {row.role === "admin" ? (
                  <span className="ml-1.5 text-[10px] uppercase text-violet-400">admin</span>
                ) : null}
              </td>
              <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">{row.email}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    row.accountStatus === "blocked"
                      ? "bg-danger/15 text-danger"
                      : row.accountActive
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning",
                  )}
                >
                  {statusLabel(row, t)}
                </span>
              </td>
              <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                {row.automationActive ? t("admin.automationYes") : t("admin.automationNo")}
              </td>
              <td className="px-2 py-3 text-text-secondary">
                <ChevronRight className="size-4" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
