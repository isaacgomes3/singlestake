import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";

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
  if (input.strategy === "fibonacci") {
    const parts = [input.tableLabel];
    if (input.resultNumber != null) {
      parts.push(`Giro ${input.resultNumber}`);
    }
    if (input.kind === "recovery" || input.recovery > 0 || input.kind === "loss") {
      parts.push(`Fibo ${input.recovery + 1}`);
    } else {
      parts.push("Sinal");
    }
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

  if (input.strategy === "fibonacci") {
    return formatGlobalAutomationSettleDescription({
      tableLabel: input.tableLabel,
      recovery: input.recovery,
      kind,
      won: kind === "win",
      stake: 0,
      strategy: "fibonacci",
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
