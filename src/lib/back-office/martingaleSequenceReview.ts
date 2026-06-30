import type { StrategyGlobalLedgerEntry } from "@/lib/roulette/strategyGlobalTypes";
import { UM_FATOR_MAX_RECOVERY } from "@/lib/roulette/umFatorStrategy";
import { ROTATING_ROOM_FIBONACCI_MAX_RECOVERY } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

import {
  resolveLedgerEntryStake,
  ROULETTE_AUTOMATION_BASE_STAKE,
  stakeForFibonacciRecovery,
  stakeForRecovery,
} from "@/lib/back-office/automationStakes";

const STAKE_EPS = 0.009;

export type MartingaleReviewRound = {
  badge: string;
  recovery: number;
  net: number;
};

export type MartingaleReviewState = {
  rounds: readonly MartingaleReviewRound[];
  openBet?: { tableId?: number; recovery: number; stake: number } | null;
};

export type MartingaleReviewResult =
  | { accepted: true; stake: number; net: number }
  | { accepted: false; reason: string };

function lastRoundOutcome(round: MartingaleReviewRound): "win" | "partial" | "final" {
  if (round.badge === "VITÓRIA" || round.badge === "WIN" || round.net > 0) return "win";
  if (round.badge === "DERROTA" || round.badge === "LOSS") return "final";
  return "partial";
}

/** Próximo passo permitido no martingale após a última linha do histórico. */
export function expectedMartingaleStep(
  lastRound: MartingaleReviewRound | null,
  baseStake: number,
): { recovery: number; stake: number } {
  if (!lastRound) {
    return { recovery: 0, stake: stakeForRecovery(0, undefined, baseStake) };
  }

  const outcome = lastRoundOutcome(lastRound);
  if (outcome === "win" || outcome === "final") {
    return { recovery: 0, stake: stakeForRecovery(0, undefined, baseStake) };
  }

  const nextRecovery = Math.min(
    Math.max(0, Math.floor(lastRound.recovery)) + 1,
    UM_FATOR_MAX_RECOVERY,
  );
  return { recovery: nextRecovery, stake: stakeForRecovery(nextRecovery, undefined, baseStake) };
}

function describeLastRound(round: MartingaleReviewRound | null): string {
  if (!round) return "início do ciclo";
  if (round.badge === "RECUPERAÇÃO" || round.badge === "RECOVERY") {
    return `recuperação −R$ ${Math.abs(round.net).toFixed(2)}`;
  }
  if (round.badge === "VITÓRIA" || round.badge === "WIN") return "vitória";
  if (round.badge === "DERROTA" || round.badge === "LOSS") return "derrota final";
  return "resultado anterior";
}

function validateSettlementKind(
  entry: StrategyGlobalLedgerEntry,
  stake: number,
): MartingaleReviewResult {
  const net = entry.won ? stake : -stake;

  if (entry.won) {
    if (entry.kind !== "win") {
      return { accepted: false, reason: `vitória com kind inválido (${entry.kind})` };
    }
    return { accepted: true, stake, net };
  }

  if (entry.kind === "recovery") {
    if (Math.floor(entry.recovery) >= UM_FATOR_MAX_RECOVERY) {
      return { accepted: false, reason: "recuperação inválida no gale máximo" };
    }
    return { accepted: true, stake, net };
  }

  if (entry.kind === "loss") {
    if (Math.floor(entry.recovery) < UM_FATOR_MAX_RECOVERY) {
      return {
        accepted: false,
        reason: `derrota final só no gale ${UM_FATOR_MAX_RECOVERY}, recebido gale ${entry.recovery}`,
      };
    }
    return { accepted: true, stake, net };
  }

  return { accepted: false, reason: `tipo de liquidação desconhecido (${entry.kind})` };
}

/**
 * Revisor de sequência martingale — após recuperação −S o próximo só pode ser
 * recuperação −2S ou vitória +2S no gale seguinte (nunca outro valor).
 */
export function reviewMartingaleSettlement(
  state: MartingaleReviewState,
  entry: StrategyGlobalLedgerEntry,
  baseStake: number = ROULETTE_AUTOMATION_BASE_STAKE,
): MartingaleReviewResult {
  if (entry.strategy === "fibonacci") {
    const stake = resolveLedgerEntryStake(entry, undefined, baseStake);
    const recovery = Math.max(0, Math.floor(entry.recovery));
    const maxR = ROTATING_ROOM_FIBONACCI_MAX_RECOVERY;
    const net = entry.won ? stake : -stake;

    if (entry.won) {
      if (entry.kind !== "win") {
        return { accepted: false, reason: `vitória Fibonacci com kind inválido (${entry.kind})` };
      }
      return { accepted: true, stake, net };
    }
    if (entry.kind === "recovery") {
      if (recovery >= maxR) {
        return { accepted: false, reason: "recuperação Fibonacci inválida no gale máximo" };
      }
      return { accepted: true, stake, net };
    }
    if (entry.kind === "loss") {
      if (recovery < maxR) {
        return {
          accepted: false,
          reason: `derrota Fibonacci só no gale ${maxR}, recebido gale ${recovery}`,
        };
      }
      return { accepted: true, stake, net };
    }
    return { accepted: false, reason: `tipo de liquidação Fibonacci desconhecido (${entry.kind})` };
  }

  const lastRound = state.rounds[0] ?? null;
  const expected = expectedMartingaleStep(lastRound, baseStake);
  const recovery = Math.max(0, Math.floor(entry.recovery));
  const stake = resolveLedgerEntryStake(entry, undefined, baseStake);
  const net = entry.won ? stake : -stake;

  const openBet =
    state.openBet && entry.tableId === state.openBet.tableId ? state.openBet : null;
  if (
    openBet &&
    recovery === openBet.recovery &&
    Math.abs(stake - openBet.stake) <= STAKE_EPS
  ) {
    return validateSettlementKind(entry, stake);
  }

  if (recovery !== expected.recovery) {
    return {
      accepted: false,
      reason: `após ${describeLastRound(lastRound)} o extrato só aceita gale ${expected.recovery}, recebido gale ${recovery}`,
    };
  }

  if (Math.abs(stake - expected.stake) > STAKE_EPS) {
    return {
      accepted: false,
      reason: `após ${describeLastRound(lastRound)} o valor deve ser R$ ${expected.stake}, recebido R$ ${stake}`,
    };
  }

  if (entry.won) {
    if (entry.kind !== "win") {
      return { accepted: false, reason: `vitória com kind inválido (${entry.kind})` };
    }
    if (Math.abs(net - expected.stake) > STAKE_EPS) {
      return {
        accepted: false,
        reason: `vitória deve creditar +R$ ${expected.stake}, não +R$ ${net}`,
      };
    }
    return { accepted: true, stake, net };
  }

  if (entry.kind === "recovery") {
    if (recovery >= UM_FATOR_MAX_RECOVERY) {
      return { accepted: false, reason: "recuperação inválida no gale máximo" };
    }
    if (Math.abs(net + expected.stake) > STAKE_EPS) {
      return {
        accepted: false,
        reason: `recuperação deve debitar −R$ ${expected.stake}, não −R$ ${Math.abs(net)}`,
      };
    }
    return { accepted: true, stake, net };
  }

  if (entry.kind === "loss") {
    if (recovery < UM_FATOR_MAX_RECOVERY) {
      return {
        accepted: false,
        reason: `derrota final só no gale ${UM_FATOR_MAX_RECOVERY}, recebido gale ${recovery}`,
      };
    }
    if (Math.abs(net + expected.stake) > STAKE_EPS) {
      return {
        accepted: false,
        reason: `derrota deve debitar −R$ ${expected.stake}`,
      };
    }
    return { accepted: true, stake, net };
  }

  return { accepted: false, reason: `tipo de liquidação desconhecido (${entry.kind})` };
}
