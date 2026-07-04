import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type { ZoneAbsenceFilterStatsBlock } from "@/lib/roulette/zoneAbsenceFilterStats";
import type { CrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";

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
  /** Simulação histórica por filtro de ausência (últimos 50 números — independente do gatilho). */
  absenceFilterStats: {
    fibonacci: ZoneAbsenceFilterStatsBlock;
    repeticao: ZoneAbsenceFilterStatsBlock;
    crossing: CrossingAbsenceFilterStats;
  };
};
