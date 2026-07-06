import type { GlobalAutomationConfig } from "@/lib/back-office/automation-config";
import type { TableCrossingAbsenceTriggerRow } from "@/lib/back-office/automation-stats-types";
import type { CrossingAbsenceAxisKind } from "@/lib/roulette/crossingAbsencePrefs";
import { maxCrossingOppositeAbsenceInWindowForTable } from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import {
  type CrossingOppositeAbsenceByTable,
  crossingOppositeAutoAbsenceSpinsFromMax,
  normalizeCrossingOppositeAxisAbsenceAuto,
  normalizeCrossingOppositeAxisAbsenceSpins,
  setServerCrossingOppositeAbsenceByTable,
  setServerCrossingOppositeAxisAbsenceAuto,
} from "@/lib/roulette/crossingOppositeAbsencePrefs";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";

function averageFromByTable(
  byTable: CrossingOppositeAbsenceByTable,
  kind: CrossingAbsenceAxisKind,
): number {
  const values = Object.values(byTable)
    .map((row) => row[kind])
    .filter((v) => v > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function averagePerTableMaxCrossingOppositeAbsenceInWindow(
  histories: Record<number, readonly number[]>,
  kind: CrossingAbsenceAxisKind,
): number {
  const values: number[] = [];
  for (const history of Object.values(histories)) {
    if (!history.length) continue;
    const max = maxCrossingOppositeAbsenceInWindowForTable(history, kind);
    if (max > 0) values.push(max);
  }
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function buildCrossingOppositeAbsenceSpinsByTable(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): CrossingOppositeAbsenceByTable {
  const global = normalizeCrossingOppositeAxisAbsenceSpins(config);
  const out: CrossingOppositeAbsenceByTable = {};

  for (const [tableIdRaw, history] of Object.entries(histories)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId) || history.length === 0) continue;

    const corMax = maxCrossingOppositeAbsenceInWindowForTable(history, "corAltura");
    const altMax = maxCrossingOppositeAbsenceInWindowForTable(history, "alturaParidade");

    out[tableId] = {
      corAltura:
        config.crossingCorAlturaOppositeAbsenceAuto && corMax > 0
          ? crossingOppositeAutoAbsenceSpinsFromMax(corMax)
          : global.corAltura,
      alturaParidade:
        config.crossingAlturaParidadeOppositeAbsenceAuto && altMax > 0
          ? crossingOppositeAutoAbsenceSpinsFromMax(altMax)
          : global.alturaParidade,
    };
  }

  return out;
}

export function averageCrossingOppositeAbsenceSpinsPerTable(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
  kind: CrossingAbsenceAxisKind,
): number {
  if (kind === "corAltura" && !config.crossingCorAlturaOppositeAbsenceAuto) {
    return normalizeCrossingOppositeAxisAbsenceSpins(config).corAltura;
  }
  if (kind === "alturaParidade" && !config.crossingAlturaParidadeOppositeAbsenceAuto) {
    return normalizeCrossingOppositeAxisAbsenceSpins(config).alturaParidade;
  }
  return averageFromByTable(buildCrossingOppositeAbsenceSpinsByTable(config, histories), kind);
}

export function buildTableCrossingOppositeAbsenceTriggerRows(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): TableCrossingAbsenceTriggerRow[] {
  const global = normalizeCrossingOppositeAxisAbsenceSpins(config);
  const auto = normalizeCrossingOppositeAxisAbsenceAuto(config);
  const byTable = buildCrossingOppositeAbsenceSpinsByTable(config, histories);
  const rows: TableCrossingAbsenceTriggerRow[] = [];

  for (const [tableIdRaw, history] of Object.entries(histories)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId) || history.length === 0) continue;

    const corMax = maxCrossingOppositeAbsenceInWindowForTable(history, "corAltura");
    const altMax = maxCrossingOppositeAbsenceInWindowForTable(history, "alturaParidade");
    const triggers = byTable[tableId];

    rows.push({
      tableId,
      label: lobbyTableDisplayName(tableId),
      corAlturaMax: corMax,
      corAlturaTrigger: triggers?.corAltura ?? global.corAltura,
      alturaParidadeMax: altMax,
      alturaParidadeTrigger: triggers?.alturaParidade ?? global.alturaParidade,
      corAlturaAuto: auto.corAltura,
      alturaParidadeAuto: auto.alturaParidade,
    });
  }

  rows.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return rows;
}

/** Actualiza giros por mesa quando o modo automático está activo (cada roleta com a sua ausência). */
export function applyCrossingOppositeAutoAbsenceRuntime(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): GlobalAutomationConfig {
  const auto = normalizeCrossingOppositeAxisAbsenceAuto(config);
  setServerCrossingOppositeAxisAbsenceAuto(auto);

  if (!config.crossingCorAlturaOppositeAbsenceAuto && !config.crossingAlturaParidadeOppositeAbsenceAuto) {
    setServerCrossingOppositeAbsenceByTable(null);
    return config;
  }

  setServerCrossingOppositeAbsenceByTable(buildCrossingOppositeAbsenceSpinsByTable(config, histories));
  return config;
}
