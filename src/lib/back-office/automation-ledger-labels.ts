import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";
import {
  isZoneFibonacciStrategy,
  zoneFibonacciStepLabel,
} from "@/lib/roulette/zoneFibonacciFamily";

export type GlobalAutomationSettleLabelInput = {
  tableLabel: string;
  recovery: number;
  kind: "win" | "loss" | "recovery";
  won: boolean;
  stake: number;
  strategy?: StrategyGlobalKind;
  resultNumber?: number;
};

function formatLedgerStake(stake: number): string {
  const abs = Math.abs(stake);
  if (abs > 0 && abs < 1) return abs.toFixed(2).replace(".", ",");
  if (abs % 1 !== 0) return abs.toFixed(2).replace(".", ",");
  return abs.toFixed(0);
}

/** Descrição no extrato da automação global (ex.: `Roulette Macao · Giro 5 · Fibo 1`). */
export function formatGlobalAutomationSettleDescription(
  input: GlobalAutomationSettleLabelInput,
): string {
  if (isZoneFibonacciStrategy(input.strategy)) {
    const parts = [input.tableLabel];
    if (input.resultNumber != null) {
      parts.push(`Giro ${input.resultNumber}`);
    }
    parts.push(zoneFibonacciStepLabel(input.strategy, input.recovery, input.kind));
    return parts.join(" · ");
  }

  if (input.strategy === "rotacao") {
    const parts = [input.tableLabel, "Rotação"];
    if (input.resultNumber != null) {
      parts.push(`Giro ${input.resultNumber}`);
    }
    if (input.recovery > 0 || input.kind === "recovery" || input.kind === "loss") {
      parts.push(`gale ${input.recovery}`);
    }
    return parts.join(" · ");
  }

  if (input.strategy === "kto2fcruzamento") {
    const parts = [input.tableLabel, "KTO 2F"];
    if (input.resultNumber != null) {
      parts.push(`Giro ${input.resultNumber}`);
    }
    if (input.recovery > 0 || input.kind === "recovery" || input.kind === "loss") {
      parts.push(`gale ${input.recovery}`);
    }
    return parts.join(" · ");
  }

  if (input.strategy === "tres3fatores") {
    const parts = [input.tableLabel, "ICE 3F"];
    if (input.resultNumber != null) {
      parts.push(`Giro ${input.resultNumber}`);
    }
    if (input.recovery > 0 || input.kind === "recovery" || input.kind === "loss") {
      parts.push(`gale ${input.recovery}`);
    }
    const stakeNote =
      typeof input.stake === "number" && input.stake > 0
        ? ` · R$ ${formatLedgerStake(input.stake)}`
        : "";
    return parts.join(" · ") + stakeNote;
  }

  const recoveryNote = input.recovery > 0 ? ` · gale ${input.recovery}` : "";
  const baseDesc = `Automação global — ${input.tableLabel}${recoveryNote}`;

  if (input.won) {
    return `${baseDesc} · vitória (+R$ ${formatLedgerStake(input.stake)})`;
  }

  return `${baseDesc} · ${input.kind === "loss" ? "derrota" : "recuperação"} (-R$ ${formatLedgerStake(input.stake)})`;
}

export function formatAutomationRoundDescription(input: {
  tableLabel: string;
  resultNumber?: number;
  recovery: number;
  badge: string;
  strategy?: StrategyGlobalKind;
}): string {
  const kind =
    input.badge === "VITÓRIA" || input.badge === "WIN"
      ? "win"
      : input.badge === "DERROTA" || input.badge === "LOSS"
        ? "loss"
        : input.badge === "RECUPERAÇÃO" || input.badge === "RECOVERY"
          ? "recovery"
          : "win";

  if (isZoneFibonacciStrategy(input.strategy)) {
    return formatGlobalAutomationSettleDescription({
      tableLabel: input.tableLabel,
      recovery: input.recovery,
      kind,
      won: kind === "win",
      stake: 0,
      strategy: input.strategy,
      resultNumber: input.resultNumber,
    });
  }

  const parts = [input.tableLabel];
  if (input.resultNumber != null) {
    parts.push(`Giro ${input.resultNumber}`);
  }
  const level = Math.max(0, Math.floor(input.recovery));
  if (level > 0) {
    parts.push(`gale ${level}`);
  } else if (input.badge !== "EM JOGO" && input.badge !== "IN PLAY") {
    parts.push("entrada");
  }
  return parts.join(" · ");
}
