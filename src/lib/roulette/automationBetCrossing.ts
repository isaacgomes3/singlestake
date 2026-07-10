import type { AutomationPendingSignal } from "@/lib/back-office/rouletteAutomationSim";
import type { DoisFatoresActive, DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import { kto2fActiveToCrossing } from "@/lib/roulette/rotatingRoomKto2fStrategy";
import { rotacaoActiveToCrossing } from "@/lib/roulette/rotatingRoomRotacaoStrategy";
import {
  PRAGMATIC_EXTERIOR_BET_PROFILES,
  type PragmaticExteriorBetKey,
} from "@/lib/roulette/pragmaticExteriorBetMap";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";

export type AutomationBetCrossingInput = Pick<
  AutomationPendingSignal,
  "tableId" | "recovery" | "strategy" | "signalId" | "alertLabel" | "umActive" | "activeCrossing" | "rotacaoActive" | "kto2fActive"
>;

function factorFromExteriorKey(key: PragmaticExteriorBetKey): DoisFatoresFactor {
  switch (key) {
    case "odd":
      return { kind: "paridade", value: "Ímpar" };
    case "even":
      return { kind: "paridade", value: "Par" };
    case "red":
      return { kind: "cor", value: "Vermelho" };
    case "black":
      return { kind: "cor", value: "Preto" };
    case "low":
      return { kind: "altura", value: "Baixo" };
    case "high":
      return { kind: "altura", value: "Alto" };
  }
}

function matchExteriorKeyFromLabel(label: string): PragmaticExteriorBetKey | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  for (const profile of Object.values(PRAGMATIC_EXTERIOR_BET_PROFILES)) {
    if (profile.appLabel === trimmed) return profile.key;
  }
  const lower = trimmed.toLowerCase();
  for (const profile of Object.values(PRAGMATIC_EXTERIOR_BET_PROFILES)) {
    if (profile.textHints.some((hint) => lower.includes(hint))) return profile.key;
  }
  return null;
}

/** Reconstrói factor a partir do rótulo da automação (ex.: «Ímpar», «Vermelho · Par»). */
export function doisFatoresFactorFromAlertLabel(label?: string | null): DoisFatoresFactor | null {
  if (!label?.trim()) return null;
  const primary = label.split("·")[0]?.trim() ?? label.trim();
  const key = matchExteriorKeyFromLabel(primary);
  return key ? factorFromExteriorKey(key) : null;
}

function referenceNumberFromSignalId(signalId?: string | null): number {
  if (!signalId?.trim()) return 0;
  const part = signalId.trim().split(":")[1];
  const n = parseInt(part ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

/** Deriva `activeCrossing` mesmo quando o servidor só envia `alertLabel` (sem `umActive`). */
export function activeCrossingFromAutomationBet(
  bet: AutomationBetCrossingInput,
): DoisFatoresActive | null {
  if (bet.activeCrossing) return bet.activeCrossing;
  if (bet.rotacaoActive) return rotacaoActiveToCrossing(bet.rotacaoActive);
  if (bet.kto2fActive) return kto2fActiveToCrossing(bet.kto2fActive);
  if (bet.umActive) return umFatorToTapeteActive(bet.umActive);

  const factor1 = doisFatoresFactorFromAlertLabel(bet.alertLabel);
  if (!factor1) return null;

  const parts = bet.alertLabel?.split("·").map((s) => s.trim()) ?? [];
  let factor2 = factor1;
  if (bet.strategy === "dois2fatores" && parts.length >= 2) {
    factor2 = doisFatoresFactorFromAlertLabel(parts[1]) ?? factor1;
  }

  return {
    pairKind: "cor-paridade",
    pairKindLabel: "Automação",
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: referenceNumberFromSignalId(bet.signalId),
    factor1,
    factor2,
    triggerNumbers: [0, 0],
    armingDescription: bet.alertLabel ?? "",
  };
}
