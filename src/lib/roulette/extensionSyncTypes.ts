import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type {
  RotatingRoomCrossingMachineState,
  RotatingRoomCrossingPlacarFlash,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { UmFatorMachineState, UmFatorPlacarFlash } from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type {
  RotatingRoomFibonacciMachineState,
  RotatingRoomFibonacciPlacarFlash,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";

import type {
  RotatingRoomRepeticaoMachineState,
  RotatingRoomRepeticaoPlacarFlash,
} from "@/lib/roulette/rotatingRoomRepeticaoStrategy";

export const EXTENSION_SYNC_VERSION = 1 as const;

export type ExtensionSyncSettlement = {
  recoveryBefore: number;
  flash: NonNullable<
    UmFatorPlacarFlash | RotatingRoomCrossingPlacarFlash | RotatingRoomFibonacciPlacarFlash | RotatingRoomRepeticaoPlacarFlash
  >;
  stake: number;
  dedupeKey: string;
  /** um1fator | dois2fatores | fibonacci | repeticao | rotacao — por defeito um1fator */
  trigger?: "um1fator" | "dois2fatores" | "fibonacci" | "repeticao" | "rotacao";
};

/** Payload enviado pela extensão Chrome — motor da sala rotativa como fonte de verdade. */
export type ExtensionSyncPayload = {
  version: typeof EXTENSION_SYNC_VERSION;
  secret: string;
  seq: number;
  updatedAt: number;
  autopilotRunning: boolean;
  tableIds: number[];
  histories: Record<string, number[]>;
  machine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  crossingMachine?: RotatingRoomCrossingMachineState | null;
  crossingStats?: RotatingRoomSessionStats | null;
  fibonacciMachine?: RotatingRoomFibonacciMachineState | null;
  fibonacciStats?: RotatingRoomSessionStats | null;
  repeticaoMachine?: RotatingRoomRepeticaoMachineState | null;
  repeticaoStats?: RotatingRoomSessionStats | null;
  maxRecovery?: number;
  settlements?: ExtensionSyncSettlement[];
};

export type ExtensionSourceStatus = {
  active: boolean;
  lastSyncAt: number | null;
  lastSeq: number | null;
  autopilotRunning: boolean;
};
