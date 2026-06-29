import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS } from "@/lib/roulette/rotatingRoomCrossingSession";
import type { RotatingRoomCrossingTableScan } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { UmFatorTableScan } from "@/lib/roulette/rotatingRoomUmFatorStrategy";

export type RotatingRoomRotativaTriggerKind = "umFator" | "crossing";

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

function crossingHasQualifyingGap(session: RotatingRoomCrossingSession): boolean {
  return session.crossingScan.some(
    (row) => (row.bucketGap ?? 0) >= ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
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

  if (crossingHasQualifyingGap(crossing) && crossing.prepareTableId != null) {
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
  if (kind === "crossing") return "2 Fatores · cruzamento";
  return "1 Fator";
}
