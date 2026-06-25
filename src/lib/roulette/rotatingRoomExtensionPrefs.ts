export const ROTATING_ROOM_EXTENSION_ENABLED_KEY = "roulette.rotatingRoom.extensionEnabled";
export const ROTATING_ROOM_EXTENSION_REAL_MODE_KEY = "roulette.rotatingRoom.extensionRealMode";
export const ROTATING_ROOM_EXTENSION_LAST_EMIT_KEY = "roulette.rotatingRoom.extensionLastEmit";
export const ROTATING_ROOM_EXTENSION_MAX_RECOVERY_KEY = "roulette.rotatingRoom.extensionMaxRecovery";
export const ROTATING_ROOM_EXTENSION_STATS_WINS_KEY = "roulette.rotatingRoom.extensionStatsWins";
export const ROTATING_ROOM_EXTENSION_STATS_LOSSES_KEY = "roulette.rotatingRoom.extensionStatsLosses";
export const ROTATING_ROOM_EXTENSION_PREFS_EVENT = "singlestake-extension-prefs";

function notifyExtensionPrefsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_EXTENSION_PREFS_EVENT));
}

const DEFAULT_EXTENSION_MAX_RECOVERY = 5;

export function clampExtensionMaxRecovery(value: unknown, fallback = DEFAULT_EXTENSION_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6, Math.max(0, Math.floor(n)));
}

export function readRotatingRoomExtensionMaxRecovery(): number {
  if (typeof localStorage === "undefined") return DEFAULT_EXTENSION_MAX_RECOVERY;
  try {
    const raw = localStorage.getItem(ROTATING_ROOM_EXTENSION_MAX_RECOVERY_KEY);
    if (raw == null) return DEFAULT_EXTENSION_MAX_RECOVERY;
    return clampExtensionMaxRecovery(parseInt(raw, 10));
  } catch {
    return DEFAULT_EXTENSION_MAX_RECOVERY;
  }
}

export function writeRotatingRoomExtensionMaxRecovery(maxRecovery: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      ROTATING_ROOM_EXTENSION_MAX_RECOVERY_KEY,
      String(clampExtensionMaxRecovery(maxRecovery)),
    );
    notifyExtensionPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function readRotatingRoomExtensionStats(): { wins: number; losses: number } {
  if (typeof localStorage === "undefined") return { wins: 0, losses: 0 };
  try {
    return {
      wins: Math.max(0, parseInt(localStorage.getItem(ROTATING_ROOM_EXTENSION_STATS_WINS_KEY) ?? "0", 10) || 0),
      losses: Math.max(0, parseInt(localStorage.getItem(ROTATING_ROOM_EXTENSION_STATS_LOSSES_KEY) ?? "0", 10) || 0),
    };
  } catch {
    return { wins: 0, losses: 0 };
  }
}

export function writeRotatingRoomExtensionStats(wins: number, losses: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ROTATING_ROOM_EXTENSION_STATS_WINS_KEY, String(Math.max(0, wins)));
    localStorage.setItem(ROTATING_ROOM_EXTENSION_STATS_LOSSES_KEY, String(Math.max(0, losses)));
    notifyExtensionPrefsChanged();
  } catch {
    /* ignore */
  }
}

/** Gales máximos da extensão (popup) ou constante da estratégia. */
export function readEffectiveUmFatorMaxRecovery(fallback = 5): number {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(ROTATING_ROOM_EXTENSION_MAX_RECOVERY_KEY);
    if (raw == null) return fallback;
    return clampExtensionMaxRecovery(parseInt(raw, 10), fallback);
  } catch {
    return fallback;
  }
}

export type RotatingRoomExtensionBridgePrefs = {
  maxRecovery?: number;
  wins?: number;
  losses?: number;
};

export function applyRotatingRoomExtensionBridgePrefs(prefs: RotatingRoomExtensionBridgePrefs): void {
  if (prefs.maxRecovery != null) {
    writeRotatingRoomExtensionMaxRecovery(prefs.maxRecovery);
  }
  if (prefs.wins != null || prefs.losses != null) {
    const current = readRotatingRoomExtensionStats();
    writeRotatingRoomExtensionStats(prefs.wins ?? current.wins, prefs.losses ?? current.losses);
  }
}

export function readExtensionLastEmitKey(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(ROTATING_ROOM_EXTENSION_LAST_EMIT_KEY);
  } catch {
    return null;
  }
}

export function writeExtensionLastEmitKey(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(ROTATING_ROOM_EXTENSION_LAST_EMIT_KEY, key);
  } catch {
    /* ignore */
  }
}

export function clearExtensionLastEmitKey(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(ROTATING_ROOM_EXTENSION_LAST_EMIT_KEY);
  } catch {
    /* ignore */
  }
}

export function readRotatingRoomExtensionEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(ROTATING_ROOM_EXTENSION_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeRotatingRoomExtensionEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ROTATING_ROOM_EXTENSION_ENABLED_KEY, enabled ? "1" : "0");
    notifyExtensionPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function readRotatingRoomExtensionRealMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(ROTATING_ROOM_EXTENSION_REAL_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeRotatingRoomExtensionRealMode(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ROTATING_ROOM_EXTENSION_REAL_MODE_KEY, enabled ? "1" : "0");
    notifyExtensionPrefsChanged();
  } catch {
    /* ignore */
  }
}
