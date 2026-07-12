import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";
import type { ZoneAbsenceFilterStatsBlock } from "@/lib/roulette/zoneAbsenceFilterStats";
import type { CrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";
import type { CrossingOppositeAbsenceFilterStats } from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import type { CrossingReturnStreakStats } from "@/lib/roulette/crossingReturnStreakStats";
import type { Ice3fOccurrenceStats } from "@/lib/roulette/ice3fOccurrenceStats";

export type AutomationStatsFibonacciZoneRow = {
  wins: number;
  losses: number;
  total: number;
  accuracyPct: number | null;
  enabled: boolean;
  absenceSpins: number;
  /** Modo automático: gatilho = máx. ausência na janela. */
  absenceAuto?: boolean;
  /** Máx. ausência na janela (últimos 50 giros) — referência do modo automático. */
  maxAbsenceInWindow?: number;
};

export type TableCrossingAbsenceTriggerRow = {
  tableId: number;
  label: string;
  corAlturaMax: number;
  corAlturaTrigger: number;
  alturaParidadeMax: number;
  alturaParidadeTrigger: number;
  corAlturaAuto: boolean;
  alturaParidadeAuto: boolean;
};

export type AutomationStatsDto = {
  updatedAt: number;
  /** Fonte activa dos sinais (extensão Chrome ou motor do servidor). */
  source: "extension" | "server" | null;
  session: {
    wins: number;
    losses: number;
    total: number;
    accuracyPct: number | null;
  };
  triggers: UmFatorTriggerTierReportRow[];
  /** Ocorrências ICE 3F na mesa 201 — duas últimas por número + antecedentes. */
  ice3fOccurrences: Ice3fOccurrenceStats;
  /** @deprecated Mantido para compatibilidade — UI já não usa. */
  fibonacci: {
    enabled: boolean;
    absenceSpins: number;
    dozen: AutomationStatsFibonacciZoneRow;
    column: AutomationStatsFibonacciZoneRow;
  };
  /** @deprecated */
  repeticao: {
    enabled: boolean;
    absenceSpins: number;
    dozen: AutomationStatsFibonacciZoneRow;
    column: AutomationStatsFibonacciZoneRow;
  };
  /** @deprecated */
  crossingAbsence: {
    corAltura: AutomationStatsFibonacciZoneRow;
    alturaParidade: AutomationStatsFibonacciZoneRow;
  };
  /** @deprecated */
  crossingOppositeAbsence: {
    corAltura: AutomationStatsFibonacciZoneRow;
    alturaParidade: AutomationStatsFibonacciZoneRow;
  };
  /** @deprecated */
  tableCrossingAbsenceTriggers: TableCrossingAbsenceTriggerRow[];
  /** @deprecated */
  tableCrossingOppositeAbsenceTriggers: TableCrossingAbsenceTriggerRow[];
  /** @deprecated */
  absenceFilterStats: {
    fibonacci: ZoneAbsenceFilterStatsBlock;
    repeticao: ZoneAbsenceFilterStatsBlock;
    crossing: CrossingAbsenceFilterStats;
    crossingOpposite: CrossingOppositeAbsenceFilterStats;
    crossingReturnStreak: CrossingReturnStreakStats;
  };
};
