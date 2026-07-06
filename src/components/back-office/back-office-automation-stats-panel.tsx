import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AbsenceFilterStatsTable } from "@/components/back-office/absence-filter-stats-table";
import { ReturnStreakStatsTable } from "@/components/back-office/return-streak-stats-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  fetchAutomationStats,
  saveCrossingAxisAbsenceSpins,
  saveCrossingAxisAbsenceAuto,
  saveCrossingOppositeAxisAbsenceSpins,
  saveCrossingOppositeAxisAbsenceAuto,
  saveFibonacciZoneAbsenceSpins,
  saveRepeticaoZoneAbsenceSpins,
  setAutomationTriggerEnabled,
} from "@/lib/back-office/automation-stats-api";
import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";
import { isAdminUser } from "@/lib/back-office/admin-access";
import { getSession } from "@/lib/auth/session";
import {
  CROSSING_ABSENCE_SPINS_MAX,
  CROSSING_ABSENCE_SPINS_MIN,
  syncCrossingAbsencePrefsFromAutomationConfig,
} from "@/lib/roulette/crossingAbsencePrefs";
import { syncCrossingOppositeAbsencePrefsFromAutomationConfig } from "@/lib/roulette/crossingOppositeAbsencePrefs";
import {
  FIBONACCI_ABSENCE_SPINS_MAX,
  FIBONACCI_ABSENCE_SPINS_MIN,
  syncFibonacciPrefsFromAutomationConfig,
} from "@/lib/roulette/fibonacciAbsencePrefs";
import { syncRepeticaoPrefsFromAutomationConfig } from "@/lib/roulette/repeticaoAbsencePrefs";
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
): "three" | "crossing" | "fibonacci" | "repeticao" | "rotacao" | "crossingCorAltura" | "crossingAlturaParidade" | "crossingCorAlturaOpposite" | "crossingAlturaParidadeOpposite" | null {
  if (rowId === "three") return "three";
  if (rowId === "crossing-primary") return "crossing";
  if (rowId === "crossing-cor-altura") return "crossingCorAltura";
  if (rowId === "crossing-altura-paridade") return "crossingAlturaParidade";
  if (rowId === "crossing-opposite-cor-altura") return "crossingCorAlturaOpposite";
  if (rowId === "crossing-opposite-altura-paridade") return "crossingAlturaParidadeOpposite";
  if (rowId === "fibonacci") return "fibonacci";
  if (rowId === "repeticao") return "repeticao";
  if (rowId === "rotacao") return "rotacao";
  return null;
}

function triggerLabel(
  messages: ReturnType<typeof useI18n>["messages"],
  labelKey: string,
): string {
  const triggers = messages.automationStats.triggers as Record<string, string>;
  return triggers[labelKey] ?? labelKey;
}

function applyAutomationPrefsFromDto(data: AutomationStatsDto): void {
  syncFibonacciPrefsFromAutomationConfig(data.fibonacci);
  syncRepeticaoPrefsFromAutomationConfig(data.repeticao);
  syncCrossingAbsencePrefsFromAutomationConfig(data.crossingAbsence);
  syncCrossingOppositeAbsencePrefsFromAutomationConfig(data.crossingOppositeAbsence);
}

type FibonacciZoneToggleId = "fibonacciDozen" | "fibonacciColumn";
type RepeticaoZoneToggleId = "repeticaoDozen" | "repeticaoColumn";
type CrossingAbsenceToggleId = "crossingCorAltura" | "crossingAlturaParidade";
type CrossingOppositeAbsenceToggleId = "crossingCorAlturaOpposite" | "crossingAlturaParidadeOpposite";
type ZoneToggleId = FibonacciZoneToggleId | RepeticaoZoneToggleId | CrossingAbsenceToggleId | CrossingOppositeAbsenceToggleId;
type FibonacciZoneKind = "dozen" | "column";
type CrossingAbsenceAxisKind = "corAltura" | "alturaParidade";

export function BackOfficeAutomationStatsPanel() {
  const { t, messages } = useI18n();
  const { time } = useFormat();
  const isAdmin = isAdminUser(getSession()?.user);
  const [data, setData] = useState<AutomationStatsDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [absenceDraftDozen, setAbsenceDraftDozen] = useState("12");
  const [absenceDraftColumn, setAbsenceDraftColumn] = useState("12");
  const [repAbsenceDraftDozen, setRepAbsenceDraftDozen] = useState("12");
  const [repAbsenceDraftColumn, setRepAbsenceDraftColumn] = useState("12");
  const [crossAbsenceDraftCorAltura, setCrossAbsenceDraftCorAltura] = useState("12");
  const [crossAbsenceDraftAlturaParidade, setCrossAbsenceDraftAlturaParidade] = useState("12");
  const [crossOppositeDraftCorAltura, setCrossOppositeDraftCorAltura] = useState("12");
  const [crossOppositeDraftAlturaParidade, setCrossOppositeDraftAlturaParidade] = useState("12");
  const [savingAbsenceZone, setSavingAbsenceZone] = useState<FibonacciZoneKind | null>(null);
  const [savingRepAbsenceZone, setSavingRepAbsenceZone] = useState<FibonacciZoneKind | null>(null);
  const [savingCrossAbsenceAxis, setSavingCrossAbsenceAxis] = useState<CrossingAbsenceAxisKind | null>(
    null,
  );
  const [togglingCrossAbsenceAuto, setTogglingCrossAbsenceAuto] =
    useState<CrossingAbsenceAxisKind | null>(null);
  const [savingCrossOppositeAbsenceAxis, setSavingCrossOppositeAbsenceAxis] =
    useState<CrossingAbsenceAxisKind | null>(null);
  const [togglingCrossOppositeAbsenceAuto, setTogglingCrossOppositeAbsenceAuto] =
    useState<CrossingAbsenceAxisKind | null>(null);

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
      if (row) {
        setAbsenceDraftDozen(String(row.fibonacci.dozen.absenceSpins));
        setAbsenceDraftColumn(String(row.fibonacci.column.absenceSpins));
        setRepAbsenceDraftDozen(String(row.repeticao.dozen.absenceSpins));
        setRepAbsenceDraftColumn(String(row.repeticao.column.absenceSpins));
        setCrossAbsenceDraftCorAltura(String(row.crossingAbsence.corAltura.absenceSpins));
        setCrossAbsenceDraftAlturaParidade(String(row.crossingAbsence.alturaParidade.absenceSpins));
        setCrossOppositeDraftCorAltura(String(row.crossingOppositeAbsence.corAltura.absenceSpins));
        setCrossOppositeDraftAlturaParidade(
          String(row.crossingOppositeAbsence.alturaParidade.absenceSpins),
        );
        applyAutomationPrefsFromDto(row);
      } else {
        toast.error(t("automationStats.loadError"));
      }
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

  async function handleToggleTrigger(
    id: "three" | "crossing" | "fibonacci" | "repeticao" | "rotacao" | ZoneToggleId,
    enabled: boolean,
  ) {
    setTogglingId(id);
    const result = await setAutomationTriggerEnabled(id, enabled);
    setTogglingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    applyAutomationPrefsFromDto(result.data);
    toast.success(
      enabled ? t("automationStats.triggerEnabled") : t("automationStats.triggerDisabled"),
    );
  }

  async function handleConfirmZoneAbsence(zone: FibonacciZoneKind) {
    const draft = zone === "dozen" ? absenceDraftDozen : absenceDraftColumn;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < FIBONACCI_ABSENCE_SPINS_MIN || parsed > FIBONACCI_ABSENCE_SPINS_MAX) {
      toast.error(t("automationStats.fibonacciAbsenceInvalid"));
      return;
    }
    setSavingAbsenceZone(zone);
    const result = await saveFibonacciZoneAbsenceSpins(zone, Math.floor(parsed));
    setSavingAbsenceZone(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setAbsenceDraftDozen(String(result.data.fibonacci.dozen.absenceSpins));
    setAbsenceDraftColumn(String(result.data.fibonacci.column.absenceSpins));
    applyAutomationPrefsFromDto(result.data);
    toast.success(t("automationStats.fibonacciAbsenceSaved"));
  }

  async function handleConfirmRepeticaoZoneAbsence(zone: FibonacciZoneKind) {
    const draft = zone === "dozen" ? repAbsenceDraftDozen : repAbsenceDraftColumn;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < FIBONACCI_ABSENCE_SPINS_MIN || parsed > FIBONACCI_ABSENCE_SPINS_MAX) {
      toast.error(t("automationStats.fibonacciAbsenceInvalid"));
      return;
    }
    setSavingRepAbsenceZone(zone);
    const result = await saveRepeticaoZoneAbsenceSpins(zone, Math.floor(parsed));
    setSavingRepAbsenceZone(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setRepAbsenceDraftDozen(String(result.data.repeticao.dozen.absenceSpins));
    setRepAbsenceDraftColumn(String(result.data.repeticao.column.absenceSpins));
    applyAutomationPrefsFromDto(result.data);
    toast.success(t("automationStats.fibonacciAbsenceSaved"));
  }

  async function handleToggleCrossingAxisAbsenceAuto(
    axis: CrossingAbsenceAxisKind,
    absenceAuto: boolean,
  ) {
    setTogglingCrossAbsenceAuto(axis);
    const result = await saveCrossingAxisAbsenceAuto(axis, absenceAuto);
    setTogglingCrossAbsenceAuto(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setCrossAbsenceDraftCorAltura(String(result.data.crossingAbsence.corAltura.absenceSpins));
    setCrossAbsenceDraftAlturaParidade(
      String(result.data.crossingAbsence.alturaParidade.absenceSpins),
    );
    applyAutomationPrefsFromDto(result.data);
    toast.success(
      absenceAuto
        ? t("automationStats.crossingAbsenceAutoOn")
        : t("automationStats.crossingAbsenceAutoOff"),
    );
  }

  async function handleConfirmCrossingAxisAbsence(axis: CrossingAbsenceAxisKind) {
    const draft =
      axis === "corAltura" ? crossAbsenceDraftCorAltura : crossAbsenceDraftAlturaParidade;
    const parsed = Number(draft);
    if (
      !Number.isFinite(parsed) ||
      parsed < CROSSING_ABSENCE_SPINS_MIN ||
      parsed > CROSSING_ABSENCE_SPINS_MAX
    ) {
      toast.error(t("automationStats.fibonacciAbsenceInvalid"));
      return;
    }
    setSavingCrossAbsenceAxis(axis);
    const result = await saveCrossingAxisAbsenceSpins(axis, Math.floor(parsed));
    setSavingCrossAbsenceAxis(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setCrossAbsenceDraftCorAltura(String(result.data.crossingAbsence.corAltura.absenceSpins));
    setCrossAbsenceDraftAlturaParidade(
      String(result.data.crossingAbsence.alturaParidade.absenceSpins),
    );
    applyAutomationPrefsFromDto(result.data);
    toast.success(t("automationStats.fibonacciAbsenceSaved"));
  }

  async function handleToggleCrossingOppositeAxisAbsenceAuto(
    axis: CrossingAbsenceAxisKind,
    absenceAuto: boolean,
  ) {
    setTogglingCrossOppositeAbsenceAuto(axis);
    const result = await saveCrossingOppositeAxisAbsenceAuto(axis, absenceAuto);
    setTogglingCrossOppositeAbsenceAuto(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setCrossOppositeDraftCorAltura(String(result.data.crossingOppositeAbsence.corAltura.absenceSpins));
    setCrossOppositeDraftAlturaParidade(
      String(result.data.crossingOppositeAbsence.alturaParidade.absenceSpins),
    );
    applyAutomationPrefsFromDto(result.data);
    toast.success(
      absenceAuto
        ? t("automationStats.crossingAbsenceAutoOn")
        : t("automationStats.crossingAbsenceAutoOff"),
    );
  }

  async function handleConfirmCrossingOppositeAxisAbsence(axis: CrossingAbsenceAxisKind) {
    const draft =
      axis === "corAltura" ? crossOppositeDraftCorAltura : crossOppositeDraftAlturaParidade;
    const parsed = Number(draft);
    if (
      !Number.isFinite(parsed) ||
      parsed < CROSSING_ABSENCE_SPINS_MIN ||
      parsed > CROSSING_ABSENCE_SPINS_MAX
    ) {
      toast.error(t("automationStats.fibonacciAbsenceInvalid"));
      return;
    }
    setSavingCrossOppositeAbsenceAxis(axis);
    const result = await saveCrossingOppositeAxisAbsenceSpins(axis, Math.floor(parsed));
    setSavingCrossOppositeAbsenceAxis(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    setCrossOppositeDraftCorAltura(String(result.data.crossingOppositeAbsence.corAltura.absenceSpins));
    setCrossOppositeDraftAlturaParidade(
      String(result.data.crossingOppositeAbsence.alturaParidade.absenceSpins),
    );
    applyAutomationPrefsFromDto(result.data);
    toast.success(t("automationStats.fibonacciAbsenceSaved"));
  }

  const sourceLabel =
    data?.source === "extension"
      ? t("automationStats.sourceExtension")
      : data?.source === "server"
        ? t("automationStats.sourceServer")
        : t("automationStats.sourceUnknown");

  const panelBodyMessage = loading
    ? t("common.loading")
    : loadFailed
      ? t("automationStats.loadError")
      : null;

  function renderFibonacciZoneRow(
    id: FibonacciZoneToggleId,
    zoneKind: FibonacciZoneKind,
    labelKey: "fibonacciDozen" | "fibonacciColumn",
    zone: AutomationStatsDto["fibonacci"]["dozen"],
  ) {
    const draft = zoneKind === "dozen" ? absenceDraftDozen : absenceDraftColumn;
    const setDraft = zoneKind === "dozen" ? setAbsenceDraftDozen : setAbsenceDraftColumn;
    const absenceDirty = data != null && Number(draft) !== zone.absenceSpins;
    const inputId = zoneKind === "dozen" ? "fib-absence-dozen" : "fib-absence-column";

    return (
      <div
        key={id}
        className={cn(
          "rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5",
          !zone.enabled && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary">
              {triggerLabel(messages, labelKey)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                accuracyTone(zone.accuracyPct),
              )}
            >
              {loading ? "…" : formatAccuracy(zone.accuracyPct)}
            </p>
            {!loading && zone.total > 0 ? (
              <p className="text-[11px] tabular-nums text-text-secondary">
                {zone.wins}V / {zone.losses}D
              </p>
            ) : (
              <p className="text-[11px] text-text-secondary">{t("automationStats.noData")}</p>
            )}
          </div>
          <Switch
            checked={zone.enabled}
            disabled={loading || togglingId === id}
            aria-label={triggerLabel(messages, labelKey)}
            onCheckedChange={(checked) => void handleToggleTrigger(id, checked)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border-color/70 pt-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-secondary" htmlFor={inputId}>
              {t("automationStats.fibonacciAbsenceLabel")}
            </label>
            <Input
              id={inputId}
              type="number"
              min={FIBONACCI_ABSENCE_SPINS_MIN}
              max={FIBONACCI_ABSENCE_SPINS_MAX}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-20 tabular-nums text-sm"
              disabled={loading || savingAbsenceZone === zoneKind}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={absenceDirty ? "default" : "secondary"}
            disabled={loading || savingAbsenceZone === zoneKind || !absenceDirty}
            onClick={() => void handleConfirmZoneAbsence(zoneKind)}
          >
            {savingAbsenceZone === zoneKind ? "…" : t("automationStats.fibonacciAbsenceConfirm")}
          </Button>
        </div>
        {!loading ? (
          <p className="mt-2 text-[11px] text-text-secondary">
            {t("automationStats.fibonacciAbsenceConfirmed", { spins: zone.absenceSpins })}
          </p>
        ) : null}
      </div>
    );
  }

  function renderRepeticaoZoneRow(
    id: RepeticaoZoneToggleId,
    zoneKind: FibonacciZoneKind,
    labelKey: "repeticaoDozen" | "repeticaoColumn",
    zone: AutomationStatsDto["repeticao"]["dozen"],
  ) {
    const draft = zoneKind === "dozen" ? repAbsenceDraftDozen : repAbsenceDraftColumn;
    const setDraft = zoneKind === "dozen" ? setRepAbsenceDraftDozen : setRepAbsenceDraftColumn;
    const absenceDirty = data != null && Number(draft) !== zone.absenceSpins;
    const inputId = zoneKind === "dozen" ? "rep-absence-dozen" : "rep-absence-column";

    return (
      <div
        key={id}
        className={cn(
          "rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5",
          !zone.enabled && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary">
              {triggerLabel(messages, labelKey)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                accuracyTone(zone.accuracyPct),
              )}
            >
              {loading ? "…" : formatAccuracy(zone.accuracyPct)}
            </p>
            {!loading && zone.total > 0 ? (
              <p className="text-[11px] tabular-nums text-text-secondary">
                {zone.wins}V / {zone.losses}D
              </p>
            ) : (
              <p className="text-[11px] text-text-secondary">{t("automationStats.noData")}</p>
            )}
          </div>
          <Switch
            checked={zone.enabled}
            disabled={loading || togglingId === id}
            aria-label={triggerLabel(messages, labelKey)}
            onCheckedChange={(checked) => void handleToggleTrigger(id, checked)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border-color/70 pt-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-text-secondary" htmlFor={inputId}>
              {t("automationStats.fibonacciAbsenceLabel")}
            </label>
            <Input
              id={inputId}
              type="number"
              min={FIBONACCI_ABSENCE_SPINS_MIN}
              max={FIBONACCI_ABSENCE_SPINS_MAX}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-20 tabular-nums text-sm"
              disabled={loading || savingRepAbsenceZone === zoneKind}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={absenceDirty ? "default" : "secondary"}
            disabled={loading || savingRepAbsenceZone === zoneKind || !absenceDirty}
            onClick={() => void handleConfirmRepeticaoZoneAbsence(zoneKind)}
          >
            {savingRepAbsenceZone === zoneKind ? "…" : t("automationStats.fibonacciAbsenceConfirm")}
          </Button>
        </div>
        {!loading ? (
          <p className="mt-2 text-[11px] text-text-secondary">
            {t("automationStats.fibonacciAbsenceConfirmed", { spins: zone.absenceSpins })}
          </p>
        ) : null}
      </div>
    );
  }

  function renderCrossingAbsenceAxisRow(
    id: CrossingAbsenceToggleId,
    axisKind: CrossingAbsenceAxisKind,
    labelKey: "crossingCorAltura" | "crossingAlturaParidade",
    zone: AutomationStatsDto["crossingAbsence"]["corAltura"],
  ) {
    const draft = axisKind === "corAltura" ? crossAbsenceDraftCorAltura : crossAbsenceDraftAlturaParidade;
    const setDraft =
      axisKind === "corAltura" ? setCrossAbsenceDraftCorAltura : setCrossAbsenceDraftAlturaParidade;
    const absenceDirty =
      data != null && !zone.absenceAuto && Number(draft) !== zone.absenceSpins;
    const inputId = axisKind === "corAltura" ? "cross-absence-cor-altura" : "cross-absence-altura-paridade";
    const maxInWindow = zone.maxAbsenceInWindow ?? 0;

    return (
      <div
        key={id}
        className={cn(
          "rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5",
          !zone.enabled && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary">
              {triggerLabel(messages, labelKey)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                accuracyTone(zone.accuracyPct),
              )}
            >
              {loading ? "…" : formatAccuracy(zone.accuracyPct)}
            </p>
            {!loading && zone.total > 0 ? (
              <p className="text-[11px] tabular-nums text-text-secondary">
                {zone.wins}V / {zone.losses}D
              </p>
            ) : (
              <p className="text-[11px] text-text-secondary">{t("automationStats.noData")}</p>
            )}
          </div>
          <Switch
            checked={zone.enabled}
            disabled={loading || togglingId === id}
            aria-label={triggerLabel(messages, labelKey)}
            onCheckedChange={(checked) => void handleToggleTrigger(id, checked)}
          />
        </div>
        <div className="mt-3 space-y-2 border-t border-border-color/70 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-text-secondary" htmlFor={inputId}>
              {t("automationStats.fibonacciAbsenceLabel")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary">
                {t("automationStats.crossingAbsenceManual")}
              </span>
              <Switch
                checked={zone.absenceAuto === true}
                disabled={loading || togglingCrossAbsenceAuto === axisKind}
                aria-label={t("automationStats.crossingAbsenceAuto")}
                onCheckedChange={(checked) =>
                  void handleToggleCrossingAxisAbsenceAuto(axisKind, checked)
                }
              />
              <span className="text-[10px] font-medium text-text-primary">
                {t("automationStats.crossingAbsenceAuto")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id={inputId}
              type="number"
              min={CROSSING_ABSENCE_SPINS_MIN}
              max={CROSSING_ABSENCE_SPINS_MAX}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-20 tabular-nums text-sm"
              disabled={
                loading ||
                savingCrossAbsenceAxis === axisKind ||
                zone.absenceAuto === true
              }
            />
            <Button
              type="button"
              size="sm"
              variant={absenceDirty ? "default" : "secondary"}
              disabled={
                loading ||
                savingCrossAbsenceAxis === axisKind ||
                zone.absenceAuto === true ||
                !absenceDirty
              }
              onClick={() => void handleConfirmCrossingAxisAbsence(axisKind)}
            >
              {savingCrossAbsenceAxis === axisKind ? "…" : t("automationStats.fibonacciAbsenceConfirm")}
            </Button>
          </div>
        </div>
        {!loading ? (
          <p className="mt-2 text-[11px] text-text-secondary">
            {zone.absenceAuto
              ? t("automationStats.crossingAbsenceAutoActive", {
                  max: maxInWindow,
                  spins: zone.absenceSpins,
                })
              : t("automationStats.fibonacciAbsenceConfirmed", { spins: zone.absenceSpins })}
          </p>
        ) : null}
      </div>
    );
  }

  function renderCrossingOppositeAbsenceAxisRow(
    id: CrossingOppositeAbsenceToggleId,
    axisKind: CrossingAbsenceAxisKind,
    labelKey: "crossingOppositeCorAltura" | "crossingOppositeAlturaParidade",
    zone: AutomationStatsDto["crossingOppositeAbsence"]["corAltura"],
  ) {
    const draft = axisKind === "corAltura" ? crossOppositeDraftCorAltura : crossOppositeDraftAlturaParidade;
    const setDraft =
      axisKind === "corAltura" ? setCrossOppositeDraftCorAltura : setCrossOppositeDraftAlturaParidade;
    const absenceDirty =
      data != null && !zone.absenceAuto && Number(draft) !== zone.absenceSpins;
    const inputId =
      axisKind === "corAltura" ? "cross-opposite-absence-cor-altura" : "cross-opposite-absence-altura-paridade";
    const maxInWindow = zone.maxAbsenceInWindow ?? 0;

    return (
      <div
        key={id}
        className={cn(
          "rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5",
          !zone.enabled && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary">
              {triggerLabel(messages, labelKey)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                accuracyTone(zone.accuracyPct),
              )}
            >
              {loading ? "…" : formatAccuracy(zone.accuracyPct)}
            </p>
            {!loading && zone.total > 0 ? (
              <p className="text-[11px] tabular-nums text-text-secondary">
                {zone.wins}V / {zone.losses}D
              </p>
            ) : (
              <p className="text-[11px] text-text-secondary">{t("automationStats.noData")}</p>
            )}
          </div>
          <Switch
            checked={zone.enabled}
            disabled={loading || togglingId === id}
            aria-label={triggerLabel(messages, labelKey)}
            onCheckedChange={(checked) => void handleToggleTrigger(id, checked)}
          />
        </div>
        <div className="mt-3 space-y-2 border-t border-border-color/70 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-text-secondary" htmlFor={inputId}>
              {t("automationStats.fibonacciAbsenceLabel")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary">
                {t("automationStats.crossingAbsenceManual")}
              </span>
              <Switch
                checked={zone.absenceAuto === true}
                disabled={loading || togglingCrossOppositeAbsenceAuto === axisKind}
                aria-label={t("automationStats.crossingAbsenceAuto")}
                onCheckedChange={(checked) =>
                  void handleToggleCrossingOppositeAxisAbsenceAuto(axisKind, checked)
                }
              />
              <span className="text-[10px] font-medium text-text-primary">
                {t("automationStats.crossingAbsenceAuto")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id={inputId}
              type="number"
              min={CROSSING_ABSENCE_SPINS_MIN}
              max={CROSSING_ABSENCE_SPINS_MAX}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-20 tabular-nums text-sm"
              disabled={
                loading ||
                savingCrossOppositeAbsenceAxis === axisKind ||
                zone.absenceAuto === true
              }
            />
            <Button
              type="button"
              size="sm"
              variant={absenceDirty ? "default" : "secondary"}
              disabled={
                loading ||
                savingCrossOppositeAbsenceAxis === axisKind ||
                zone.absenceAuto === true ||
                !absenceDirty
              }
              onClick={() => void handleConfirmCrossingOppositeAxisAbsence(axisKind)}
            >
              {savingCrossOppositeAbsenceAxis === axisKind
                ? "…"
                : t("automationStats.fibonacciAbsenceConfirm")}
            </Button>
          </div>
        </div>
        {!loading ? (
          <p className="mt-2 text-[11px] text-text-secondary">
            {zone.absenceAuto
              ? t("automationStats.crossingAbsenceAutoActive", {
                  max: maxInWindow,
                  spins: zone.absenceSpins,
                })
              : t("automationStats.fibonacciAbsenceConfirmed", { spins: zone.absenceSpins })}
          </p>
        ) : null}
      </div>
    );
  }

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
        {!loading && data ? (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {t("automationStats.fibonacciZoneStats")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {renderFibonacciZoneRow("fibonacciDozen", "dozen", "fibonacciDozen", data.fibonacci.dozen)}
              {renderFibonacciZoneRow("fibonacciColumn", "column", "fibonacciColumn", data.fibonacci.column)}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{panelBodyMessage}</p>
        )}
        {!loading && data?.absenceFilterStats ? (
          <div className="mt-4 border-t border-border-color pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {t("automationStats.absenceFilterTitle")}
            </p>
            <AbsenceFilterStatsTable
            block={data.absenceFilterStats.fibonacci}
            labels={{
              hint: t("automationStats.absenceFilterHint"),
              maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
              colFilter: t("automationStats.absenceFilterColFilter"),
              colSample: t("automationStats.absenceFilterColSample"),
              colMaxAtTrigger: t("automationStats.absenceFilterColMaxTrigger"),
              colWinAfter: t("automationStats.absenceFilterColWinAfter"),
              colUnresolved: t("automationStats.absenceFilterColUnresolved"),
              noData: t("automationStats.absenceFilterNoData"),
              spinLabel: (n) => t("automationStats.absenceFilterWinAfterSpin", { n }),
            }}
          />
          </div>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("automationStats.repeticaoTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.repeticaoHint")}</p>
        {!loading && data ? (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {t("automationStats.repeticaoZoneStats")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {renderRepeticaoZoneRow("repeticaoDozen", "dozen", "repeticaoDozen", data.repeticao.dozen)}
              {renderRepeticaoZoneRow("repeticaoColumn", "column", "repeticaoColumn", data.repeticao.column)}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{panelBodyMessage}</p>
        )}
        {!loading && data?.absenceFilterStats ? (
          <div className="mt-4 border-t border-border-color pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {t("automationStats.absenceFilterTitle")}
            </p>
            <AbsenceFilterStatsTable
            block={data.absenceFilterStats.repeticao}
            labels={{
              hint: t("automationStats.absenceFilterHint"),
              maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
              colFilter: t("automationStats.absenceFilterColFilter"),
              colSample: t("automationStats.absenceFilterColSample"),
              colMaxAtTrigger: t("automationStats.absenceFilterColMaxTrigger"),
              colWinAfter: t("automationStats.absenceFilterColWinAfter"),
              colUnresolved: t("automationStats.absenceFilterColUnresolved"),
              noData: t("automationStats.absenceFilterNoData"),
              spinLabel: (n) => t("automationStats.absenceFilterWinAfterSpin", { n }),
            }}
          />
          </div>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("automationStats.crossingAbsenceTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.crossingAbsenceHint")}</p>
        {!loading && data ? (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {t("automationStats.crossingZoneStats")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {renderCrossingAbsenceAxisRow(
                "crossingCorAltura",
                "corAltura",
                "crossingCorAltura",
                data.crossingAbsence.corAltura,
              )}
              {renderCrossingAbsenceAxisRow(
                "crossingAlturaParidade",
                "alturaParidade",
                "crossingAlturaParidade",
                data.crossingAbsence.alturaParidade,
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{panelBodyMessage}</p>
        )}
        {!loading && data?.absenceFilterStats?.crossing ? (
          <>
            <div className="mt-4 border-t border-border-color pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {t("automationStats.absenceFilterTitle")} — {triggerLabel(messages, "crossingCorAltura")}
              </p>
              <AbsenceFilterStatsTable
                block={data.absenceFilterStats.crossing.corAltura}
                labels={{
                  hint: t("automationStats.absenceFilterHint"),
                  maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
                  colFilter: t("automationStats.absenceFilterColFilter"),
                  colSample: t("automationStats.absenceFilterColSample"),
                  colMaxAtTrigger: t("automationStats.absenceFilterColMaxTrigger"),
                  colWinAfter: t("automationStats.absenceFilterColWinAfter"),
                  colUnresolved: t("automationStats.absenceFilterColUnresolved"),
                  noData: t("automationStats.absenceFilterNoData"),
                  spinLabel: (n) => t("automationStats.absenceFilterWinAfterSpin", { n }),
                }}
              />
            </div>
            <div className="mt-4 border-t border-border-color pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {t("automationStats.absenceFilterTitle")} — {triggerLabel(messages, "crossingAlturaParidade")}
              </p>
              <AbsenceFilterStatsTable
                block={data.absenceFilterStats.crossing.alturaParidade}
                labels={{
                  hint: t("automationStats.absenceFilterHint"),
                  maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
                  colFilter: t("automationStats.absenceFilterColFilter"),
                  colSample: t("automationStats.absenceFilterColSample"),
                  colMaxAtTrigger: t("automationStats.absenceFilterColMaxTrigger"),
                  colWinAfter: t("automationStats.absenceFilterColWinAfter"),
                  colUnresolved: t("automationStats.absenceFilterColUnresolved"),
                  noData: t("automationStats.absenceFilterNoData"),
                  spinLabel: (n) => t("automationStats.absenceFilterWinAfterSpin", { n }),
                }}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {t("automationStats.crossingOppositeAbsenceTitle")}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.crossingOppositeAbsenceHint")}</p>
        {!loading && data ? (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {t("automationStats.crossingZoneStats")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {renderCrossingOppositeAbsenceAxisRow(
                "crossingCorAlturaOpposite",
                "corAltura",
                "crossingOppositeCorAltura",
                data.crossingOppositeAbsence.corAltura,
              )}
              {renderCrossingOppositeAbsenceAxisRow(
                "crossingAlturaParidadeOpposite",
                "alturaParidade",
                "crossingOppositeAlturaParidade",
                data.crossingOppositeAbsence.alturaParidade,
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{panelBodyMessage}</p>
        )}
        {!loading && data?.absenceFilterStats?.crossingOpposite ? (
          <>
            <div className="mt-4 border-t border-border-color pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {t("automationStats.absenceFilterTitle")} —{" "}
                {triggerLabel(messages, "crossingOppositeCorAltura")}
              </p>
              <AbsenceFilterStatsTable
                block={data.absenceFilterStats.crossingOpposite.corAltura}
                labels={{
                  hint: t("automationStats.absenceFilterHint"),
                  maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
                  colFilter: t("automationStats.absenceFilterColFilter"),
                  colSample: t("automationStats.absenceFilterColSample"),
                  colMaxAtTrigger: t("automationStats.absenceFilterColMaxTrigger"),
                  colWinAfter: t("automationStats.absenceFilterColWinAfter"),
                  colUnresolved: t("automationStats.absenceFilterColUnresolved"),
                  noData: t("automationStats.absenceFilterNoData"),
                  spinLabel: (n) => t("automationStats.absenceFilterWinAfterSpin", { n }),
                }}
              />
            </div>
            <div className="mt-4 border-t border-border-color pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {t("automationStats.absenceFilterTitle")} —{" "}
                {triggerLabel(messages, "crossingOppositeAlturaParidade")}
              </p>
              <AbsenceFilterStatsTable
                block={data.absenceFilterStats.crossingOpposite.alturaParidade}
                labels={{
                  hint: t("automationStats.absenceFilterHint"),
                  maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
                  colFilter: t("automationStats.absenceFilterColFilter"),
                  colSample: t("automationStats.absenceFilterColSample"),
                  colMaxAtTrigger: t("automationStats.absenceFilterColMaxTrigger"),
                  colWinAfter: t("automationStats.absenceFilterColWinAfter"),
                  colUnresolved: t("automationStats.absenceFilterColUnresolved"),
                  noData: t("automationStats.absenceFilterNoData"),
                  spinLabel: (n) => t("automationStats.absenceFilterWinAfterSpin", { n }),
                }}
              />
            </div>
          </>
        ) : null}
        {!loading && data?.absenceFilterStats?.crossingReturnStreak ? (
          <>
            <div className="mt-4 border-t border-border-color pt-4">
              <h3 className="text-xs font-bold text-text-primary">
                {t("automationStats.returnStreakTitle")}
              </h3>
              <p className="mt-1 text-[11px] text-text-secondary">
                {t("automationStats.returnStreakHint")}
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {triggerLabel(messages, "crossingCorAltura")}
              </p>
              <ReturnStreakStatsTable
                block={data.absenceFilterStats.crossingReturnStreak.corAltura}
                labels={{
                  hint: t("automationStats.returnStreakHint"),
                  maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
                  colFilter: t("automationStats.absenceFilterColFilter"),
                  colSample: t("automationStats.absenceFilterColSample"),
                  colMaxStreak: t("automationStats.returnStreakColMaxStreak"),
                  colStreakDistribution: "",
                  colUnresolved: t("automationStats.absenceFilterColUnresolved"),
                  noData: t("automationStats.absenceFilterNoData"),
                  streakLabel: (n) => t("automationStats.returnStreakLabel", { n }),
                }}
              />
            </div>
            <div className="mt-4 border-t border-border-color pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {triggerLabel(messages, "crossingAlturaParidade")}
              </p>
              <ReturnStreakStatsTable
                block={data.absenceFilterStats.crossingReturnStreak.alturaParidade}
                labels={{
                  hint: t("automationStats.returnStreakHint"),
                  maxInWindow: t("automationStats.absenceFilterMaxInWindow"),
                  colFilter: t("automationStats.absenceFilterColFilter"),
                  colSample: t("automationStats.absenceFilterColSample"),
                  colMaxStreak: t("automationStats.returnStreakColMaxStreak"),
                  colStreakDistribution: "",
                  colUnresolved: t("automationStats.absenceFilterColUnresolved"),
                  noData: t("automationStats.absenceFilterNoData"),
                  streakLabel: (n) => t("automationStats.returnStreakLabel", { n }),
                }}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("automationStats.triggersTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("automationStats.triggersHint")}</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          {loading ? (
            <p className="px-4 py-6 text-sm text-text-secondary">{panelBodyMessage}</p>
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
                  .filter(
                    (row) =>
                      row.id !== "two" &&
                      row.id !== "fibonacci" &&
                      row.id !== "crossing-cor-altura" &&
                      row.id !== "crossing-altura-paridade" &&
                      row.id !== "crossing-opposite-cor-altura" &&
                      row.id !== "crossing-opposite-altura-paridade",
                  )
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
