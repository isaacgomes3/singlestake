import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type { ZoneAbsenceFilterStatsBlock } from "@/lib/roulette/zoneAbsenceFilterStats";
import type { CrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";
import type { CrossingOppositeAbsenceFilterStats } from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import type { CrossingReturnStreakStats } from "@/lib/roulette/crossingReturnStreakStats";

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
  fibonacci: {
    enabled: boolean;
    absenceSpins: number;
    dozen: AutomationStatsFibonacciZoneRow;
    column: AutomationStatsFibonacciZoneRow;
  };
  repeticao: {
    enabled: boolean;
    absenceSpins: number;
    dozen: AutomationStatsFibonacciZoneRow;
    column: AutomationStatsFibonacciZoneRow;
  };
  crossingAbsence: {
    corAltura: AutomationStatsFibonacciZoneRow;
    alturaParidade: AutomationStatsFibonacciZoneRow;
  };
  crossingOppositeAbsence: {
    corAltura: AutomationStatsFibonacciZoneRow;
    alturaParidade: AutomationStatsFibonacciZoneRow;
  };
  /** Gatilho de giros ausentes calculado por mesa (sala rotativa). */
  tableCrossingAbsenceTriggers: TableCrossingAbsenceTriggerRow[];
  tableCrossingOppositeAbsenceTriggers: TableCrossingAbsenceTriggerRow[];
  /** Simulação histórica por filtro de ausência (últimos 50 números — independente do gatilho). */
  absenceFilterStats: {
    fibonacci: ZoneAbsenceFilterStatsBlock;
    repeticao: ZoneAbsenceFilterStatsBlock;
    crossing: CrossingAbsenceFilterStats;
    crossingOpposite: CrossingOppositeAbsenceFilterStats;
    crossingReturnStreak: CrossingReturnStreakStats;
  };
};
