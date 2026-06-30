import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";

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
  };
};
