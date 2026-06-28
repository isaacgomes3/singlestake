import {
  EXTENSION_REAL_BASE_STAKE,
  ROULETTE_AUTOMATION_BASE_STAKE,
  ROULETTE_AUTOMATION_INITIAL_BANK,
} from "@/lib/back-office/rouletteAutomationSim";

/** Pausa por stop win/loss retoma sozinha após 1 hora. Pausa manual só pelo admin. */
export const AUTOMATION_STOP_PAUSE_MS = 60 * 60 * 1000;

export type AutomationPauseReason = "manual" | "stop-win" | "stop-loss";

export type GlobalAutomationConfig = {
  /** Pausa só a automação financeira global — sala rotativa e extensão continuam. */
  paused: boolean;
  /** Motivo da pausa activa; null quando a automação está a aceitar entradas. */
  pauseReason: AutomationPauseReason | null;
  /** Timestamp (ms) em que a pausa actual começou. */
  pausedAt: number | null;
  /** Stake inicial (R$) — base do martingale 0,50→1→2… (igual à extensão). */
  baseStake: number;
  /** Lucro acumulado (vs capital) que pausa a automação; null = desligado. */
  stopWin: number | null;
  /** Prejuízo acumulado (vs capital) que pausa a automação; null = desligado. */
  stopLoss: number | null;
  updatedAt: number;
};

export type GlobalAutomationConfigDto = GlobalAutomationConfig & {
  profitVsCapital: number;
  balance: number;
  /** @deprecated Preferir displayPauseReason */
  autoPauseReason: "stop-win" | "stop-loss" | null;
  blocksNewEntries: boolean;
  displayPauseReason: AutomationPauseReason | null;
  resumeAt: number | null;
};

export const DEFAULT_GLOBAL_AUTOMATION_CONFIG: GlobalAutomationConfig = {
  paused: false,
  pauseReason: null,
  pausedAt: null,
  baseStake: ROULETTE_AUTOMATION_BASE_STAKE,
  stopWin: null,
  stopLoss: null,
  updatedAt: 0,
};

function normalizePauseReason(raw: unknown): AutomationPauseReason | null {
  if (raw === "manual" || raw === "stop-win" || raw === "stop-loss") return raw;
  return null;
}

export function normalizeGlobalAutomationConfig(raw: unknown): GlobalAutomationConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GLOBAL_AUTOMATION_CONFIG };
  const o = raw as Partial<GlobalAutomationConfig>;
  const rawStake = o.baseStake;
  const baseStake =
    typeof rawStake === "number" && Number.isFinite(rawStake) && rawStake >= EXTENSION_REAL_BASE_STAKE
      ? Math.round(rawStake * 100) / 100
      : DEFAULT_GLOBAL_AUTOMATION_CONFIG.baseStake;
  const stopWin =
    o.stopWin === null || o.stopWin === undefined
      ? null
      : typeof o.stopWin === "number" && Number.isFinite(o.stopWin) && o.stopWin > 0
        ? Math.round(o.stopWin)
        : null;
  const stopLoss =
    o.stopLoss === null || o.stopLoss === undefined
      ? null
      : typeof o.stopLoss === "number" && Number.isFinite(o.stopLoss) && o.stopLoss > 0
        ? Math.round(o.stopLoss)
        : null;
  const paused = o.paused === true;
  let pauseReason = normalizePauseReason(o.pauseReason);
  let pausedAt =
    typeof o.pausedAt === "number" && Number.isFinite(o.pausedAt) ? o.pausedAt : null;
  if (paused && pauseReason == null) {
    pauseReason = "manual";
  }
  if (!paused) {
    pauseReason = null;
    pausedAt = null;
  }
  return {
    paused,
    pauseReason,
    pausedAt,
    baseStake,
    stopWin,
    stopLoss,
    updatedAt:
      typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt) ? o.updatedAt : Date.now(),
  };
}

export function automationProfitVsCapital(balance: number): number {
  return Math.round((balance - ROULETTE_AUTOMATION_INITIAL_BANK) * 100) / 100;
}

export function evaluateAutomationAutoPause(
  config: GlobalAutomationConfig,
  balance: number,
): { paused: boolean; reason: "stop-win" | "stop-loss" | null } {
  const profit = automationProfitVsCapital(balance);
  if (config.stopWin != null && profit >= config.stopWin) {
    return { paused: true, reason: "stop-win" };
  }
  if (config.stopLoss != null && profit <= -config.stopLoss) {
    return { paused: true, reason: "stop-loss" };
  }
  return { paused: false, reason: null };
}

export function resolveAutomationPauseState(
  config: GlobalAutomationConfig,
  balance: number,
  now = Date.now(),
): {
  blocksNewEntries: boolean;
  displayPauseReason: AutomationPauseReason | null;
  pausedAt: number | null;
  resumeAt: number | null;
  pendingStopReason: "stop-win" | "stop-loss" | null;
} {
  if (config.paused && config.pauseReason === "manual") {
    return {
      blocksNewEntries: true,
      displayPauseReason: "manual",
      pausedAt: config.pausedAt ?? config.updatedAt,
      resumeAt: null,
      pendingStopReason: null,
    };
  }

  if (
    config.paused &&
    (config.pauseReason === "stop-win" || config.pauseReason === "stop-loss")
  ) {
    const pausedAt = config.pausedAt ?? config.updatedAt;
    const resumeAt = pausedAt + AUTOMATION_STOP_PAUSE_MS;
    if (now >= resumeAt) {
      return {
        blocksNewEntries: false,
        displayPauseReason: null,
        pausedAt: null,
        resumeAt: null,
        pendingStopReason: null,
      };
    }
    return {
      blocksNewEntries: true,
      displayPauseReason: config.pauseReason,
      pausedAt,
      resumeAt,
      pendingStopReason: null,
    };
  }

  if (config.paused) {
    return {
      blocksNewEntries: true,
      displayPauseReason: "manual",
      pausedAt: config.pausedAt ?? config.updatedAt,
      resumeAt: null,
      pendingStopReason: null,
    };
  }

  const auto = evaluateAutomationAutoPause(config, balance);
  if (auto.paused && auto.reason) {
    return {
      blocksNewEntries: true,
      displayPauseReason: auto.reason,
      pausedAt: now,
      resumeAt: now + AUTOMATION_STOP_PAUSE_MS,
      pendingStopReason: auto.reason,
    };
  }

  return {
    blocksNewEntries: false,
    displayPauseReason: null,
    pausedAt: null,
    resumeAt: null,
    pendingStopReason: null,
  };
}

export function buildAutomationConfigDto(
  config: GlobalAutomationConfig,
  balance: number,
  now = Date.now(),
): GlobalAutomationConfigDto {
  const pause = resolveAutomationPauseState(config, balance, now);
  const stopReason =
    pause.displayPauseReason === "stop-win" || pause.displayPauseReason === "stop-loss"
      ? pause.displayPauseReason
      : pause.pendingStopReason;
  return {
    ...config,
    balance,
    profitVsCapital: automationProfitVsCapital(balance),
    autoPauseReason: stopReason,
    blocksNewEntries: pause.blocksNewEntries,
    displayPauseReason: pause.displayPauseReason,
    resumeAt: pause.resumeAt,
  };
}

export function automationBlocksNewEntries(
  config: GlobalAutomationConfig,
  balance: number,
  now = Date.now(),
): boolean {
  return resolveAutomationPauseState(config, balance, now).blocksNewEntries;
}
