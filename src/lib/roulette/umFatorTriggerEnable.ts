import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";
import { UM_FATOR_TRIGGER_TIER_DEFINITIONS } from "@/lib/roulette/umFatorTriggerTiers";

/** Gatilhos activos na sala rotativa. 2 Fatores (padrões) activo por defeito; 1 Fator só manual. */
export type RotatingRoomGatilhoKind = UmFatorTriggerMatchTier | "crossing" | "fibonacci" | "repeticao" | "rotacao";

export type UmFatorTriggerEnableMap = Record<UmFatorTriggerMatchTier, boolean>;

export type RotatingRoomGatilhoEnableMap = UmFatorTriggerEnableMap & {
  crossing: boolean;
  fibonacci: boolean;
  fibonacciDozen: boolean;
  fibonacciColumn: boolean;
  repeticao: boolean;
  repeticaoDozen: boolean;
  repeticaoColumn: boolean;
  rotacao: boolean;
};

export const DEFAULT_UM_FATOR_TRIGGER_ENABLE: UmFatorTriggerEnableMap = {
  two: false,
  three: false,
};

export const DEFAULT_ROTATING_ROOM_GATILHO_ENABLE: RotatingRoomGatilhoEnableMap = {
  ...DEFAULT_UM_FATOR_TRIGGER_ENABLE,
  crossing: false,
  fibonacci: true,
  fibonacciDozen: true,
  fibonacciColumn: true,
  repeticao: false,
  repeticaoDozen: true,
  repeticaoColumn: true,
  rotacao: false,
};

let runtimeEnabled: RotatingRoomGatilhoEnableMap = { ...DEFAULT_ROTATING_ROOM_GATILHO_ENABLE };

export function normalizeUmFatorTriggerEnable(raw: unknown): UmFatorTriggerEnableMap {
  const full = normalizeRotatingRoomGatilhoEnable(raw);
  const { crossing: _crossing, fibonacci: _fibonacci, ...umOnly } = full;
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
  if (typeof o.fibonacci === "boolean") base.fibonacci = o.fibonacci;
  if (typeof o.fibonacciDozen === "boolean") base.fibonacciDozen = o.fibonacciDozen;
  if (typeof o.fibonacciColumn === "boolean") base.fibonacciColumn = o.fibonacciColumn;
  if (typeof o.repeticao === "boolean") base.repeticao = o.repeticao;
  if (typeof o.repeticaoDozen === "boolean") base.repeticaoDozen = o.repeticaoDozen;
  if (typeof o.repeticaoColumn === "boolean") base.repeticaoColumn = o.repeticaoColumn;
  if (typeof o.rotacao === "boolean") base.rotacao = o.rotacao;
  base.two = false;
  return base;
}

export function setUmFatorEnabledTriggers(map: UmFatorTriggerEnableMap): void {
  setRotatingRoomGatilhoEnabled({ ...runtimeEnabled, ...normalizeUmFatorTriggerEnable(map) });
}

export const ROTATING_ROOM_GATILHO_CHANGED_EVENT = "rotating-room-gatilho-changed";

const FIBONACCI_GATILHO_LOCAL_KEY = "roulette.rotatingRoom.fibonacciGatilhoEnabled";

export function readFibonacciGatilhoLocalEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const raw = localStorage.getItem(FIBONACCI_GATILHO_LOCAL_KEY);
    if (raw == null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function writeFibonacciGatilhoLocalEnabled(enabled: boolean): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FIBONACCI_GATILHO_LOCAL_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  setRotatingRoomGatilhoEnabled({ ...runtimeEnabled, fibonacci: enabled });
}

export function initFibonacciGatilhoFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  const enabled = readFibonacciGatilhoLocalEnabled();
  runtimeEnabled = { ...runtimeEnabled, fibonacci: enabled };
}

export function setRotatingRoomGatilhoEnabled(map: RotatingRoomGatilhoEnableMap): void {
  runtimeEnabled = normalizeRotatingRoomGatilhoEnable(map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_GATILHO_CHANGED_EVENT));
  }
}

export function getUmFatorEnabledTriggers(): UmFatorTriggerEnableMap {
  const { crossing: _c, fibonacci: _f, ...um } = runtimeEnabled;
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

export function isFibonacciGatilhoEnabled(): boolean {
  return getEnabledFibonacciZoneKinds().length > 0;
}

export function isFibonacciDozenGatilhoEnabled(): boolean {
  return runtimeEnabled.fibonacci !== false && runtimeEnabled.fibonacciDozen !== false;
}

export function isFibonacciColumnGatilhoEnabled(): boolean {
  return runtimeEnabled.fibonacci !== false && runtimeEnabled.fibonacciColumn !== false;
}

export function isRotacaoGatilhoEnabled(): boolean {
  return runtimeEnabled.rotacao === true;
}

export function isRepeticaoGatilhoEnabled(): boolean {
  return getEnabledRepeticaoZoneKinds().length > 0;
}

export function isRepeticaoDozenGatilhoEnabled(): boolean {
  return runtimeEnabled.repeticao !== false && runtimeEnabled.repeticaoDozen !== false;
}

export function isRepeticaoColumnGatilhoEnabled(): boolean {
  return runtimeEnabled.repeticao !== false && runtimeEnabled.repeticaoColumn !== false;
}

export function getEnabledRepeticaoZoneKinds(): FibonacciZoneKind[] {
  return enabledRepeticaoZoneKindsFromMap(runtimeEnabled);
}

export function enabledRepeticaoZoneKindsFromMap(
  map: Pick<RotatingRoomGatilhoEnableMap, "repeticao" | "repeticaoDozen" | "repeticaoColumn">,
): FibonacciZoneKind[] {
  if (map.repeticao === false) return [];
  const kinds: FibonacciZoneKind[] = [];
  if (map.repeticaoDozen !== false) kinds.push("dozen");
  if (map.repeticaoColumn !== false) kinds.push("column");
  return kinds;
}

export function getEnabledFibonacciZoneKinds(): FibonacciZoneKind[] {
  return enabledFibonacciZoneKindsFromMap(runtimeEnabled);
}

export function enabledFibonacciZoneKindsFromMap(
  map: Pick<RotatingRoomGatilhoEnableMap, "fibonacci" | "fibonacciDozen" | "fibonacciColumn">,
): FibonacciZoneKind[] {
  if (map.fibonacci === false) return [];
  const kinds: FibonacciZoneKind[] = [];
  if (map.fibonacciDozen !== false) kinds.push("dozen");
  if (map.fibonacciColumn !== false) kinds.push("column");
  return kinds;
}

type FibonacciZoneKind = import("@/lib/roulette/rotatingRoomFibonacciStrategy").FibonacciZoneKind;
