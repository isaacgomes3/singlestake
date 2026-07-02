import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import type { RotatingRoomCrossingTableScan } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import {
  isRotatingRoomLobbyCooldownActive,
  isRotatingRoomPostResultHoldActive,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import type { UmFatorTableScan } from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type {
  StrategyGlobalCrossingClientView,
  StrategyGlobalFibonacciClientView,
  StrategyGlobalRotacaoClientView,
  StrategyGlobalSnapshot,
  StrategyGlobalUmFatorClientView,
} from "@/lib/roulette/strategyGlobalTypes";

export type RotatingRoomRotativaTriggerKind = "umFator" | "crossing" | "fibonacci" | "rotacao";

export type RotatingRoomRotativaSessionMeta = {
  /** Gatilho activo na indicação actual. */
  rotativaTrigger: RotatingRoomRotativaTriggerKind;
  /** Scan do outro motor (monitorização no lobby). */
  crossingScan?: RotatingRoomCrossingTableScan[];
  umFatorScan?: UmFatorTableScan[];
};

export type RotatingRoomRotativaSession =
  | (RotatingRoomCrossingSession & RotatingRoomRotativaSessionMeta)
  | (RotatingRoomUmFatorSession & RotatingRoomRotativaSessionMeta);

function umFatorInCycle(session: RotatingRoomUmFatorSession): boolean {
  return (
    session.showTapeteSignal ||
    session.currentRecovery > 0 ||
    session.postResultHoldActive === true ||
    session.lobbyCooldownActive === true
  );
}

function crossingInCycle(session: RotatingRoomCrossingSession): boolean {
  return (
    session.showTapeteSignal ||
    session.currentRecovery > 0 ||
    session.sessionMode === "prepare"
  );
}

function crossingHasQualifyingPattern(session: RotatingRoomCrossingSession): boolean {
  return session.crossingScan.some(
    (row) => row.status === "alert" || row.status === "active" || row.status === "prepare",
  );
}

/**
 * Escolhe qual motor alimenta a indicação da sala rotativa.
 * Cruzamento (2 factores · empate/vitória/derrota) é gatilho separado do 1 Fator.
 */
export function mergeRotatingRoomRotativaSession(
  umFator: RotatingRoomUmFatorSession,
  crossing: RotatingRoomCrossingSession,
  options: { crossingEnabled: boolean },
): RotatingRoomRotativaSession {
  const crossingEnabled = options.crossingEnabled;

  if (!crossingEnabled) {
    return {
      ...umFator,
      rotativaTrigger: "umFator",
      crossingScan: crossing.crossingScan,
    };
  }

  const umBusy = umFatorInCycle(umFator);
  const crossBusy = crossingInCycle(crossing);

  if (umBusy && !crossBusy) {
    return {
      ...umFator,
      rotativaTrigger: "umFator",
      crossingScan: crossing.crossingScan,
    };
  }

  if (crossBusy && !umBusy) {
    return {
      ...crossing,
      rotativaTrigger: "crossing",
      umFatorScan: umFator.umFatorScan,
    };
  }

  if (crossBusy && umBusy) {
    if (umFator.postResultHoldActive === true) {
      return {
        ...umFator,
        rotativaTrigger: "umFator",
        crossingScan: crossing.crossingScan,
      };
    }
    if (crossing.showTapeteSignal || crossing.sessionMode === "prepare") {
      return {
        ...crossing,
        rotativaTrigger: "crossing",
        umFatorScan: umFator.umFatorScan,
      };
    }
    if (umFator.showTapeteSignal) {
      return {
        ...umFator,
        rotativaTrigger: "umFator",
        crossingScan: crossing.crossingScan,
      };
    }
    if (crossing.currentRecovery >= umFator.currentRecovery) {
      return {
        ...crossing,
        rotativaTrigger: "crossing",
        umFatorScan: umFator.umFatorScan,
      };
    }
    return {
      ...umFator,
      rotativaTrigger: "umFator",
      crossingScan: crossing.crossingScan,
    };
  }

  if (crossingHasQualifyingPattern(crossing) && crossing.prepareTableId != null) {
    return {
      ...crossing,
      rotativaTrigger: "crossing",
      umFatorScan: umFator.umFatorScan,
    };
  }

  if (crossingEnabled) {
    return {
      ...crossing,
      rotativaTrigger: "crossing",
      umFatorScan: umFator.umFatorScan,
    };
  }

  return {
    ...umFator,
    rotativaTrigger: "umFator",
    crossingScan: crossing.crossingScan,
  };
}

export function rotativaTriggerKindLabel(kind: RotatingRoomRotativaTriggerKind): string {
  if (kind === "crossing") return "2 Fatores · padrões";
  if (kind === "fibonacci") return "Fibonacci";
  if (kind === "rotacao") return "Rotação";
  return "1 Fator";
}

function umFatorInCycleFromView(um: StrategyGlobalUmFatorClientView): boolean {
  return (
    um.showTapeteSignal ||
    um.currentRecovery > 0 ||
    isRotatingRoomLobbyCooldownActive(um.lobbyCooldownUntilMs) ||
    isRotatingRoomPostResultHoldActive(um.postResultHoldUntilMs)
  );
}

function crossingInCycleFromView(cross: StrategyGlobalCrossingClientView): boolean {
  return (
    cross.showTapeteSignal ||
    cross.currentRecovery > 0 ||
    cross.sessionMode === "prepare"
  );
}

function crossingHasQualifyingPatternFromView(cross: StrategyGlobalCrossingClientView): boolean {
  return cross.crossingScan.some(
    (row) => row.status === "alert" || row.status === "active" || row.status === "prepare",
  );
}

function fibonacciInCycleFromView(fib: StrategyGlobalFibonacciClientView): boolean {
  return fib.showTapeteSignal || fib.currentRecovery > 0;
}

function fibonacciHasQualifyingAlert(fib: StrategyGlobalFibonacciClientView): boolean {
  return fib.fibonacciScan.some(
    (row) => row.status === "alert" || row.status === "active",
  );
}

function fibonacciHasPrepare(fib: StrategyGlobalFibonacciClientView): boolean {
  return fib.prepareTableId != null || fib.fibonacciScan.some((row) => row.status === "prepare");
}

function rotacaoInCycleFromView(rot: StrategyGlobalRotacaoClientView): boolean {
  return rot.showTapeteSignal || rot.currentRecovery > 0;
}

/** Mesma prioridade do merge na sala rotativa — Fibonacci primeiro quando activo. */
export function resolveRotativaTriggerFromSnapshot(
  snapshot: StrategyGlobalSnapshot,
  crossingEnabled: boolean,
  fibonacciEnabled = true,
  rotacaoEnabled = false,
): RotatingRoomRotativaTriggerKind {
  const um = snapshot.um1fator;
  const crossing = snapshot.dois2fatores;
  const fibonacci = snapshot.fibonacci;
  const rotacao = snapshot.rotacao;

  if (fibonacciEnabled) {
    const fibBusy = fibonacciInCycleFromView(fibonacci);
    if (fibBusy) return "fibonacci";
    if (fibonacci.activeFibonacci != null && fibonacci.currentTableId != null) {
      return "fibonacci";
    }
    if (fibonacciHasQualifyingAlert(fibonacci) && fibonacci.showTapeteSignal) return "fibonacci";
    if (fibonacciHasPrepare(fibonacci)) return "fibonacci";
    if (fibonacciHasQualifyingAlert(fibonacci)) return "fibonacci";
  }

  if (rotacaoEnabled) {
    if (rotacaoInCycleFromView(rotacao)) return "rotacao";
    if (rotacao.showTapeteSignal) return "rotacao";
  }

  if (!crossingEnabled && !fibonacciEnabled) return "umFator";

  const umBusy = umFatorInCycleFromView(um);
  const crossBusy = crossingEnabled && crossingInCycleFromView(crossing);

  const busy: RotatingRoomRotativaTriggerKind[] = [];
  if (umBusy) busy.push("umFator");
  if (crossBusy) busy.push("crossing");

  if (busy.length === 1) return busy[0]!;

  if (busy.length > 1) {
    if (crossBusy && (crossing.showTapeteSignal || crossing.sessionMode === "prepare")) {
      return "crossing";
    }
    if (umBusy && um.showTapeteSignal) return "umFator";
    const recoveries: Array<{ kind: RotatingRoomRotativaTriggerKind; r: number }> = [];
    if (umBusy) recoveries.push({ kind: "umFator", r: um.currentRecovery });
    if (crossBusy) recoveries.push({ kind: "crossing", r: crossing.currentRecovery });
    recoveries.sort((a, b) => b.r - a.r);
    return recoveries[0]!.kind;
  }

  if (crossingEnabled && crossingHasQualifyingPatternFromView(crossing) && crossing.prepareTableId != null) {
    return "crossing";
  }

  if (crossingEnabled) return "crossing";

  return "umFator";
}
