import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";
import { UM_FATOR_TRIGGER_TIER_DEFINITIONS } from "@/lib/roulette/umFatorTriggerTiers";

export type UmFatorTriggerEnableMap = Record<UmFatorTriggerMatchTier, boolean>;

export const DEFAULT_UM_FATOR_TRIGGER_ENABLE: UmFatorTriggerEnableMap = {
  two: true,
  three: true,
};

let runtimeEnabled: UmFatorTriggerEnableMap = { ...DEFAULT_UM_FATOR_TRIGGER_ENABLE };

export function normalizeUmFatorTriggerEnable(raw: unknown): UmFatorTriggerEnableMap {
  const base = { ...DEFAULT_UM_FATOR_TRIGGER_ENABLE };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<UmFatorTriggerEnableMap>;
  for (const def of UM_FATOR_TRIGGER_TIER_DEFINITIONS) {
    if (typeof o[def.id] === "boolean") base[def.id] = o[def.id]!;
  }
  return base;
}

export function setUmFatorEnabledTriggers(map: UmFatorTriggerEnableMap): void {
  runtimeEnabled = normalizeUmFatorTriggerEnable(map);
}

export function getUmFatorEnabledTriggers(): UmFatorTriggerEnableMap {
  return { ...runtimeEnabled };
}

export function isUmFatorTriggerTierEnabled(tier: UmFatorTriggerMatchTier): boolean {
  return runtimeEnabled[tier] !== false;
}
