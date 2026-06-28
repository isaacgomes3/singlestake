import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type { UmFatorMachineState, UmFatorPlacarFlash } from "@/lib/roulette/rotatingRoomUmFatorStrategy";

export const EXTENSION_SYNC_VERSION = 1 as const;

export type ExtensionSyncSettlement = {
  recoveryBefore: number;
  flash: NonNullable<UmFatorPlacarFlash>;
  /** Stake apostado na extensão (ex. R$ 0,50 × 2^gale). */
  stake: number;
  /** Chave estável para dedupe servidor (ex. mesa:resultado:kind:recovery). */
  dedupeKey: string;
};

/** Payload enviado pela extensão Chrome — motor Um Fator como fonte de verdade. */
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
  maxRecovery?: number;
  settlements?: ExtensionSyncSettlement[];
};

export type ExtensionSourceStatus = {
  active: boolean;
  lastSyncAt: number | null;
  lastSeq: number | null;
  autopilotRunning: boolean;
};
