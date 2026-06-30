import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  fetchAutomationStats,
  saveFibonacciAbsenceSpins,
  setAutomationTriggerEnabled,
} from "@/lib/back-office/automation-stats-api";
import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";
import { isAdminUser } from "@/lib/back-office/admin-access";
import { getSession } from "@/lib/auth/session";
import {
  FIBONACCI_ABSENCE_SPINS_MAX,
  FIBONACCI_ABSENCE_SPINS_MIN,
  syncFibonacciPrefsFromAutomationConfig,
} from "@/lib/roulette/fibonacciAbsencePrefs";
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

function automationTriggerToggleId(
  rowId: UmFatorTriggerTierReportRow["id"],
): "three" | "crossing" | "fibonacci" | null {
  if (rowId === "three") return "three";
  if (rowId === "crossing-primary") return "crossing";
  if (rowId === "fibonacci") return "fibonacci";
  return null;
}

function triggerLabel(
  messages: ReturnType<typeof useI18n>["messages"],
  labelKey: string,
): string {
  const triggers = messages.automationStats.triggers as Record<string, string>;
  return triggers[labelKey] ?? labelKey;
}

function applyFibonacciPrefsFromDto(data: AutomationStatsDto): void {
  syncFibonacciPrefsFromAutomationConfig(data.fibonacci.enabled, data.fibonacci.absenceSpins);
}

export function BackOfficeAutomationStatsPanel() {
  const { t, messages } = useI18n();
  const { time } = useFormat();
  const isAdmin = isAdminUser(getSession()?.user);
  const [data, setData] = useState<AutomationStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [absenceDraft, setAbsenceDraft] = useState("12");
  const [savingAbsence, setSavingAbsence] = useState(false);

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const row = await fetchAutomationStats();
    setData(row);
    if (row) {
      setAbsenceDraft(String(row.fibonacci.absenceSpins));
      applyFibonacciPrefsFromDto(row);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void reload();
    if (!isAdmin) return;
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload, isAdmin]);

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  async function handleToggleTrigger(id: "three" | "crossing" | "fibonacci", enabled: boolean) {
    setTogglingId(id);
    const result = await setAutomationTriggerEnabled(id, enabled);
    setTogglingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    applyFibonacciPrefsFromDto(result.data);
    toast.success(
      enabled ? t("automationStats.triggerEnabled") : t("automationStats.triggerDisabled"),
    );
  }

  async function handleConfirmAbsence() {
    const parsed = Number(absenceDraft);
    if (!Number.isFinite(parsed) || parsed < FIBONACCI_ABSENCE_SPINS_MIN || parsed > FIBONACCI_ABSENCE_SPINS_MAX) {
      toast.error(t("automationStats.fibonacciAbsenceInvalid"));
      return;
    }
    setSavingAbsence(true);
    const result = await saveFibonacciAbsenceSpins(Math.floor(parsed));
    setSavingAbsence(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setAbsenceDraft(String(result.data.fibonacci.absenceSpins));
    applyFibonacciPrefsFromDto(result.data);
    toast.success(t("automationStats.fibonacciAbsenceSaved"));
  }

  const sourceLabel =
    data?.source === "extension"
      ? t("automationStats.sourceExtension")
      : data?.source === "server"
        ? t("automationStats.sourceServer")
        : t("automationStats.sourceUnknown");

  const fibonacciRow = data?.triggers.find((row) => row.id === "fibonacci");
  const absenceDirty =
    data != null && Number(absenceDraft) !== data.fibonacci.absenceSpins;

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
        <h2 className="text-sm font-bold text-text-primary">{t("automationStats.fibonacciTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.fibonacciHint")}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary" htmlFor="fib-absence-spins">
              {t("automationStats.fibonacciAbsenceLabel")}
            </label>
            <Input
              id="fib-absence-spins"
              type="number"
              min={FIBONACCI_ABSENCE_SPINS_MIN}
              max={FIBONACCI_ABSENCE_SPINS_MAX}
              value={absenceDraft}
              onChange={(e) => setAbsenceDraft(e.target.value)}
              className="w-24 tabular-nums"
              disabled={loading || savingAbsence}
            />
          </div>
          <Button
            type="button"
            variant={absenceDirty ? "default" : "secondary"}
            disabled={loading || savingAbsence || !absenceDirty}
            onClick={() => void handleConfirmAbsence()}
          >
            {savingAbsence ? "…" : t("automationStats.fibonacciAbsenceConfirm")}
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-border-color bg-bg-secondary px-3 py-2">
            <span className="text-xs font-medium text-text-secondary">
              {triggerLabel(messages, "fibonacci")}
            </span>
            <Switch
              checked={fibonacciRow?.enabled ?? data?.fibonacci.enabled ?? true}
              disabled={loading || togglingId === "fibonacci"}
              aria-label={triggerLabel(messages, "fibonacci")}
              onCheckedChange={(checked) => void handleToggleTrigger("fibonacci", checked)}
            />
          </div>
        </div>
        {!loading && data ? (
          <p className="mt-2 text-[11px] text-text-secondary">
            Activo: {data.fibonacci.enabled ? "sim" : "não"} · Ausências confirmadas:{" "}
            <span className="font-semibold tabular-nums text-text-primary">
              {data.fibonacci.absenceSpins}
            </span>{" "}
            giros
          </p>
        ) : null}
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
                  <th className="px-3 py-2.5 text-center font-semibold">
                    {t("automationStats.colEnabled")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.triggers ?? [])
                  .filter((row) => row.id !== "two" && row.id !== "fibonacci")
                  .map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border-color last:border-0",
                      !row.enabled && "opacity-60",
                    )}
                  >
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
                    <td className="px-3 py-2.5 text-center">
                      {row.toggleable ? (
                        <Switch
                          checked={row.enabled}
                          disabled={togglingId === automationTriggerToggleId(row.id)}
                          aria-label={triggerLabel(messages, row.labelKey)}
                          onCheckedChange={(checked) => {
                            const toggleId = automationTriggerToggleId(row.id);
                            if (toggleId == null) return;
                            void handleToggleTrigger(toggleId, checked);
                          }}
                        />
                      ) : (
                        <span className="text-[11px] text-text-secondary">—</span>
                      )}
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
