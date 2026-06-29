import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type {
  RotatingRoomCrossingMachineState,
  RotatingRoomCrossingPlacarFlash,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { UmFatorMachineState, UmFatorPlacarFlash } from "@/lib/roulette/rotatingRoomUmFatorStrategy";

export const EXTENSION_SYNC_VERSION = 1 as const;

export type ExtensionSyncSettlement = {
  recoveryBefore: number;
  flash: NonNullable<UmFatorPlacarFlash | RotatingRoomCrossingPlacarFlash>;
  stake: number;
  dedupeKey: string;
  /** um1fator | dois2fatores — por defeito um1fator */
  trigger?: "um1fator" | "dois2fatores";
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
  maxRecovery?: number;
  settlements?: ExtensionSyncSettlement[];
};

export type ExtensionSourceStatus = {
  active: boolean;
  lastSyncAt: number | null;
  lastSeq: number | null;
  autopilotRunning: boolean;
};
