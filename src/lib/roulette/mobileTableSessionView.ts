import type { DoisFatoresCrossingSession } from "@/hooks/useDoisFatoresCrossingSession";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import type { UmFatorSession } from "@/hooks/useUmFatorSession";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomCrossingStrategy";

export type MobileRoundFlash = {
  resultNumber: number;
  won: boolean;
  kind?: "win" | "loss" | "recovery";
  recoveryBefore?: number;
} | null;

export type MobileTableSessionView = {
  showTapeteSignal: boolean;
  sessionMode: RotatingRoomSessionMode | "scanning" | "active";
  prepareTableId: number | null;
  currentTableId: number | null;
  activeCrossing: DoisFatoresActive | null;
  currentRecovery: number;
  alertBucketGap: number;
  roundFlash: MobileRoundFlash;
  singleFactorMode: boolean;
};

export type MobileSessionSource =
  | DoisFatoresCrossingSession
  | UmFatorSession
  | RotatingRoomCrossingSession
  | RotatingRoomUmFatorSession;

function isSingleFactor(session: MobileSessionSource): boolean {
  return "singleFactorMode" in session && session.singleFactorMode === true;
}

export function toMobileTableSessionView(
  session: MobileSessionSource,
  tableId: number,
): MobileTableSessionView {
  const single = isSingleFactor(session);
  const showTapeteSignal = session.showTapeteSignal && session.activeCrossing != null;
  const isRotating =
    "currentTableId" in session || "prepareTableId" in session;

  let currentTableId: number | null = null;
  let prepareTableId: number | null = null;

  if (isRotating && "currentTableId" in session) {
    const rotating = session as RotatingRoomCrossingSession | RotatingRoomUmFatorSession;
    currentTableId = showTapeteSignal ? rotating.currentTableId : null;
    prepareTableId =
      !single &&
      rotating.sessionMode === "prepare" &&
      !showTapeteSignal &&
      rotating.prepareTableId != null
        ? rotating.prepareTableId
        : null;
  } else {
    const isPrepare =
      !single &&
      session.sessionMode === "prepare" &&
      !showTapeteSignal;
    currentTableId = showTapeteSignal ? tableId : null;
    prepareTableId = isPrepare ? tableId : null;
  }

  const roundFlash = session.roundFlash;
  const normalizedFlash: MobileRoundFlash = roundFlash
    ? {
        resultNumber: roundFlash.resultNumber,
        won: roundFlash.won,
        kind:
          "kind" in roundFlash && roundFlash.kind != null
            ? roundFlash.kind
            : roundFlash.won
              ? "win"
              : "recovery",
        recoveryBefore:
          "recoveryBefore" in roundFlash ? roundFlash.recoveryBefore : undefined,
      }
    : null;

  return {
    showTapeteSignal,
    sessionMode: session.sessionMode,
    prepareTableId,
    currentTableId,
    activeCrossing: session.activeCrossing,
    currentRecovery: session.currentRecovery,
    alertBucketGap: "alertBucketGap" in session ? (session.alertBucketGap ?? 0) : 0,
    roundFlash: normalizedFlash,
    singleFactorMode: single,
  };
}
