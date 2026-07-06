import type { GlobalAutomationConfig } from "@/lib/back-office/automation-config";
import type { TableCrossingAbsenceTriggerRow } from "@/lib/back-office/automation-stats-types";
import {
  maxCrossingAbsenceForAutoTriggerReference,
  maxCrossingAbsenceInWindowForTable,
} from "@/lib/roulette/crossingAbsenceFilterStats";
import {
  type CrossingAbsenceByTable,
  type CrossingAbsenceAxisKind,
  crossingAutoAbsenceSpinsFromMax,
  normalizeCrossingAxisAbsenceAuto,
  normalizeCrossingAxisAbsenceSpins,
  setServerCrossingAbsenceByTable,
  setServerCrossingAxisAbsenceAuto,
} from "@/lib/roulette/crossingAbsencePrefs";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";

function averageFromByTable(
  byTable: CrossingAbsenceByTable,
  kind: CrossingAbsenceAxisKind,
): number {
  const values = Object.values(byTable)
    .map((row) => row[kind])
    .filter((v) => v > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function averagePerTableMaxCrossingAbsenceInWindow(
  histories: Record<number, readonly number[]>,
  kind: CrossingAbsenceAxisKind,
): number {
  const values: number[] = [];
  for (const history of Object.values(histories)) {
    if (!history.length) continue;
    const max = maxCrossingAbsenceInWindowForTable(history, kind);
    if (max > 0) values.push(max);
  }
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function buildCrossingAbsenceSpinsByTable(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): CrossingAbsenceByTable {
  const global = normalizeCrossingAxisAbsenceSpins(config);
  const out: CrossingAbsenceByTable = {};

  for (const [tableIdRaw, history] of Object.entries(histories)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId) || history.length === 0) continue;

    const corReferenceMax = maxCrossingAbsenceForAutoTriggerReference(history, "corAltura");
    const altReferenceMax = maxCrossingAbsenceForAutoTriggerReference(history, "alturaParidade");

    out[tableId] = {
      corAltura:
        config.crossingCorAlturaAbsenceAuto && corReferenceMax > 0
          ? crossingAutoAbsenceSpinsFromMax(corReferenceMax)
          : global.corAltura,
      alturaParidade:
        config.crossingAlturaParidadeAbsenceAuto && altReferenceMax > 0
          ? crossingAutoAbsenceSpinsFromMax(altReferenceMax)
          : global.alturaParidade,
    };
  }

  return out;
}

export function averageCrossingAbsenceSpinsPerTable(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
  kind: CrossingAbsenceAxisKind,
): number {
  if (kind === "corAltura" && !config.crossingCorAlturaAbsenceAuto) {
    return normalizeCrossingAxisAbsenceSpins(config).corAltura;
  }
  if (kind === "alturaParidade" && !config.crossingAlturaParidadeAbsenceAuto) {
    return normalizeCrossingAxisAbsenceSpins(config).alturaParidade;
  }
  return averageFromByTable(buildCrossingAbsenceSpinsByTable(config, histories), kind);
}

export function buildTableCrossingAbsenceTriggerRows(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): TableCrossingAbsenceTriggerRow[] {
  const global = normalizeCrossingAxisAbsenceSpins(config);
  const auto = normalizeCrossingAxisAbsenceAuto(config);
  const byTable = buildCrossingAbsenceSpinsByTable(config, histories);
  const rows: TableCrossingAbsenceTriggerRow[] = [];

  for (const [tableIdRaw, history] of Object.entries(histories)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId) || history.length === 0) continue;

    const corMax = maxCrossingAbsenceInWindowForTable(history, "corAltura");
    const altMax = maxCrossingAbsenceInWindowForTable(history, "alturaParidade");
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

/** Actualiza giros por mesa quando o modo automático está activo. */
export function applyCrossingAutoAbsenceRuntime(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): GlobalAutomationConfig {
  const auto = normalizeCrossingAxisAbsenceAuto(config);
  setServerCrossingAxisAbsenceAuto(auto);

  if (!config.crossingCorAlturaAbsenceAuto && !config.crossingAlturaParidadeAbsenceAuto) {
    setServerCrossingAbsenceByTable(null);
    return config;
  }

  setServerCrossingAbsenceByTable(buildCrossingAbsenceSpinsByTable(config, histories));
  return config;
}
