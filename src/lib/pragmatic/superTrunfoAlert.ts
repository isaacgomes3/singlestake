import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import type { FootballBlitzRoundStored, FootballBlitzWinner } from "@/lib/pragmatic/dgaFootballBlitzHistory";

export const SUPER_TRUNFO_ALERT_EVENT = "pragmatic:super-trunfo-alert";

/** Grelha 11×2 — leitura em linhas; posição N = índice N−1 (newest-first). */
export const SUPER_TRUNFO_GRID_POS_CRITICAL_1 = 1;
export const SUPER_TRUNFO_GRID_POS_ALERT = 11;
export const SUPER_TRUNFO_GRID_POS_CRITICAL_12 = 12;
export const SUPER_TRUNFO_GRID_MIN_ROUNDS = SUPER_TRUNFO_GRID_POS_CRITICAL_12;

export const SUPER_TRUNFO_GRID_CRITICAL_POSITIONS_1_BASED = [
  SUPER_TRUNFO_GRID_POS_CRITICAL_1,
  SUPER_TRUNFO_GRID_POS_ALERT,
  SUPER_TRUNFO_GRID_POS_CRITICAL_12,
] as const;

export const FOOTBALL_BLITZ_HISTORY_GRID_COLS = 11;

/** Spread mínimo na pos. 11 para emitir indicação. */
export const SUPER_TRUNFO_MIN_POS11_SPREAD = 4;

/** Spread da aposta principal quando há entrada. */
export const SUPER_TRUNFO_ENTRY_SPREAD = 3.5;

/** @deprecated Use {@link SUPER_TRUNFO_ENTRY_SPREAD}. */
export const SUPER_TRUNFO_PROTECTION_SPREAD_HIGH = SUPER_TRUNFO_ENTRY_SPREAD;

/** Índice newest-first do topo da coluna (1-based). */
export function superTrunfoGridColumnTopIndex(col1Based: number): number {
  return col1Based - 1;
}

/** Índice newest-first do fundo da coluna (1-based). */
export function superTrunfoGridColumnBottomIndex(col1Based: number): number {
  return FOOTBALL_BLITZ_HISTORY_GRID_COLS + (col1Based - 1);
}

export function getSuperTrunfoGridColumnRound(
  history: readonly FootballBlitzRoundStored[],
  col1Based: number,
  row: "top" | "bottom",
): FootballBlitzRoundStored | null {
  const idx = row === "top" ? superTrunfoGridColumnTopIndex(col1Based) : superTrunfoGridColumnBottomIndex(col1Based);
  return history[idx] ?? null;
}

export function superTrunfoGridPositionToIndex(pos1Based: number): number {
  return pos1Based - 1;
}

export type SuperTrunfoEntryBet = {
  kind: "main" | "spread";
  side: FootballBlitzWinner;
  spread?: number;
  label: string;
};

export type SuperTrunfoAlertPayload =
  | { type: "no_signal"; reason: string }
  | {
      type: "entry";
      comparisonEqual: boolean;
      triggerLabel: string;
      referenceFollowUpLabel: string;
      bets: SuperTrunfoEntryBet[];
      message: string;
    };

/** Ronda «zero» — spread 0, cor verde na grelha, sem «+». */
export function isSuperTrunfoZeroRound(
  round: Pick<FootballBlitzRoundStored, "scoreDiff">,
): boolean {
  return round.scoreDiff === 0;
}

export function formatSuperTrunfoSpreadDisplay(scoreDiff: number): string {
  return scoreDiff === 0 ? "0" : `+${scoreDiff}`;
}

/** Mesmo spread + mesma cor (mandante/visitante/empate). */
export function isSameSuperTrunfoRound(
  a: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
  b: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
): boolean {
  return a.winner === b.winner && a.scoreDiff === b.scoreDiff;
}

/** Mesma cor (mandante / visitante / empate). */
export function isSameSuperTrunfoColor(
  a: Pick<FootballBlitzRoundStored, "winner">,
  b: Pick<FootballBlitzRoundStored, "winner">,
): boolean {
  return a.winner === b.winner;
}

export function getSuperTrunfoGridRound(
  history: readonly FootballBlitzRoundStored[],
  pos1Based: number,
): FootballBlitzRoundStored | null {
  const idx = superTrunfoGridPositionToIndex(pos1Based);
  return history[idx] ?? null;
}

function awayColorLabel(variant: FootballBlitzTableVariant): string {
  return variant === "top-card" ? "azul" : "vermelho";
}

function colorLabel(side: FootballBlitzWinner, variant: FootballBlitzTableVariant): string {
  if (side === "draw") return "empate";
  if (side === "home") return "amarelo";
  return awayColorLabel(variant);
}

export function formatSuperTrunfoRoundLabel(
  round: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
  variant: FootballBlitzTableVariant = "super-trunfo",
): string {
  if (isSuperTrunfoZeroRound(round)) return "0";
  if (round.winner === "draw") return `+${round.scoreDiff} empate`;
  return `+${round.scoreDiff} ${colorLabel(round.winner, variant)}`;
}

function mainBetLabel(side: FootballBlitzWinner, variant: FootballBlitzTableVariant): string {
  if (side === "draw") return "1 ficha Empate";
  if (side === "home") return "1 ficha Mandante (amarelo)";
  return `1 ficha Visitante (${awayColorLabel(variant)})`;
}

function spreadBetLabel(
  side: FootballBlitzWinner,
  spread: number,
  variant: FootballBlitzTableVariant,
): string {
  if (side === "draw") return `+${spread} Empate`;
  if (side === "home") return `+${spread} Mandante (amarelo)`;
  return `+${spread} Visitante (${awayColorLabel(variant)})`;
}

function entryBetsFromComparison(
  comparisonEqual: boolean,
  baseRound: Pick<FootballBlitzRoundStored, "winner">,
  variant: FootballBlitzTableVariant,
): SuperTrunfoEntryBet[] {
  const baseSide = baseRound.winner;
  if (baseSide === "draw") return [];

  const spreadSide = comparisonEqual
    ? baseSide
    : (protectionSideFromAlertSide(baseSide) ?? baseSide);
  const protectionSide = protectionSideFromAlertSide(spreadSide);
  if (!protectionSide) return [];

  return [
    {
      kind: "spread",
      side: spreadSide,
      spread: SUPER_TRUNFO_ENTRY_SPREAD,
      label: spreadBetLabel(spreadSide, SUPER_TRUNFO_ENTRY_SPREAD, variant),
    },
    {
      kind: "main",
      side: protectionSide,
      label: mainBetLabel(protectionSide, variant),
    },
  ];
}

/** Spread ganha se a cor apostada vence e o diferencial supera o spread. */
export function doesSuperTrunfoSpreadBetWin(
  round: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
  side: FootballBlitzWinner,
  spread: number,
): boolean {
  if (round.winner === "draw") return false;
  return round.winner === side && round.scoreDiff > spread;
}

export function protectionSideFromAlertSide(
  side: FootballBlitzWinner,
): FootballBlitzWinner | null {
  if (side === "home") return "away";
  if (side === "away") return "home";
  return null;
}

export function doesSuperTrunfoMainBetWin(
  round: Pick<FootballBlitzRoundStored, "winner">,
  side: FootballBlitzWinner,
): boolean {
  return round.winner === side;
}

/**
 * Liquidação da entrada (+3,5 + proteção na cor oposta):
 * - **W** — vitória no +3,5
 * - **null** — só a cor de proteção vence (neutro, não conta no placar)
 * - **L** — cor do +3,5 sem bater spread, +1,5, empate ou outra derrota
 */
export function settleSuperTrunfoSpreadEntry(
  round: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
  bets: readonly SuperTrunfoEntryBet[],
): "W" | "L" | null {
  const spreadBet = bets.find((b) => b.kind === "spread" && b.spread === SUPER_TRUNFO_ENTRY_SPREAD);
  const mainBet = bets.find((b) => b.kind === "main");
  if (!spreadBet || !mainBet) return "L";

  if (round.winner === "draw") return "L";

  if (doesSuperTrunfoSpreadBetWin(round, spreadBet.side, spreadBet.spread!)) {
    return "W";
  }

  if (doesSuperTrunfoMainBetWin(round, mainBet.side)) {
    return null;
  }

  return "L";
}

/** Ronda na posição 11 da grelha (base da indicação), se existir. */
export function getSuperTrunfoPosition11Round(
  history: readonly FootballBlitzRoundStored[],
): FootballBlitzRoundStored | null {
  return getSuperTrunfoGridRound(history, SUPER_TRUNFO_GRID_POS_ALERT);
}

/**
 * Grelha 11×2 (newest-first):
 * - Pos. **1** e **12** definem comparação **igual** ou **diferente** (mesma cor vs cores distintas).
 * - Pos. **11** com spread **≥ +4** (qualquer cor) — obrigatório para alertar.
 * - **Zero** (spread 0) em qualquer posição crítica bloqueia a indicação.
 * - Entrada: **+3,5** na cor derivada da comparação + **1 ficha** na cor oposta.
 */
export function evaluateSuperTrunfoAlert(
  history: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant = "super-trunfo",
): SuperTrunfoAlertPayload {
  if (history.length < SUPER_TRUNFO_GRID_MIN_ROUNDS) {
    return {
      type: "no_signal",
      reason: `Histórico insuficiente (mínimo ${SUPER_TRUNFO_GRID_MIN_ROUNDS} rondas).`,
    };
  }

  const pos1 = history[superTrunfoGridPositionToIndex(SUPER_TRUNFO_GRID_POS_CRITICAL_1)]!;
  const pos11 = history[superTrunfoGridPositionToIndex(SUPER_TRUNFO_GRID_POS_ALERT)]!;
  const pos12 = history[superTrunfoGridPositionToIndex(SUPER_TRUNFO_GRID_POS_CRITICAL_12)]!;

  const pos1Label = formatSuperTrunfoRoundLabel(pos1, variant);
  const pos11Label = formatSuperTrunfoRoundLabel(pos11, variant);
  const pos12Label = formatSuperTrunfoRoundLabel(pos12, variant);

  for (const [pos, label] of [
    [SUPER_TRUNFO_GRID_POS_CRITICAL_1, pos1Label] as const,
    [SUPER_TRUNFO_GRID_POS_ALERT, pos11Label] as const,
    [SUPER_TRUNFO_GRID_POS_CRITICAL_12, pos12Label] as const,
  ]) {
    const round = history[superTrunfoGridPositionToIndex(pos)]!;
    if (isSuperTrunfoZeroRound(round)) {
      return {
        type: "no_signal",
        reason: `Zero na pos. ${pos} (${label}) — sem indicação.`,
      };
    }
  }

  if (pos11.scoreDiff < SUPER_TRUNFO_MIN_POS11_SPREAD) {
    return {
      type: "no_signal",
      reason: `Pos. 11 (${pos11Label}) abaixo de +${SUPER_TRUNFO_MIN_POS11_SPREAD} — sem indicação.`,
    };
  }

  if (pos11.winner === "draw") {
    return {
      type: "no_signal",
      reason: `Pos. 11 (${pos11Label}) é empate — sem indicação.`,
    };
  }

  const comparisonEqual = isSameSuperTrunfoColor(pos1, pos12);
  const bets = entryBetsFromComparison(comparisonEqual, pos11, variant);
  if (bets.length === 0) {
    return { type: "no_signal", reason: "Não foi possível montar as apostas da entrada." };
  }

  const comparisonText = comparisonEqual ? "iguais" : "diferentes";
  const betLines = bets.map((b) => b.label).join(" · ");

  return {
    type: "entry",
    comparisonEqual,
    triggerLabel: `${pos1Label} / ${pos12Label}`,
    referenceFollowUpLabel: pos11Label,
    bets,
    message: `Pos. 1 e 12 ${comparisonText} (${pos1Label} / ${pos12Label}). Base pos. 11: ${pos11Label}. ${betLines}.`,
  };
}

export type SuperTrunfoActive = {
  bets: SuperTrunfoEntryBet[];
  triggerLabel: string;
  referenceFollowUpLabel: string;
  message: string;
};

export function superTrunfoActiveFromAlert(
  alert: SuperTrunfoAlertPayload,
): SuperTrunfoActive | null {
  if (alert.type !== "entry") return null;
  return {
    bets: alert.bets,
    triggerLabel: alert.triggerLabel,
    referenceFollowUpLabel: alert.referenceFollowUpLabel,
    message: alert.message,
  };
}

export function isSuperTrunfoMainBetActive(
  active: SuperTrunfoActive,
  side: FootballBlitzWinner,
): boolean {
  return active.bets.some((b) => b.kind === "main" && b.side === side);
}

export function isSuperTrunfoSpreadBetActive(
  active: SuperTrunfoActive,
  side: FootballBlitzWinner,
  spread: number,
): boolean {
  return active.bets.some(
    (b) => b.kind === "spread" && b.side === side && b.spread === spread,
  );
}

export function dispatchSuperTrunfoAlert(payload: SuperTrunfoAlertPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUPER_TRUNFO_ALERT_EVENT, { detail: payload }));
}
