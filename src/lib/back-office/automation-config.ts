import { ROULETTE_AUTOMATION_BASE_STAKE } from "@/lib/back-office/automationStakes";
import { ROULETTE_AUTOMATION_INITIAL_BANK } from "@/lib/back-office/rouletteAutomationSim";
import { DEFAULT_FIBONACCI_ABSENCE_SPINS, normalizeFibonacciZoneAbsenceSpins } from "@/lib/roulette/fibonacciAbsencePrefs";
import {
  DEFAULT_CROSSING_ABSENCE_SPINS,
  normalizeCrossingAxisAbsenceSpins,
} from "@/lib/roulette/crossingAbsencePrefs";
import { normalizeRepeticaoZoneAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import {
  DEFAULT_ROTATING_ROOM_GATILHO_ENABLE,
  normalizeRotatingRoomGatilhoEnable,
  type RotatingRoomGatilhoEnableMap,
} from "@/lib/roulette/umFatorTriggerEnable";

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
  /** Stake inicial (R$) — base do martingale 50→100→200… */
  baseStake: number;
  /** Lucro acumulado (vs capital) que pausa a automação; null = desligado. */
  stopWin: number | null;
  /** Prejuízo acumulado (vs capital) que pausa a automação; null = desligado. */
  stopLoss: number | null;
  /** Gatilhos activos na sala rotativa (1 Fator + cruzamento 2F). */
  enabledTriggers: RotatingRoomGatilhoEnableMap;
  /** Giros de ausência mínimos para gatilho Fibonacci (legado — ver campos por tipo). */
  fibonacciAbsenceSpins: number;
  fibonacciDozenAbsenceSpins: number;
  fibonacciColumnAbsenceSpins: number;
  repeticaoAbsenceSpins: number;
  repeticaoDozenAbsenceSpins: number;
  repeticaoColumnAbsenceSpins: number;
  crossingCorAlturaAbsenceSpins: number;
  crossingAlturaParidadeAbsenceSpins: number;
  /** Giros ausentes = máx. na janela − 5 (cor/altura). */
  crossingCorAlturaAbsenceAuto: boolean;
  /** Giros ausentes = máx. na janela − 5 (paridade/altura). */
  crossingAlturaParidadeAbsenceAuto: boolean;
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
  enabledTriggers: { ...DEFAULT_ROTATING_ROOM_GATILHO_ENABLE },
  fibonacciAbsenceSpins: DEFAULT_FIBONACCI_ABSENCE_SPINS,
  fibonacciDozenAbsenceSpins: DEFAULT_FIBONACCI_ABSENCE_SPINS,
  fibonacciColumnAbsenceSpins: DEFAULT_FIBONACCI_ABSENCE_SPINS,
  repeticaoAbsenceSpins: DEFAULT_FIBONACCI_ABSENCE_SPINS,
  repeticaoDozenAbsenceSpins: DEFAULT_FIBONACCI_ABSENCE_SPINS,
  repeticaoColumnAbsenceSpins: DEFAULT_FIBONACCI_ABSENCE_SPINS,
  crossingCorAlturaAbsenceSpins: DEFAULT_CROSSING_ABSENCE_SPINS,
  crossingAlturaParidadeAbsenceSpins: DEFAULT_CROSSING_ABSENCE_SPINS,
  crossingCorAlturaAbsenceAuto: false,
  crossingAlturaParidadeAbsenceAuto: false,
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
    typeof rawStake === "number" && Number.isFinite(rawStake) && rawStake >= 1
      ? Math.round(rawStake)
      : DEFAULT_GLOBAL_AUTOMATION_CONFIG.baseStake;
  const stopWin = null;
  const stopLoss = null;
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
  const absenceByZone = normalizeFibonacciZoneAbsenceSpins(o);
  const repeticaoByZone = normalizeRepeticaoZoneAbsenceSpins(o);
  const crossingByAxis = normalizeCrossingAxisAbsenceSpins(o);
  return {
    paused,
    pauseReason,
    pausedAt,
    baseStake,
    stopWin,
    stopLoss,
    enabledTriggers: normalizeRotatingRoomGatilhoEnable(o.enabledTriggers),
    fibonacciAbsenceSpins: absenceByZone.dozen,
    fibonacciDozenAbsenceSpins: absenceByZone.dozen,
    fibonacciColumnAbsenceSpins: absenceByZone.column,
    repeticaoAbsenceSpins: repeticaoByZone.dozen,
    repeticaoDozenAbsenceSpins: repeticaoByZone.dozen,
    repeticaoColumnAbsenceSpins: repeticaoByZone.column,
    crossingCorAlturaAbsenceSpins: crossingByAxis.corAltura,
    crossingAlturaParidadeAbsenceSpins: crossingByAxis.alturaParidade,
    crossingCorAlturaAbsenceAuto: o.crossingCorAlturaAbsenceAuto === true,
    crossingAlturaParidadeAbsenceAuto: o.crossingAlturaParidadeAbsenceAuto === true,
    updatedAt:
      typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt) ? o.updatedAt : Date.now(),
  };
}

export function automationProfitVsCapital(balance: number): number {
  return Math.round((balance - ROULETTE_AUTOMATION_INITIAL_BANK) * 100) / 100;
}

export function evaluateAutomationAutoPause(
  _config: GlobalAutomationConfig,
  _balance: number,
): { paused: boolean; reason: "stop-win" | "stop-loss" | null } {
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
