import {
  baseStakeFromBalance,
  stakeForRecovery,
} from "@/lib/back-office/rouletteAutomationSim";
import { doisFatoresExteriorCellKey } from "@/lib/roulette/doisFatoresStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { pragmaticExteriorBetKeyFromFactor } from "@/lib/roulette/pragmaticExteriorBetMap";
import type { RouletteBetKind } from "@/lib/roulette/rouletteBetSettlement";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import type { RotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorTypes";
import type { StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";
import { umFatorAlertLabel } from "@/lib/roulette/umFatorStrategy";

export function exteriorBetKeyToRouletteBetKind(
  key: ReturnType<typeof doisFatoresExteriorCellKey>,
): RouletteBetKind {
  switch (key) {
    case "low":
      return { type: "low" };
    case "high":
      return { type: "high" };
    case "even":
      return { type: "even" };
    case "odd":
      return { type: "odd" };
    case "red":
      return { type: "red" };
    case "black":
      return { type: "black" };
  }
}

export function buildRotatingRoomSimulatorIndication(
  snapshot: StrategyGlobalSnapshot,
  automationBalance?: number,
): RotatingRoomSimulatorIndication {
  const um = snapshot.um1fator;
  const tableId = um.showTapeteSignal ? um.currentTableId : null;
  const umActive = um.umActive;
  const tableLabel = tableId != null ? lobbyTableDisplayName(tableId) : null;

  let lobbyMessage = "Aguarde no Lobby";
  if (tableLabel) {
    if (um.showTapeteSignal && umActive) {
      lobbyMessage = `${tableLabel} · ${umFatorAlertLabel(umActive)}`;
    } else {
      lobbyMessage = tableLabel;
    }
  }

  const betExteriorKey =
    um.showTapeteSignal && umActive
      ? pragmaticExteriorBetKeyFromFactor(umActive.alertFactor)
      : null;

  const signalId =
    um.showTapeteSignal && umActive && tableId != null && betExteriorKey
      ? `${tableId}:${umActive.resultNumber}:${betExteriorKey}:${um.currentRecovery}`
      : null;

  return {
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    strategy: "um1fator",
    phase: um.phase,
    lobbyMessage,
    hasSignal: um.showTapeteSignal,
    showTapeteSignal: um.showTapeteSignal,
    tableId,
    tableLabel,
    aproveitamentoPct: rotatingRoomSessionAproveitamentoPct(um.sessionStats),
    wins: um.sessionStats.wins,
    losses: um.sessionStats.losses,
    recovery: um.currentRecovery,
    suggestedStake: stakeForRecovery(um.currentRecovery, automationBalance),
    alertLabel: umActive ? umFatorAlertLabel(umActive) : null,
    betExteriorKey,
    signalId,
    action: um.showTapeteSignal && umActive && betExteriorKey ? "bet" : "wait",
  };
}

export const ROTATING_ROOM_SIMULATOR_BASE_STAKE = baseStakeFromBalance;
