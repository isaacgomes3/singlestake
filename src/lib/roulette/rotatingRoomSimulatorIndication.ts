import {
  ROULETTE_AUTOMATION_BASE_STAKE,
  stakeForRecovery,
} from "@/lib/back-office/rouletteAutomationSim";
import { doisFatoresExteriorCellKey } from "@/lib/roulette/doisFatoresStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { pragmaticExteriorBetKeyFromFactor } from "@/lib/roulette/pragmaticExteriorBetMap";
import type { RouletteBetKind } from "@/lib/roulette/rouletteBetSettlement";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import type { RotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorTypes";
import {
  resolveRotativaTriggerFromSnapshot,
  rotativaTriggerKindLabel,
} from "@/lib/roulette/rotatingRoomRotativaMerge";
import {
  kto2fAlertLabel,
  kto2fSignalId,
  stakeForKto2fRecovery,
} from "@/lib/roulette/rotatingRoomKto2fStrategy";
import {
  ice3fAlertLabel,
  ice3fSignalId,
  stakeForIce3fUnitScale,
} from "@/lib/roulette/rotatingRoomIce3fStrategy";
import type { StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";
import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
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

function buildFromUmFator(
  snapshot: StrategyGlobalSnapshot,
  um: StrategyGlobalSnapshot["um1fator"],
  automationBalance?: number,
): RotatingRoomSimulatorIndication {
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
    rotativaTrigger: "umFator",
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

function buildFromCrossing(
  snapshot: StrategyGlobalSnapshot,
  cross: StrategyGlobalSnapshot["dois2fatores"],
  automationBalance?: number,
): RotatingRoomSimulatorIndication {
  const tableId = cross.showTapeteSignal ? cross.currentTableId : null;
  const active = cross.activeCrossing;
  const tableLabel = tableId != null ? lobbyTableDisplayName(tableId) : null;

  let lobbyMessage = "Aguarde no Lobby";
  if (tableLabel && active) {
    const factors = `${doisFatoresFactorLabel(active.factor1)} · ${doisFatoresFactorLabel(active.factor2)}`;
    lobbyMessage = cross.showTapeteSignal
      ? `${tableLabel} · ${factors}`
      : tableLabel;
  } else if (cross.prepareTableId != null && cross.sessionMode === "prepare") {
    lobbyMessage = `${lobbyTableDisplayName(cross.prepareTableId)} · ${rotativaTriggerKindLabel("crossing")}`;
  }

  const betExteriorKey =
    cross.showTapeteSignal && active
      ? pragmaticExteriorBetKeyFromFactor(active.factor1)
      : null;

  const signalId =
    cross.showTapeteSignal && active && tableId != null
      ? `${tableId}:${active.referenceNumber}:${active.pairKind}:${cross.currentRecovery}`
      : null;

  return {
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    strategy: "dois2fatores",
    rotativaTrigger: "crossing",
    phase: cross.phase,
    lobbyMessage,
    hasSignal: cross.showTapeteSignal,
    showTapeteSignal: cross.showTapeteSignal,
    tableId,
    tableLabel,
    aproveitamentoPct: rotatingRoomSessionAproveitamentoPct(cross.sessionStats),
    wins: cross.sessionStats.wins,
    losses: cross.sessionStats.losses,
    recovery: cross.currentRecovery,
    suggestedStake: stakeForRecovery(cross.currentRecovery, automationBalance),
    alertLabel: active
      ? `${doisFatoresFactorLabel(active.factor1)} · ${doisFatoresFactorLabel(active.factor2)}`
      : null,
    betExteriorKey,
    signalId,
    action: cross.showTapeteSignal && active && tableId != null ? "bet" : "wait",
  };
}

function buildFromKto2f(
  snapshot: StrategyGlobalSnapshot,
  kto2f: StrategyGlobalSnapshot["kto2fcruzamento"],
): RotatingRoomSimulatorIndication {
  const tableId = kto2f.showTapeteSignal ? kto2f.currentTableId : null;
  const active = kto2f.kto2fActive;
  const tableLabel = tableId != null ? lobbyTableDisplayName(tableId) : null;

  let lobbyMessage = "Aguarde no Lobby";
  if (tableLabel && active) {
    lobbyMessage = kto2f.showTapeteSignal
      ? `${tableLabel} · ${kto2fAlertLabel(active)}`
      : tableLabel;
  } else if (kto2f.hasOpenCycle && tableLabel) {
    lobbyMessage = `${tableLabel} · KTO 2F · aguardando janela`;
  }

  const betExteriorKey =
    kto2f.showTapeteSignal && active
      ? pragmaticExteriorBetKeyFromFactor(active.factor1)
      : null;

  const signalId =
    kto2f.showTapeteSignal && active && tableId != null
      ? kto2fSignalId(active, kto2f.currentRecovery)
      : null;

  return {
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    strategy: "kto2fcruzamento",
    rotativaTrigger: "kto2fcruzamento",
    phase: kto2f.phase,
    lobbyMessage,
    hasSignal: kto2f.showTapeteSignal,
    showTapeteSignal: kto2f.showTapeteSignal,
    tableId,
    tableLabel,
    aproveitamentoPct: rotatingRoomSessionAproveitamentoPct(kto2f.sessionStats),
    wins: kto2f.sessionStats.wins,
    losses: kto2f.sessionStats.losses,
    recovery: kto2f.currentRecovery,
    suggestedStake: stakeForKto2fRecovery(kto2f.currentRecovery),
    alertLabel: active ? kto2fAlertLabel(active) : kto2f.watchLabel,
    betExteriorKey,
    signalId,
    action: kto2f.showTapeteSignal && active && tableId != null ? "bet" : "wait",
  };
}

function buildFromIce3f(
  snapshot: StrategyGlobalSnapshot,
  ice3f: StrategyGlobalSnapshot["tres3fatores"],
): RotatingRoomSimulatorIndication {
  const tableId = ice3f.showTapeteSignal ? ice3f.currentTableId : null;
  const active = ice3f.ice3fActive;
  const tableLabel = tableId != null ? lobbyTableDisplayName(tableId) : null;

  let lobbyMessage = "Aguarde no Lobby";
  if (tableLabel && active) {
    lobbyMessage = ice3f.showTapeteSignal
      ? `${tableLabel} · ${ice3fAlertLabel(active)}`
      : tableLabel;
  } else if (ice3f.hasOpenCycle && tableLabel) {
    lobbyMessage = `${tableLabel} · ICE 3F · aguardando janela`;
  }

  const betExteriorKey =
    ice3f.showTapeteSignal && active
      ? pragmaticExteriorBetKeyFromFactor(active.factors[0])
      : null;

  const signalId =
    ice3f.showTapeteSignal && active && tableId != null
      ? ice3fSignalId(active, ice3f.currentUnitScale)
      : null;

  return {
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    strategy: "tres3fatores",
    rotativaTrigger: "tres3fatores",
    phase: ice3f.phase,
    lobbyMessage,
    hasSignal: ice3f.showTapeteSignal,
    showTapeteSignal: ice3f.showTapeteSignal,
    tableId,
    tableLabel,
    aproveitamentoPct: rotatingRoomSessionAproveitamentoPct(ice3f.sessionStats),
    wins: ice3f.sessionStats.wins,
    losses: ice3f.sessionStats.losses,
    recovery: ice3f.currentRecovery,
    suggestedStake: stakeForIce3fUnitScale(ice3f.currentUnitScale),
    alertLabel: active ? ice3fAlertLabel(active) : ice3f.watchLabel,
    betExteriorKey,
    signalId,
    action: ice3f.showTapeteSignal && active && tableId != null ? "bet" : "wait",
  };
}

export function buildRotatingRoomSimulatorIndication(
  snapshot: StrategyGlobalSnapshot,
  automationBalance?: number,
  options?: { crossingEnabled?: boolean; kto2fEnabled?: boolean; tres3fEnabled?: boolean },
): RotatingRoomSimulatorIndication {
  const crossingEnabled = options?.crossingEnabled !== false;
  const kto2fEnabled = options?.kto2fEnabled === true;
  const tres3fEnabled = options?.tres3fEnabled === true;
  const trigger = resolveRotativaTriggerFromSnapshot(
    snapshot,
    crossingEnabled,
    true,
    false,
    false,
    kto2fEnabled,
    tres3fEnabled,
  );
  if (trigger === "crossing") {
    return buildFromCrossing(snapshot, snapshot.dois2fatores, automationBalance);
  }
  if (trigger === "kto2fcruzamento") {
    return buildFromKto2f(snapshot, snapshot.kto2fcruzamento);
  }
  if (trigger === "tres3fatores") {
    return buildFromIce3f(snapshot, snapshot.tres3fatores);
  }
  return buildFromUmFator(snapshot, snapshot.um1fator, automationBalance);
}

export const ROTATING_ROOM_SIMULATOR_BASE_STAKE = ROULETTE_AUTOMATION_BASE_STAKE;
