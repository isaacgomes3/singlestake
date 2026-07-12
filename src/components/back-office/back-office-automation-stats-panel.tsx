import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  fetchAutomationStats,
  setAutomationTriggerEnabled,
} from "@/lib/back-office/automation-stats-api";
import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { isAdminUser } from "@/lib/back-office/admin-access";
import { getSession } from "@/lib/auth/session";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
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

function formatOccurrenceCell(
  position: number | undefined,
  leftNumber: number | null | undefined,
  dash: string,
): { primary: string; secondary: string | null } {
  if (leftNumber == null && position == null) {
    return { primary: dash, secondary: null };
  }
  if (leftNumber == null) {
    return {
      primary: dash,
      secondary: position != null ? `giro #${position}` : null,
    };
  }
  return {
    primary: `← ${leftNumber}`,
    secondary: position != null ? `giro #${position}` : null,
  };
}

export function BackOfficeAutomationStatsPanel() {
  const { t, messages } = useI18n();
  const { time } = useFormat();
  const isAdmin = isAdminUser(getSession()?.user);
  const [data, setData] = useState<AutomationStatsDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchAutomationStats();
      setData(row);
      setLoadFailed(row == null);
      if (!row) toast.error(t("automationStats.loadError"));
    } catch {
      setData(null);
      setLoadFailed(true);
      toast.error(t("automationStats.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void reload();
    if (!isAdmin) return;
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload, isAdmin]);

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  async function handleToggleTres3fatores(enabled: boolean) {
    setTogglingId("tres3fatores");
    const result = await setAutomationTriggerEnabled("tres3fatores", enabled);
    setTogglingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    toast.success(
      enabled ? t("automationStats.triggerEnabled") : t("automationStats.triggerDisabled"),
    );
  }

  const sourceLabel =
    data?.source === "extension"
      ? t("automationStats.sourceExtension")
      : data?.source === "server"
        ? t("automationStats.sourceServer")
        : t("automationStats.sourceUnknown");

  const panelBodyMessage = loadFailed
    ? t("automationStats.loadError")
    : loading
      ? "…"
      : t("automationStats.noData");

  const tres3fRow = data?.triggers.find((row) => row.id === "tres3fatores");
  const triggerLabels = messages.automationStats.triggers as Record<string, string>;
  const tres3fLabel = triggerLabels.tres3fatores ?? "ICE 3F";
  const occurrences = data?.ice3fOccurrences;
  const dash = "—";

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
        {!loading && tres3fRow ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("automationStats.colTrigger")}</th>
                  <th className="px-3 py-2 font-semibold">{t("automationStats.colWins")}</th>
                  <th className="px-3 py-2 font-semibold">{t("automationStats.colLosses")}</th>
                  <th className="px-3 py-2 font-semibold">{t("automationStats.colTotal")}</th>
                  <th className="px-3 py-2 font-semibold">{t("automationStats.colAccuracy")}</th>
                  <th className="px-3 py-2 font-semibold">{t("automationStats.colEnabled")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border-color">
                  <td className="px-3 py-2.5 font-medium text-text-primary">{tres3fLabel}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-secondary">{tres3fRow.wins}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-secondary">{tres3fRow.losses}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-secondary">{tres3fRow.total}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 font-semibold tabular-nums",
                      accuracyTone(tres3fRow.accuracyPct),
                    )}
                  >
                    {formatAccuracy(tres3fRow.accuracyPct)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch
                      checked={tres3fRow.enabled}
                      disabled={togglingId === "tres3fatores"}
                      aria-label={tres3fLabel}
                      onCheckedChange={(checked) => void handleToggleTres3fatores(checked)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{panelBodyMessage}</p>
        )}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {t("automationStats.ice3fOccurrencesTitle")}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {t("automationStats.ice3fOccurrencesHint")}
        </p>
        {!loading && occurrences ? (
          <>
            <p className="mt-3 text-[11px] text-text-secondary">
              {lobbyTableDisplayName(occurrences.tableId)} ·{" "}
              {t("automationStats.ice3fOccurrencesHistoryLength", {
                n: occurrences.historyLength,
              })}
            </p>
            <div className="mt-3 max-h-[36rem] overflow-auto rounded-xl border border-border-color">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      {t("automationStats.ice3fOccurrencesColNumber")}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {t("automationStats.ice3fOccurrencesColLast")}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {t("automationStats.ice3fOccurrencesColPrev")}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {t("automationStats.ice3fOccurrencesColThird")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {occurrences.rows.map((row) => {
                    const [last, prev, third] = row.occurrences;
                    const lastCell = formatOccurrenceCell(last?.position, last?.precededBy, dash);
                    const prevCell = formatOccurrenceCell(prev?.position, prev?.precededBy, dash);
                    const thirdCell = formatOccurrenceCell(
                      third?.position,
                      third?.precededBy,
                      dash,
                    );
                    return (
                      <tr key={row.number} className="border-t border-border-color">
                        <td className="px-3 py-2 font-semibold tabular-nums text-text-primary">
                          {row.number}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-text-secondary">
                          <span className="font-semibold text-text-primary">{lastCell.primary}</span>
                          {lastCell.secondary ? (
                            <span className="mt-0.5 block text-[11px] text-text-secondary">
                              {lastCell.secondary}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-text-secondary">
                          <span className="font-semibold text-text-primary">{prevCell.primary}</span>
                          {prevCell.secondary ? (
                            <span className="mt-0.5 block text-[11px] text-text-secondary">
                              {prevCell.secondary}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-text-secondary">
                          <span className="font-semibold text-text-primary">
                            {thirdCell.primary}
                          </span>
                          {thirdCell.secondary ? (
                            <span className="mt-0.5 block text-[11px] text-text-secondary">
                              {thirdCell.secondary}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{panelBodyMessage}</p>
        )}
      </section>
    </div>
  );
}
