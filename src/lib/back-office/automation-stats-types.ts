import type { UmFatorTriggerTierReportRow } from "@/lib/roulette/umFatorTriggerTiers";

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
};
