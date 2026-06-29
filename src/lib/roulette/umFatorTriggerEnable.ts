import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";
import { UM_FATOR_TRIGGER_TIER_DEFINITIONS } from "@/lib/roulette/umFatorTriggerTiers";

/** Gatilhos activos na sala rotativa (1 Fator + cruzamento 2F). */
export type RotatingRoomGatilhoKind = UmFatorTriggerMatchTier | "crossing";

export type UmFatorTriggerEnableMap = Record<UmFatorTriggerMatchTier, boolean>;

export type RotatingRoomGatilhoEnableMap = UmFatorTriggerEnableMap & {
  crossing: boolean;
};

export const DEFAULT_UM_FATOR_TRIGGER_ENABLE: UmFatorTriggerEnableMap = {
  two: true,
  three: true,
};

export const DEFAULT_ROTATING_ROOM_GATILHO_ENABLE: RotatingRoomGatilhoEnableMap = {
  ...DEFAULT_UM_FATOR_TRIGGER_ENABLE,
  crossing: false,
};

let runtimeEnabled: RotatingRoomGatilhoEnableMap = { ...DEFAULT_ROTATING_ROOM_GATILHO_ENABLE };

export function normalizeUmFatorTriggerEnable(raw: unknown): UmFatorTriggerEnableMap {
  const full = normalizeRotatingRoomGatilhoEnable(raw);
  const { crossing: _crossing, ...umOnly } = full;
  return umOnly;
}

export function normalizeRotatingRoomGatilhoEnable(raw: unknown): RotatingRoomGatilhoEnableMap {
  const base = { ...DEFAULT_ROTATING_ROOM_GATILHO_ENABLE };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<RotatingRoomGatilhoEnableMap>;
  for (const def of UM_FATOR_TRIGGER_TIER_DEFINITIONS) {
    if (typeof o[def.id] === "boolean") base[def.id] = o[def.id]!;
  }
  if (typeof o.crossing === "boolean") base.crossing = o.crossing;
  return base;
}

export function setUmFatorEnabledTriggers(map: UmFatorTriggerEnableMap): void {
  setRotatingRoomGatilhoEnabled({ ...runtimeEnabled, ...normalizeUmFatorTriggerEnable(map) });
}

export function setRotatingRoomGatilhoEnabled(map: RotatingRoomGatilhoEnableMap): void {
  runtimeEnabled = normalizeRotatingRoomGatilhoEnable(map);
}

export function getUmFatorEnabledTriggers(): UmFatorTriggerEnableMap {
  const { crossing: _c, ...um } = runtimeEnabled;
  return um;
}

export function getRotatingRoomGatilhoEnabled(): RotatingRoomGatilhoEnableMap {
  return { ...runtimeEnabled };
}

export function isUmFatorTriggerTierEnabled(tier: UmFatorTriggerMatchTier): boolean {
  return runtimeEnabled[tier] !== false;
}

export function isCrossingGatilhoEnabled(): boolean {
  return runtimeEnabled.crossing !== false;
}
