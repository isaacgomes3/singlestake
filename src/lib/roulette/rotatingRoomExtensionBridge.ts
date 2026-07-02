import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import {
  formatStakeBrl,
  stakeForRecovery,
} from "@/lib/back-office/rouletteAutomationSim";
import {
  pragmaticExteriorBetKeyFromFactor,
  type PragmaticExteriorBetKey,
} from "@/lib/roulette/pragmaticExteriorBetMap";
import { pragmaticFibonacciBetKeyFromZone } from "@/lib/roulette/pragmaticFibonacciBetMap";
import type { PragmaticFibonacciBetKey } from "@/lib/roulette/pragmaticFibonacciBetMap";
import { parseFibonacciSignalId } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import { getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";
import {
  lobbyTableDisplayName,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import {
  casinoEmbedProviderFromUrl,
  type CasinoEmbedProvider,
} from "@/lib/roulette/casinoEmbedProviderHint";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import {
  ROTATING_ROOM_FIBONACCI_RECOVERY_BET_DELAY_MS,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import type { AutomationPendingSignal } from "@/lib/back-office/rouletteAutomationSim";
import { activeCrossingFromAutomationBet } from "@/lib/roulette/automationBetCrossing";
import {
  planRotatingRoomClickBotActions,
  type RotatingRoomClickBotSessionSlice,
} from "@/lib/roulette/rotatingRoomClickBotLearning";
import { readRotatingRoomExtensionRealMode, readEffectiveUmFatorMaxRecovery } from "@/lib/roulette/rotatingRoomExtensionPrefs";
import type { RotatingUmFatorIndication } from "@/lib/roulette/rotatingUmFatorSimHarness";

export const ROTATING_ROOM_EXTENSION_MESSAGE_TYPE = "game-odds-glow/rotating-room-extension" as const;
export const ROTATING_ROOM_EXTENSION_PING_TYPE = "game-odds-glow/rotating-room-extension-ping" as const;
export const ROTATING_ROOM_EXTENSION_PONG_TYPE = "game-odds-glow/rotating-room-extension-pong" as const;
export const ROTATING_ROOM_EXTENSION_ACK_TYPE = "game-odds-glow/rotating-room-extension-ack" as const;
export const ROTATING_ROOM_EXTENSION_STATS_TYPE = "game-odds-glow/rotating-room-extension-stats" as const;
export const ROTATING_ROOM_EXTENSION_CLOSE_MESA_TYPE =
  "game-odds-glow/rotating-room-extension-close-mesa" as const;
export const ROTATING_ROOM_EXTENSION_CANCEL_CLOSE_MESA_TYPE =
  "game-odds-glow/rotating-room-extension-cancel-close-mesa" as const;
export const ROTATING_ROOM_EXTENSION_EMIT_EVENT = "singlestake-extension-emit" as const;
export const ROTATING_ROOM_EXTENSION_PRESENT_EVENT = "singlestake-extension-present" as const;
export const ROTATING_ROOM_EXTENSION_VERSION = 1 as const;

export type RotatingRoomExtensionPrefs = {
  maxRecovery: number;
  wins: number;
  losses: number;
  recoveries?: number;
  executionMode?: "demo" | "real";
  bridgeEnabled?: boolean;
  /** Fechar separador da mesa quando a indicação termina (predefinição: sim). */
  closeMesaOnFinish?: boolean;
  /** Gatilho Rotação (altura/paridade/cor) — Roulette 1. */
  rotacaoEnabled?: boolean;
};

export type RotatingRoomExtensionContext = {
  sessionMode: RotatingRoomClickBotSessionSlice["sessionMode"];
  prepareTableId: number | null;
  currentTableId: number | null;
  mesaEmbedUrl: string | null;
  /** playtech | pragmatic — derivado de mesaEmbedUrl para a extensão escolher o separador certo. */
  mesaProvider: CasinoEmbedProvider;
  factor1Label: string | null;
  factor2Label: string | null;
  factor1BetKey: PragmaticExteriorBetKey | PragmaticFibonacciBetKey | null;
  factor2BetKey: PragmaticExteriorBetKey | null;
  singleFactorMode: boolean;
  signalId: string | null;
  /** Banca do quadro global (informativo). Stake fixa: R$ 50 × 2^gale. */
  automationBalance: number | null;
  /** @deprecated Informativo — não usar para apostar; ver automationBalance. */
  stakeAmount: number | null;
  currentRecovery: number | null;
  /** @deprecated A extensão deriva baseStake de automationBalance. */
  baseStake: number | null;
  maxRecovery: number;
  /** demo | real — prioridade sobre o modo do popup da extensão. */
  executionMode: "demo" | "real";
  rotativaTrigger?: "umFator" | "crossing" | "fibonacci" | "rotacao";
  strategy?: "um1fator" | "dois2fatores" | "fibonacci" | "rotacao";
  /** Por rodada — re-aposta após empate (2F). */
  betAttemptKey?: string | null;
  /** Aguarde no Lobby — navegar para poker em vez de mesa de roleta. */
  lobbyWait?: boolean;
  /** Timestamp até ao qual novas apostas ficam bloqueadas (pós-ciclo). */
  lobbyCooldownUntilMs?: number | null;
  /** Mantém mesa em foco após resultado antes do lobby (sincronia extensão). */
  postResultHoldUntilMs?: number | null;
  postResultHoldTableId?: number | null;
  /** Fibonacci em gale — não apostar antes deste timestamp (ms). */
  betDelayUntilMs?: number | null;
  /** Mesas da sala rotativa com URL individual guardada (localStorage / env). */
  mesaCatalog: RotatingRoomMesaCatalogEntry[];
};

export type RotatingRoomMesaCatalogEntry = {
  tableId: number;
  label: string;
  url: string;
};

export function buildRotatingRoomMesaCatalog(): RotatingRoomMesaCatalogEntry[] {
  if (typeof window === "undefined") return [];
  const liveIds = getLiveRouletteTableIds();
  const tableIds = resolveRotatingRoomTableIds(liveIds);
  const entries: RotatingRoomMesaCatalogEntry[] = [];
  for (const tableId of tableIds) {
    const url = getCasinoEmbedUrlForTable(tableId);
    if (!url) continue;
    entries.push({
      tableId,
      label: lobbyTableDisplayName(tableId),
      url,
    });
  }
  return entries;
}

export type RotatingRoomExtensionBridgePayload = {
  type: typeof ROTATING_ROOM_EXTENSION_MESSAGE_TYPE;
  version: typeof ROTATING_ROOM_EXTENSION_VERSION;
  fingerprint: string;
  actions: import("@/lib/roulette/rotatingRoomClickBotLearning").RotatingRoomClickBotAction[];
  context: RotatingRoomExtensionContext;
};

export function buildRotatingRoomExtensionContext(
  session: RotatingRoomClickBotSessionSlice,
  mesaEmbedUrlOverride?: string | null,
  automationBalance?: number | null,
): RotatingRoomExtensionContext {
  const lobbyWait = session.lobbyWait === true;
  const postResultHoldActive = session.postResultHoldActive === true;
  const focusTableId = lobbyWait
    ? null
    : postResultHoldActive && session.postResultHoldTableId != null
      ? session.postResultHoldTableId
      : session.showTapeteSignal && session.currentTableId != null
        ? session.currentTableId
        : session.prepareTableId;
  const crossing = session.activeCrossing;
  const mesaCatalog = buildRotatingRoomMesaCatalog();
  const mesaFromCatalog =
    focusTableId != null
      ? mesaCatalog.find((e) => e.tableId === focusTableId)?.url ?? null
      : null;
  const mesaEmbedUrl = lobbyWait
    ? null
    : (mesaEmbedUrlOverride && mesaEmbedUrlOverride.trim()) ||
      mesaFromCatalog ||
      (focusTableId != null ? getCasinoEmbedUrlForTable(focusTableId) : null);
  const recovery =
    typeof session.currentRecovery === "number" && Number.isFinite(session.currentRecovery)
      ? Math.max(0, Math.floor(session.currentRecovery))
      : 0;
  const realMode = readRotatingRoomExtensionRealMode();
  const balance =
    typeof automationBalance === "number" && Number.isFinite(automationBalance) && automationBalance > 0
      ? automationBalance
      : null;
  return {
    sessionMode: session.sessionMode,
    prepareTableId: lobbyWait ? null : session.prepareTableId,
    currentTableId: lobbyWait ? null : session.currentTableId,
    mesaEmbedUrl,
    mesaProvider: casinoEmbedProviderFromUrl(mesaEmbedUrl),
    factor1Label: crossing ? doisFatoresFactorLabel(crossing.factor1) : null,
    factor2Label:
      crossing && !session.singleFactorMode ? doisFatoresFactorLabel(crossing.factor2) : null,
    factor1BetKey: crossing ? pragmaticExteriorBetKeyFromFactor(crossing.factor1) : null,
    factor2BetKey:
      crossing && !session.singleFactorMode
        ? pragmaticExteriorBetKeyFromFactor(crossing.factor2)
        : null,
    singleFactorMode: session.singleFactorMode === true,
    rotativaTrigger: session.rotativaTrigger ?? (session.singleFactorMode ? "umFator" : "crossing"),
    strategy: session.singleFactorMode ? "um1fator" : "dois2fatores",
    signalId: session.signalId ?? null,
    betAttemptKey: session.betAttemptKey ?? session.signalId ?? null,
    automationBalance: balance,
    stakeAmount: stakeForRecovery(recovery),
    currentRecovery: recovery,
    baseStake: null,
    maxRecovery: readEffectiveUmFatorMaxRecovery(),
    executionMode: realMode ? "real" : "demo",
    lobbyWait,
    mesaCatalog,
    lobbyCooldownUntilMs:
      typeof session.lobbyCooldownUntilMs === "number" && Number.isFinite(session.lobbyCooldownUntilMs)
        ? session.lobbyCooldownUntilMs
        : null,
    postResultHoldUntilMs:
      typeof session.postResultHoldUntilMs === "number" &&
      Number.isFinite(session.postResultHoldUntilMs)
        ? session.postResultHoldUntilMs
        : null,
    postResultHoldTableId:
      typeof session.postResultHoldTableId === "number" &&
      Number.isFinite(session.postResultHoldTableId)
        ? session.postResultHoldTableId
        : null,
  };
}

export function isRotatingRoomExtensionBridgePayload(
  data: unknown,
): data is RotatingRoomExtensionBridgePayload {
  if (data === null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === ROTATING_ROOM_EXTENSION_MESSAGE_TYPE &&
    o.version === ROTATING_ROOM_EXTENSION_VERSION &&
    typeof o.fingerprint === "string" &&
    Array.isArray(o.actions) &&
    o.context !== null &&
    typeof o.context === "object"
  );
}

export type MesaTabTrack = {
  tableId: number;
  signalId: string;
  recovery: number;
};

/** Mantém mesa aberta entre gales do 1 Fator enquanto o ciclo de recuperação continua. */
export function shouldDeferMesaCloseForUmFatorRecovery(
  settled: Pick<AutomationPendingSignal, "tableId" | "recovery" | "strategy">,
  session: {
    currentRecovery?: number;
    currentTableId?: number | null;
    postResultHoldActive?: boolean;
    postResultHoldTableId?: number | null;
  },
  maxRecovery = readEffectiveUmFatorMaxRecovery(),
): boolean {
  if (settled.strategy !== "um1fator" || settled.tableId == null) return false;
  if (session.postResultHoldActive === true) return false;

  const sessionRecovery =
    typeof session.currentRecovery === "number" && Number.isFinite(session.currentRecovery)
      ? Math.max(0, Math.floor(session.currentRecovery))
      : 0;
  if (sessionRecovery <= settled.recovery) return false;

  const focusTableId =
    session.currentTableId ??
    (session.postResultHoldTableId != null ? session.postResultHoldTableId : null);
  if (focusTableId != null && focusTableId !== settled.tableId) return false;

  return settled.recovery < maxRecovery;
}

/** Fecha separador da mesa quando openBet termina (vitória, derrota ou mudança de mesa). */
export function mesaTabCloseAfterOpenBetChange(
  prevOpenBet: Pick<AutomationPendingSignal, "tableId" | "signalId" | "recovery"> | null,
  openBet: Pick<AutomationPendingSignal, "tableId" | "signalId" | "recovery"> | null,
  pendingSignal: Pick<AutomationPendingSignal, "tableId" | "signalId" | "recovery"> | null,
): number | null {
  if (!prevOpenBet?.tableId) return null;

  if (
    openBet?.tableId === prevOpenBet.tableId &&
    openBet.signalId === prevOpenBet.signalId &&
    openBet.recovery === prevOpenBet.recovery
  ) {
    return null;
  }

  if (openBet?.tableId != null && openBet.tableId !== prevOpenBet.tableId) {
    return prevOpenBet.tableId;
  }

  if (!openBet) {
    if (
      pendingSignal?.tableId === prevOpenBet.tableId &&
      pendingSignal.recovery > prevOpenBet.recovery
    ) {
      return null;
    }
    return prevOpenBet.tableId;
  }

  return null;
}

/** Mesa a fechar quando o ciclo da indicação termina (vitória, derrota final ou mudança de mesa). */
export function resolveMesaTabCloseTableId(
  prev: MesaTabTrack | null,
  openBet: Pick<AutomationPendingSignal, "tableId" | "signalId" | "recovery"> | null,
  pendingSignal: Pick<AutomationPendingSignal, "tableId" | "signalId" | "recovery"> | null,
): number | null {
  if (!prev) return null;

  const active = openBet ?? pendingSignal;

  if (active?.tableId === prev.tableId && active.recovery > prev.recovery) {
    return null;
  }

  if (
    openBet?.tableId === prev.tableId &&
    openBet.signalId === prev.signalId &&
    openBet.recovery === prev.recovery
  ) {
    return null;
  }

  if (openBet?.tableId != null && openBet.tableId !== prev.tableId) {
    return prev.tableId;
  }

  if (!openBet) {
    if (pendingSignal?.tableId === prev.tableId && pendingSignal.recovery > prev.recovery) {
      return null;
    }
    return prev.tableId;
  }

  return null;
}

export function mesaUrlForTableId(tableId: number): string | null {
  if (typeof window === "undefined") return null;
  const catalog = buildRotatingRoomMesaCatalog();
  return catalog.find((e) => e.tableId === tableId)?.url ?? getCasinoEmbedUrlForTable(tableId);
}

export function emitRotatingRoomExtensionCloseMesa(
  tableId: number,
  mesaUrl?: string | null,
): void {
  if (typeof window === "undefined" || tableId == null) return;
  window.postMessage(
    {
      type: ROTATING_ROOM_EXTENSION_CLOSE_MESA_TYPE,
      version: ROTATING_ROOM_EXTENSION_VERSION,
      tableId,
      mesaUrl: mesaUrl?.trim() || mesaUrlForTableId(tableId) || undefined,
    },
    window.location.origin,
  );
}

/** Cancela fechos agendados (arranque do bridge / nova abertura de mesa). */
export function emitRotatingRoomExtensionCancelCloseMesa(tableId?: number | null): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    {
      type: ROTATING_ROOM_EXTENSION_CANCEL_CLOSE_MESA_TYPE,
      version: ROTATING_ROOM_EXTENSION_VERSION,
      ...(tableId != null ? { tableId } : {}),
    },
    window.location.origin,
  );
}

export function emitRotatingRoomExtensionBridge(
  payload: Pick<RotatingRoomExtensionBridgePayload, "fingerprint" | "actions" | "context">,
): void {
  if (typeof window === "undefined") return;
  const message: RotatingRoomExtensionBridgePayload = {
    type: ROTATING_ROOM_EXTENSION_MESSAGE_TYPE,
    version: ROTATING_ROOM_EXTENSION_VERSION,
    ...payload,
  };
  window.postMessage(message, window.location.origin);
  window.dispatchEvent(
    new CustomEvent(ROTATING_ROOM_EXTENSION_EMIT_EVENT, {
      detail: { fingerprint: message.fingerprint, actions: message.actions },
    }),
  );
}

export function pingRotatingRoomExtension(): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    { type: ROTATING_ROOM_EXTENSION_PING_TYPE, version: ROTATING_ROOM_EXTENSION_VERSION },
    window.location.origin,
  );
}

export function syncRotatingRoomExtensionStats(
  wins: number,
  losses: number,
  recoveries?: number,
): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    {
      type: ROTATING_ROOM_EXTENSION_STATS_TYPE,
      version: ROTATING_ROOM_EXTENSION_VERSION,
      wins: Math.max(0, wins),
      losses: Math.max(0, losses),
      recoveries: Math.max(0, recoveries ?? 0),
    },
    window.location.origin,
  );
}

export function isRotatingRoomExtensionPong(
  data: unknown,
): data is { type: typeof ROTATING_ROOM_EXTENSION_PONG_TYPE; prefs?: RotatingRoomExtensionPrefs } {
  if (data === null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return o.type === ROTATING_ROOM_EXTENSION_PONG_TYPE && o.version === ROTATING_ROOM_EXTENSION_VERSION;
}

export { isLikelyExtensionBridgeOrigin } from "@/lib/app-domains";

/** Payload directo a partir de «Em jogo» / pending da automação global. */
export function buildExtensionBridgeFromAutomationBet(
  bet: AutomationPendingSignal,
  automationBalance?: number | null,
): Pick<RotatingRoomExtensionBridgePayload, "fingerprint" | "actions" | "context"> | null {
  if (bet.tableId == null || !bet.signalId?.trim()) return null;

  if (bet.strategy === "rotacao" && bet.rotacaoActive) {
    const factor1Key = pragmaticExteriorBetKeyFromFactor(bet.rotacaoActive.alertFactor);
    const mesaEmbedUrl = getCasinoEmbedUrlForTable(bet.tableId);
    const recovery = Math.max(0, Math.floor(bet.recovery));
    const activeCrossing = activeCrossingFromAutomationBet(bet);
    if (!activeCrossing) return null;
    const context = buildRotatingRoomExtensionContext(
      {
        sessionMode: "active",
        showTapeteSignal: true,
        prepareTableId: null,
        currentTableId: bet.tableId,
        activeCrossing,
        singleFactorMode: true,
        signalId: bet.signalId,
        betAttemptKey: bet.signalId,
        rotativaTrigger: "rotacao",
        currentRecovery: recovery,
        lobbyWait: false,
      },
      mesaEmbedUrl,
      automationBalance,
    );
    return {
      fingerprint: `${bet.signalId}|r${recovery}`,
      actions: [
        {
          kind: "click",
          target: "prepare-open",
          label: bet.tableLabel ?? lobbyTableDisplayName(bet.tableId),
          reason: `Abrir ${bet.tableLabel ?? "mesa"} no operador`,
        },
        {
          kind: "click",
          target: "factor-1",
          label: bet.alertLabel ?? factor1Key,
          reason: `Rotação · ${bet.alertLabel ?? factor1Key} · gale ${recovery}`,
        },
      ],
      context: {
        ...context,
        factor1Label: bet.alertLabel,
        factor1BetKey: factor1Key,
        rotativaTrigger: "rotacao",
        strategy: "rotacao",
        signalId: bet.signalId,
        betAttemptKey: bet.signalId,
      },
    };
  }

  if (bet.strategy === "fibonacci") {
    const parsed = parseFibonacciSignalId(bet.signalId);
    if (!parsed) return null;
    const betKey = pragmaticFibonacciBetKeyFromZone(parsed.zone);
    const mesaEmbedUrl = getCasinoEmbedUrlForTable(bet.tableId);
    const recovery = Math.max(0, Math.floor(bet.recovery));
    const context = buildRotatingRoomExtensionContext(
      {
        sessionMode: "active",
        showTapeteSignal: true,
        prepareTableId: null,
        currentTableId: bet.tableId,
        activeCrossing: null,
        singleFactorMode: true,
        signalId: bet.signalId,
        betAttemptKey: bet.signalId,
        rotativaTrigger: "fibonacci",
        currentRecovery: recovery,
        lobbyWait: false,
      },
      mesaEmbedUrl,
      automationBalance,
    );
    return {
      fingerprint: `${bet.signalId}|r${recovery}`,
      actions: [
        {
          kind: "click",
          target: "prepare-open",
          label: bet.tableLabel ?? lobbyTableDisplayName(bet.tableId),
          reason: `Abrir ${bet.tableLabel ?? "mesa"} no operador`,
        },
        {
          kind: "click",
          target: "factor-1",
          label: bet.alertLabel ?? betKey,
          reason: `Fibonacci · ${bet.alertLabel ?? betKey} · gale ${recovery}`,
        },
      ],
      context: {
        ...context,
        factor1Label: bet.alertLabel,
        factor1BetKey: betKey,
        rotativaTrigger: "fibonacci",
        strategy: "fibonacci",
        betDelayUntilMs:
          recovery > 0 ? Date.now() + ROTATING_ROOM_FIBONACCI_RECOVERY_BET_DELAY_MS : null,
      },
    };
  }

  const activeCrossing = activeCrossingFromAutomationBet(bet);
  if (!activeCrossing) return null;

  const singleFactorMode = bet.strategy !== "dois2fatores";
  const recovery = Math.max(0, Math.floor(bet.recovery));
  const mesaEmbedUrl = getCasinoEmbedUrlForTable(bet.tableId);

  if (bet.strategy === "um1fator" && bet.umActive) {
    const factor1Key = pragmaticExteriorBetKeyFromFactor(bet.umActive.alertFactor);
    const context = buildRotatingRoomExtensionContext(
      {
        sessionMode: "active",
        showTapeteSignal: true,
        prepareTableId: null,
        currentTableId: bet.tableId,
        activeCrossing,
        singleFactorMode: true,
        signalId: bet.signalId,
        betAttemptKey: bet.signalId,
        rotativaTrigger: "umFator",
        currentRecovery: recovery,
        lobbyWait: false,
      },
      mesaEmbedUrl,
      automationBalance,
    );
    return {
      fingerprint: `${bet.signalId}|r${recovery}`,
      actions: [
        {
          kind: "click",
          target: "prepare-open",
          label: bet.tableLabel ?? lobbyTableDisplayName(bet.tableId),
          reason: `Abrir ${bet.tableLabel ?? "mesa"} no operador`,
        },
        {
          kind: "click",
          target: "factor-1",
          label: bet.alertLabel ?? factor1Key,
          reason: `Um Fator · ${bet.alertLabel ?? factor1Key} · gale ${recovery}`,
        },
      ],
      context: {
        ...context,
        factor1Label: bet.alertLabel,
        factor1BetKey: factor1Key,
        rotativaTrigger: "umFator",
        strategy: "um1fator",
        signalId: bet.signalId,
        betAttemptKey: bet.signalId,
      },
    };
  }

  const sessionSlice: RotatingRoomClickBotSessionSlice = {
    sessionMode: "active",
    showTapeteSignal: true,
    prepareTableId: null,
    currentTableId: bet.tableId,
    activeCrossing,
    singleFactorMode,
    signalId: bet.signalId,
    betAttemptKey: bet.signalId,
    rotativaTrigger: singleFactorMode ? "umFator" : "crossing",
    currentRecovery: bet.recovery,
    lobbyWait: false,
  };

  const actions = planRotatingRoomClickBotActions(sessionSlice);
  if (!actions.some((a) => a.kind === "click")) return null;

  const context = buildRotatingRoomExtensionContext(sessionSlice, mesaEmbedUrl, automationBalance);
  const fingerprint = `${bet.signalId}|r${bet.recovery}`;

  if (bet.strategy === "dois2fatores" && bet.activeCrossing) {
    return {
      fingerprint,
      actions,
      context: {
        ...context,
        factor1Label: doisFatoresFactorLabel(bet.activeCrossing.factor1),
        factor2Label: doisFatoresFactorLabel(bet.activeCrossing.factor2),
        factor1BetKey: pragmaticExteriorBetKeyFromFactor(bet.activeCrossing.factor1),
        factor2BetKey: pragmaticExteriorBetKeyFromFactor(bet.activeCrossing.factor2),
        rotativaTrigger: "crossing",
        strategy: "dois2fatores",
        signalId: bet.signalId,
        betAttemptKey: bet.signalId,
      },
    };
  }

  return { fingerprint, actions, context };
}

/** Converte indicação da estratégia (sim ou ao vivo) no payload da extensão Chrome. */
export function buildExtensionBridgeFromUmFatorIndication(
  indication: RotatingUmFatorIndication,
  automationBalance?: number | null,
): Pick<RotatingRoomExtensionBridgePayload, "fingerprint" | "actions" | "context"> | null {
  if (
    indication.action !== "bet" ||
    indication.tableId == null ||
    !indication.exteriorBetKey ||
    !indication.signalId
  ) {
    return null;
  }

  return {
    fingerprint: indication.signalId,
    actions: [
      {
        kind: "click",
        target: "factor-1",
        label: indication.alertLabel ?? indication.exteriorBetKey,
        reason: `Um Fator · ${indication.tableLabel} · ${formatStakeBrl(indication.stake)} · gale ${indication.recovery}`,
      },
    ],
    context: {
      sessionMode: "active",
      prepareTableId: null,
      currentTableId: indication.tableId,
      mesaEmbedUrl: getCasinoEmbedUrlForTable(indication.tableId),
      mesaProvider: casinoEmbedProviderFromUrl(getCasinoEmbedUrlForTable(indication.tableId)),
      factor1Label: indication.alertLabel,
      factor2Label: null,
      factor1BetKey: indication.exteriorBetKey,
      factor2BetKey: null,
      singleFactorMode: true,
      signalId: indication.signalId,
      automationBalance:
        typeof automationBalance === "number" && Number.isFinite(automationBalance) && automationBalance > 0
          ? automationBalance
          : null,
      stakeAmount: indication.stake,
      currentRecovery: indication.recovery,
      baseStake: null,
      maxRecovery: readEffectiveUmFatorMaxRecovery(),
      executionMode: readRotatingRoomExtensionRealMode() ? "real" : "demo",
      mesaCatalog: buildRotatingRoomMesaCatalog(),
    },
  };
}
