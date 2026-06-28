import { useCallback, useEffect, useState } from "react";

import { fetchAutomationStats } from "@/lib/back-office/automation-stats-api";
import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;

function formatAccuracy(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct.toFixed(1)}%`;
}

function accuracyTone(pct: number | null): string {
  if (pct == null) return "text-text-secondary";
  if (pct >= 55) return "text-success";
  if (pct >= 45) return "text-text-primary";
  return "text-danger";
}

function triggerLabel(
  messages: ReturnType<typeof useI18n>["messages"],
  labelKey: string,
): string {
  const triggers = messages.automationStats.triggers as Record<string, string>;
  return triggers[labelKey] ?? labelKey;
}

export function BackOfficeAutomationStatsPanel() {
  const { t, messages } = useI18n();
  const { time } = useFormat();
  const [data, setData] = useState<AutomationStatsDto | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const row = await fetchAutomationStats();
    setData(row);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const sourceLabel =
    data?.source === "extension"
      ? t("automationStats.sourceExtension")
      : data?.source === "server"
        ? t("automationStats.sourceServer")
        : t("automationStats.sourceUnknown");

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("automationStats.title")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.subtitle")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("automationStats.updatedAt")}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {loading || !data ? "…" : time(data.updatedAt)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("automationStats.source")}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {loading ? "…" : sourceLabel}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("automationStats.sessionAccuracy")}</p>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                accuracyTone(data?.session.accuracyPct ?? null),
              )}
            >
              {loading ? "…" : formatAccuracy(data?.session.accuracyPct ?? null)}
            </p>
            {!loading && data && data.session.total > 0 ? (
              <p className="mt-0.5 text-[11px] tabular-nums text-text-secondary">
                {data.session.wins}V / {data.session.losses}D
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("automationStats.triggersTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.triggersHint")}</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          {loading ? (
            <p className="px-4 py-6 text-sm text-text-secondary">{t("common.loading")}</p>
          ) : (
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("automationStats.colTrigger")}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t("automationStats.colWins")}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t("automationStats.colLosses")}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t("automationStats.colTotal")}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t("automationStats.colAccuracy")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.triggers ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-border-color last:border-0">
                    <td className="px-3 py-2.5 font-medium text-text-primary">
                      {triggerLabel(messages, row.labelKey)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
                      {row.wins}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
                      {row.losses}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
                      {row.total > 0 ? row.total : t("automationStats.noData")}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right text-base font-bold tabular-nums",
                        accuracyTone(row.accuracyPct),
                      )}
                    >
                      {formatAccuracy(row.accuracyPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
