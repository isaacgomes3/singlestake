import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { DamasLobbyGrid } from "@/components/damas/DamasLobbyGrid";
import { LiveApiToggleButton } from "@/components/live-api-toggle-button";
import { RotatingRoomLobbyCard } from "@/components/rotating-room-panel";
import { useRotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { setStrategySoundSuppressed } from "@/lib/sound/strategySoundGate";
import { SinglestakeLogo } from "@/components/singlestake-logo";
import { cn } from "@/lib/utils";
import { MinhaContaPanel } from "@/components/minha-conta-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  PROFILE_ICON_CHANGED_EVENT,
  ProfileIconAvatar,
  readProfileIconId,
  type ProfileIconId,
} from "@/components/profile-icon-gallery";
import {
  Bell,
  Briefcase,
  Calendar,
  CircleDot,
  Crown,
  Dices,
  Gift,
  Headphones,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  PiggyBank,
  Smartphone,
  Gamepad2,
  Sparkles,
  Trophy,
  Volleyball,
  Wallet,
  X,
} from "lucide-react";

import {
  ROULETTE_HISTORY_CHANGED_EVENT,
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  type RouletteHistoryChangedDetail,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { lobbyTableCardPhotoStyle, lobbyTableCardPhotoUrl } from "@/lib/roulette/lobbyTableCardAssets";
import { LOBBY_MACAO_SLOT_INDEX, ROULETTE_MACAO_TABLE_ID, lobbyTableDisplayName, resolveLobbyCardTableIds, ROTATING_ROOM_FIXED_TABLE_IDS, resolveRotatingRoomTableIds, type LobbyRoletasStrategyTab } from "@/lib/roulette/lobbyTables";
import {
  ROULETTE_LIVE_TABLE_CONFIG_EVENT,
  getLiveRouletteTableIds,
  getPrimaryLiveTableId,
} from "@/lib/roulette/liveTableConfig";
import { useRouletteLiveApi } from "@/lib/roulette/rouletteLiveApiContext";
import { useDgaTableImages } from "@/hooks/useDgaTableImages";
import {
  clearUserCasinoEmbedUrl,
  getCasinoEmbedUrlForTable,
  readUserCasinoEmbedUrl,
  writeUserCasinoEmbedUrl,
} from "@/lib/roulette/casinoEmbedConfig";
import {
  currentConsecutiveStreaksFromPlacarOutcomes,
  type StreetPlacarOutcome,
} from "@/lib/roulette/streetStrategy";
import {
  lobbyTableHasRotatingRoomSignal,
  type RotatingRoomLobbySession,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import { UM_FATOR_RESET_EVENT } from "@/lib/roulette/umFatorCrossingStrategy";
import {
  readRotatingRoomUmFatorSessionStats,
  ROTATING_ROOM_UM_FATOR_CHANGED_EVENT,
  ROTATING_ROOM_UM_FATOR_RESET_EVENT,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import {
  rotatingRoomSnapshotForTable,
  rotatingRoomSessionAproveitamentoPct,
} from "@/lib/roulette/rotatingRoomStrategy";

export {
  LOBBY_FIXED_TABLE_IDS,
  LOBBY_TABLE_DISPLAY_NAMES,
  ROULETTE_MACAO_TABLE_ID,
  lobbyTableDisplayName,
} from "@/lib/roulette/lobbyTables";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function cellClass(n: number, highlight: boolean): string {
  const base =
    "inline-flex h-5 min-w-[1.1rem] shrink-0 items-center justify-center rounded border px-0.5 text-[9px] font-bold tabular-nums leading-none shadow-inner sm:h-5 sm:min-w-[1.15rem] sm:text-[9px]";
  if (n === 0) {
    return `${base} ${highlight ? "border-white" : "border-emerald-500/50"} bg-emerald-600 text-white`;
  }
  if (RED.has(n)) {
    return `${base} ${highlight ? "border-white" : "border-red-500/40"} bg-red-600 text-white`;
  }
  return `${base} ${highlight ? "border-white" : "border-slate-700"} bg-slate-950 text-slate-100`;
}

const LOBBY_HISTORY_LEN = 7;

function isLobbyMacaoTableSlot(tableId: number, macaoTableId: number): boolean {
  return tableId === macaoTableId;
}

/** Editor do URL do casino (lápis + painel), alinhado à esquerda da barra do cartão. */
function LobbyCasinoUrlEditor({ tableId }: { tableId: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [panelOpen]);

  const togglePanel = () => {
    setPanelOpen((prev) => {
      if (!prev) {
        setDraft(readUserCasinoEmbedUrl(tableId) ?? "");
        setFeedback(null);
        return true;
      }
      return false;
    });
  };

  const hasSavedUrl = readUserCasinoEmbedUrl(tableId) !== null;
  const effectivePreview = getCasinoEmbedUrlForTable(tableId);

  return (
    <div
      ref={wrapRef}
      className="flex flex-col items-start gap-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={togglePanel}
          aria-expanded={panelOpen}
          title="Editar URL do casino guardada neste dispositivo"
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow-md backdrop-blur-sm sm:h-5 sm:w-5",
            panelOpen
              ? "border-cyan-500/60 bg-cyan-950/80 text-cyan-100"
              : "border-slate-600/90 bg-black/70 text-slate-200 hover:bg-black/85",
          )}
        >
          <Pencil className="h-2.5 w-2.5 sm:h-2.5 sm:w-2.5" aria-hidden />
        </button>
      </div>
      {panelOpen ? (
        <div
          role="dialog"
          aria-label={`Editar URL do casino — mesa ${tableId}`}
          className="z-[50] w-[min(92vw,22rem)] self-start rounded-xl border border-slate-600/90 bg-[#0d1524]/98 p-2.5 shadow-2xl backdrop-blur-md"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            URL do jogo (este dispositivo)
          </p>
          {effectivePreview ? (
            <p className="mt-1 truncate text-[9px] text-slate-500" title={effectivePreview}>
              {hasSavedUrl ? "Em uso (guardada): " : "Em uso (env / predefinição): "}
              <span className="font-mono text-slate-400">{effectivePreview}</span>
            </p>
          ) : (
            <p className="mt-1 text-[9px] text-slate-500">Nenhum URL definido — cole o link após login no operador.</p>
          )}
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setFeedback(null);
            }}
            rows={3}
            placeholder="https://…"
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-1.5 font-mono text-[10px] text-slate-100 placeholder:text-slate-600 sm:text-xs"
          />
          {feedback ? <p className="mt-1 text-[10px] text-amber-300/95">{feedback}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                try {
                  writeUserCasinoEmbedUrl(tableId, draft);
                  setFeedback(null);
                  setPanelOpen(false);
                } catch {
                  setFeedback("URL inválida — use http:// ou https:// completo.");
                }
              }}
              className="rounded-md bg-cyan-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-cyan-500 sm:text-[11px]"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                clearUserCasinoEmbedUrl(tableId);
                setDraft("");
                setFeedback(null);
                setPanelOpen(false);
              }}
              className="rounded-md border border-slate-600 bg-slate-800/90 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-700 sm:text-[11px]"
            >
              Limpar guardado
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400 hover:bg-slate-800/80 sm:text-[11px]"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function readHistoriesForTables(tableIds: readonly number[]): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const id of tableIds) out[id] = readLiveTableHistory(id);
  return out;
}

function useLobbyLiveHistories(tableIds: readonly number[]): Record<number, number[]> {
  const idsKey = tableIds.join(",");
  const [histories, setHistories] = useState<Record<number, number[]>>(() =>
    readHistoriesForTables(tableIds),
  );

  useEffect(() => {
    setHistories(readHistoriesForTables(tableIds));

    const sync = () => setHistories(readHistoriesForTables(tableIds));

    const onLive = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteLiveTableHistoryDetail>).detail;
      if (d?.tableId === undefined || tableIds.includes(d.tableId)) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null) {
        sync();
        return;
      }
      for (const id of tableIds) {
        if (
          e.key === liveTableHistoryStorageKey(id) ||
          e.key === liveTableSpinTimesStorageKey(id)
        ) {
          sync();
          return;
        }
      }
    };

    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    };
  }, [idsKey]);

  return histories;
}

type CasinoLiveRoletasStrategyTab = LobbyRoletasStrategyTab;

const CASINO_LIVE_STRATEGY: CasinoLiveRoletasStrategyTab = "um1fator";

function readLobbyFatoresRotatingRoomStats(): ReturnType<typeof readRotatingRoomUmFatorSessionStats> {
  return readRotatingRoomUmFatorSessionStats();
}

function lobbyCasinoLiveStrategyLabel(_tab: CasinoLiveRoletasStrategyTab): string {
  return "1 Fator";
}

function lobbyCasinoLiveStrategyRoute(_tab: CasinoLiveRoletasStrategyTab): string {
  return "/um-fator";
}

function lobbySalaRotativaRoute(_tab: CasinoLiveRoletasStrategyTab): string {
  return "/sala-rotativa-um-fator";
}

/** Histórico para placar: todas as estratégias acumulam o histórico completo da mesa. */
function lobbyHistoryForStrategyPlacar(
  _strategy: CasinoLiveRoletasStrategyTab,
  _tableId: number,
  historyNewestFirst: readonly number[],
): number[] {
  return [...historyNewestFirst];
}

/** Mesa do lobby com mais vitórias seguidas no placar da estratégia escolhida; empate → menor `tableId`. */
function lobbyStrategyPlacarOutcomes(
  _strategy: CasinoLiveRoletasStrategyTab,
  _hHour: readonly number[],
  _tableId: number,
): StreetPlacarOutcome[] {
  return [];
}

function lobbyStrategyAproveitamentoPct(
  _strategy: CasinoLiveRoletasStrategyTab,
  _hHour: readonly number[],
  _tableId: number,
): number {
  return rotatingRoomSessionAproveitamentoPct(readLobbyFatoresRotatingRoomStats());
}

/** Ordem no grid: mesa com sinal da sala rotativa primeiro; depois maior aproveitamento global. */
function sortLobbyTableIdsByAproveitamento(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  strategy: CasinoLiveRoletasStrategyTab,
  rotatingRoomSession?: RotatingRoomLobbySession | null,
): number[] {
  const signalRank = (tid: number): number => {
    if (
      rotatingRoomSession &&
      lobbyTableHasRotatingRoomSignal(tid, CASINO_LIVE_STRATEGY, rotatingRoomSession)
    ) {
      return 2;
    }
    return 0;
  };

  return [...tableIds].sort((a, b) => {
    const rankDiff = signalRank(b) - signalRank(a);
    if (rankDiff !== 0) return rankDiff;
    const pctA = lobbyStrategyAproveitamentoPct(
      strategy,
      lobbyHistoryForStrategyPlacar(strategy, a, histories[a] ?? []),
      a,
    );
    const pctB = lobbyStrategyAproveitamentoPct(
      strategy,
      lobbyHistoryForStrategyPlacar(strategy, b, histories[b] ?? []),
      b,
    );
    if (pctB !== pctA) return pctB - pctA;
    return a - b;
  });
}

/** Aproveitamento da estratégia (valor já calculado a partir do histórico ao vivo da mesa). */
function LobbyTableAproveitamentoBadge({ pct, compact = false }: { pct: number; compact?: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-2 text-center",
        compact ? "pb-16 sm:pb-[4.5rem]" : "pb-8 sm:pb-10",
      )}
      aria-live="polite"
    >
      <div
        className="rounded-xl border-2 border-[#9e82b7] bg-gradient-to-br from-[#4a2868] via-[#3c1e54] to-[#261238] px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)] sm:px-2 sm:py-1.5"
        aria-label={`Aproveitamento: ${pct.toFixed(1)} por cento`}
      >
        <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-white/90 sm:text-[8px]">
          Aproveitamento
        </span>
        <span className="mt-0.5 block text-base font-extrabold tabular-nums tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] sm:text-lg">
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function LobbyTableActiveSignalBadge({ strategyLabel }: { strategyLabel: string }) {
  return (
    <div
      className="pointer-events-none absolute left-1.5 top-1.5 z-[6] sm:left-2 sm:top-2"
      aria-live="polite"
    >
      <div
        className="rounded-lg border border-cyan-300/80 bg-cyan-950/90 px-1.5 py-1 shadow-[0_0_16px_rgba(34,211,238,0.35)] street-indication-pulse-cyan sm:px-2"
        aria-label={`Sinal activo — ${strategyLabel}`}
      >
        <span className="block text-[7px] font-bold uppercase tracking-[0.14em] text-cyan-200 sm:text-[8px]">
          Sinal activo
        </span>
      </div>
    </div>
  );
}

function LobbyCard({
  tableId,
  macaoTableId,
  isPrimary,
  liveHistory,
  strategyTab,
  isStreakLeader,
  rotatingRoomSession,
}: {
  tableId: number;
  macaoTableId: number;
  isPrimary: boolean;
  liveHistory: number[];
  strategyTab: CasinoLiveRoletasStrategyTab;
  isStreakLeader: boolean;
  rotatingRoomSession?: RotatingRoomLobbySession | null;
}) {
  const isUm1Fator = strategyTab === "um1fator";
  const isFatoresTab = isUm1Fator;
  const usesRotatingRoomPlacar = isFatoresTab && rotatingRoomSession != null;
  const display = liveHistory.slice(0, LOBBY_HISTORY_LEN);
  const title = lobbyTableDisplayName(tableId, macaoTableId);
  const photoBg = lobbyTableCardPhotoUrl(tableId, macaoTableId);
  const photoStyle = lobbyTableCardPhotoStyle(tableId, macaoTableId);
  const historyPlacar = useMemo(
    () => lobbyHistoryForStrategyPlacar(strategyTab, tableId, liveHistory),
    [tableId, liveHistory, strategyTab],
  );
  const pct = useMemo(() => {
    if (usesRotatingRoomPlacar) {
      return rotatingRoomSessionAproveitamentoPct(rotatingRoomSession.sessionStats);
    }
    return lobbyStrategyAproveitamentoPct(strategyTab, historyPlacar, tableId);
  }, [historyPlacar, rotatingRoomSession, strategyTab, tableId, usesRotatingRoomPlacar]);
  const strategySnap = useMemo(
    () => rotatingRoomSnapshotForTable(strategyTab, historyPlacar, tableId),
    [historyPlacar, strategyTab, tableId],
  );
  const hasActiveSignal = usesRotatingRoomPlacar
    ? lobbyTableHasRotatingRoomSignal(tableId, strategyTab, rotatingRoomSession)
    : strategySnap.hasActive && liveHistory.length > 0;
  const strategyLabel = lobbyCasinoLiveStrategyLabel(strategyTab);
  const vitSeguidas = useMemo(() => {
    if (isFatoresTab) return 0;
    const outcomes = lobbyStrategyPlacarOutcomes(strategyTab, historyPlacar, tableId);
    return currentConsecutiveStreaksFromPlacarOutcomes(outcomes).consecutiveWins;
  }, [historyPlacar, isFatoresTab, strategyTab, tableId]);
  const isAzureRoulette1 = tableId === 227;
  const isRoulette3LobbyCard = tableId === 230;
  const isBrasileiraLobbyCard = tableId === 237;
  const isMacaoLobbyCard = isLobbyMacaoTableSlot(tableId, macaoTableId);
  const overlayPhoto =
    photoBg && isAzureRoulette1
      ? "linear-gradient(180deg, rgba(8,13,24,0.45) 0%, transparent 42%, rgba(8,13,24,0.82) 100%), radial-gradient(ellipse 90% 55% at 50% 35%, rgba(0,0,0,0.15), transparent 52%)"
      : photoBg && isMacaoLobbyCard
        ? "linear-gradient(180deg, rgba(8,13,24,0.55) 0%, transparent 38%, rgba(8,13,24,0.88) 100%), radial-gradient(ellipse 95% 60% at 50% 40%, rgba(0,0,0,0.35), transparent 55%)"
        : photoBg && isBrasileiraLobbyCard
          ? "linear-gradient(180deg, rgba(8,13,24,0.22) 0%, transparent 45%, rgba(8,13,24,0.65) 100%)"
          : photoBg && isRoulette3LobbyCard
            ? "linear-gradient(180deg, rgba(8,13,24,0.24) 0%, transparent 44%, rgba(8,13,24,0.68) 100%)"
            : photoBg
          ? "linear-gradient(180deg, rgba(8,13,24,0.28) 0%, transparent 48%, rgba(8,13,24,0.78) 100%), radial-gradient(ellipse 90% 55% at 50% 35%, rgba(0,0,0,0.12), transparent 52%)"
          : null;

  const photoOverlayOpacity = photoBg
    ? isAzureRoulette1
      ? "opacity-[0.28]"
      : isMacaoLobbyCard
        ? "opacity-[0.38]"
        : isBrasileiraLobbyCard
          ? "opacity-[0.14]"
          : isRoulette3LobbyCard
            ? "opacity-[0.14]"
            : "opacity-[0.22]"
    : "opacity-35";

  const borderShell = isStreakLeader
    ? "border-emerald-400/60 ring-2 ring-emerald-400/40 shadow-[0_0_32px_rgba(52,211,153,0.22)]"
    : hasActiveSignal
      ? "border-cyan-400/55 ring-2 ring-cyan-400/35 shadow-[0_0_28px_rgba(34,211,238,0.18)]"
      : isPrimary
        ? "border-cyan-500/50 ring-1 ring-cyan-400/15"
        : "border-slate-800/80";

  const article = (
    <article
      className={`flex flex-col overflow-visible rounded-2xl border bg-[#0d1524] shadow-xl ${borderShell}`}
    >
      {strategyTab === "um1fator" ? (
        <div
          className={cn(
            "relative z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 border-b px-1.5 py-1 sm:gap-x-1.5 sm:px-2 sm:py-1.5",
            isStreakLeader
              ? "border-emerald-500/45 bg-gradient-to-r from-emerald-950 via-emerald-900/85 to-emerald-950"
              : "min-h-[2.25rem] border-transparent bg-transparent sm:min-h-[2.5rem]",
          )}
        >
          <div className="pointer-events-auto z-30 flex min-w-0 items-center justify-start">
            <LobbyCasinoUrlEditor tableId={tableId} />
          </div>
          <div
            className={cn(
              "flex min-w-0 max-w-full flex-col items-center justify-center px-1 text-center",
              !isStreakLeader && "pointer-events-none",
            )}
            aria-hidden={!isStreakLeader}
          >
            {isStreakLeader ? (
              <>
                <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-emerald-300/95 sm:text-[8px]">
                  Recomendado agora
                </p>
                <p className="mx-auto mt-0.5 max-w-full truncate text-[11px] font-extrabold leading-tight tracking-tight text-white sm:text-xs">
                  {title}
                </p>
              </>
            ) : null}
          </div>
          <div className="pointer-events-auto z-30 flex min-w-0 items-center justify-end">
            <Link
              to="/casino-mesa"
              search={{ mesa: tableId }}
              title="Abrir casino com tapete (URL configurável)"
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-600/90 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-cyan-200 shadow-md backdrop-blur-sm hover:bg-black/85 sm:text-[8px]"
              onClick={(e) => e.stopPropagation()}
            >
              <Layers className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden />
              Casino+
            </Link>
          </div>
        </div>
      ) : null}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950">
        {photoStyle ? (
          <div
            className="absolute inset-0 z-0 bg-cover bg-no-repeat"
            style={photoStyle}
            aria-hidden
          />
        ) : null}
        <div
          className={`absolute inset-0 z-[1] ${photoOverlayOpacity}`}
          style={{
            backgroundImage: overlayPhoto
              ? overlayPhoto
              : "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(6,182,212,0.15), transparent), linear-gradient(180deg, rgba(15,23,42,0.95) 0%, transparent 50%)",
          }}
        />
        {!photoBg ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none text-6xl opacity-[0.1] sm:text-7xl" aria-hidden>
              ◎
            </span>
          </div>
        ) : null}
        {strategyTab === "um1fator" ? (
          <>
            {hasActiveSignal ? <LobbyTableActiveSignalBadge strategyLabel={strategyLabel} /> : null}
            <LobbyTableAproveitamentoBadge pct={pct} compact={isFatoresTab} />
          </>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col bg-gradient-to-t from-black via-black/85 to-transparent px-1 pb-1.5 pt-4 sm:px-1.5 sm:pb-2 sm:pt-5">
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto sm:gap-0.5">
            {display.length === 0 ? (
              <span className="text-[9px] font-medium leading-tight text-slate-500">Aguardando giros…</span>
            ) : (
              display.map((n, i) => (
                <span key={`${tableId}-${i}-${n}`} className={cellClass(n, i === 0)}>
                  {n}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-start justify-between gap-1.5 border-t border-slate-800/90 px-2 py-1.5 sm:px-2.5 sm:py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-1 gap-y-0">
            <h2 className="min-w-0 truncate text-[11px] font-bold leading-tight tracking-tight text-white sm:text-xs">
              {title}
            </h2>
            {strategyTab === "um1fator" && !isFatoresTab ? (
              <span
                className="shrink-0 whitespace-nowrap text-[8px] leading-tight sm:text-[9px]"
                aria-live="polite"
              >
                <span className="font-semibold uppercase tracking-wide text-slate-500">
                  Vitórias seguidas{" "}
                </span>
                <span className="font-bold tabular-nums text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">
                  {vitSeguidas}
                </span>
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[8px] leading-tight text-slate-500 sm:text-[9px]">
            Mesa {tableId}
            {isFatoresTab ? (
              <span className="text-slate-600">
                {" "}
                · {pct.toFixed(1)}% aproveit.
              </span>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 self-center text-xs text-slate-600 sm:text-sm" aria-hidden>
          ♡
        </span>
      </div>
    </article>
  );

  const linkTo = lobbyCasinoLiveStrategyRoute(strategyTab);

  if (strategyTab === "um1fator") {
    const leaderHint = isStreakLeader
      ? ` Recomendado por vitórias seguidas no ${strategyLabel}.`
      : "";
    const activeHint = hasActiveSignal ? ` Sinal activo no ${strategyLabel}.` : "";
    return (
      <div className="relative block rounded-2xl outline-none transition hover:opacity-[0.98] focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2 focus-within:ring-offset-[#060a14]">
        <Link
          to={linkTo}
          search={{ mesa: tableId }}
          className="absolute inset-0 z-[1] rounded-2xl"
          aria-label={`${title}: abrir ${strategyLabel} (mesa ${tableId}).${leaderHint}${activeHint}`}
        />
        <div className="relative z-[2] pointer-events-none">{article}</div>
      </div>
    );
  }

  return article;
}

/** Sub-abas dentro de «Cassino ao vivo». */
type CasinoLiveSubTab = "roletas";

type LobbyMainTab = "dashboard" | "tabuleiro" | "casino" | "casinoLive" | "esporte" | "suporte";

/** Sub-abas dentro de «Jogos de Tabuleiro». */
type BoardGamesSubTab = "damasOnline";

function SidebarNav({
  onNavigate,
  onLogout,
  mobile,
  mainTab,
  setMainTab,
  boardGamesSubTab,
  setBoardGamesSubTab,
  casinoLiveSubTab,
  setCasinoLiveSubTab,
}: {
  onNavigate?: () => void;
  onLogout?: () => void;
  mobile?: boolean;
  mainTab: LobbyMainTab;
  setMainTab: (t: LobbyMainTab) => void;
  boardGamesSubTab: BoardGamesSubTab;
  setBoardGamesSubTab: (t: BoardGamesSubTab) => void;
  casinoLiveSubTab: CasinoLiveSubTab;
  setCasinoLiveSubTab: (t: CasinoLiveSubTab) => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onDashboard = pathname === "/";
  const onBackOffice = pathname === "/back-office" || pathname.startsWith("/back-office/");
  const onCassinoRoute = pathname === "/cassino";
  const linkBase =
    "theme-sidebar-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium";
  const activeNav = "theme-sidebar-item-active";

  return (
    <nav
      className={`flex flex-col gap-1 ${mobile ? "p-4" : "px-3 py-2"}`}
      aria-label="Menu principal"
    >
      <Link
        to="/"
        className={`${linkBase} ${onDashboard ? activeNav : ""}`}
        onClick={() => onNavigate?.()}
      >
        <LayoutDashboard className="h-5 w-5 shrink-0 text-info" aria-hidden />
        Dashboard
      </Link>
      <Link
        to="/back-office"
        className={`${linkBase} ${onBackOffice ? activeNav : ""}`}
        onClick={() => onNavigate?.()}
      >
        <Briefcase className="h-5 w-5 shrink-0 text-info" aria-hidden />
        Back office
      </Link>
      <button
        type="button"
        className={`${linkBase} w-full text-left ${mainTab === "tabuleiro" ? activeNav : ""}`}
        onClick={() => {
          if (onCassinoRoute) {
            navigate({ to: "/" });
          }
          setMainTab("tabuleiro");
          setBoardGamesSubTab("damasOnline");
          onNavigate?.();
        }}
      >
        <Dices className="h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
        Jogos de Tabuleiro
      </button>
      {mainTab === "tabuleiro" ? (
        <button
          type="button"
          className={cn(
            linkBase,
            "w-full border-l-2 border-info/35 py-2 pl-5 text-left text-[13px]",
            boardGamesSubTab === "damasOnline" ? activeNav : "",
          )}
          onClick={() => {
            setMainTab("tabuleiro");
            setBoardGamesSubTab("damasOnline");
            onNavigate?.();
          }}
        >
          <Dices className="h-4 w-4 shrink-0 text-amber-400/75" aria-hidden />
          Dama on line
        </button>
      ) : null}
      <Link
        to="/cassino"
        className={`${linkBase} ${onCassinoRoute ? activeNav : ""}`}
        onClick={() => {
          setMainTab("casinoLive");
          setCasinoLiveSubTab("roletas");
          onNavigate?.();
        }}
      >
        <Sparkles className="h-5 w-5 shrink-0 text-info" aria-hidden />
        Cassino ao vivo
      </Link>
      {onCassinoRoute && mainTab === "casinoLive" ? (
        <button
          type="button"
          className={cn(
            linkBase,
            "w-full border-l-2 border-info/35 py-2 pl-5 text-left text-[13px]",
            activeNav,
          )}
          onClick={() => {
            setMainTab("casinoLive");
            setCasinoLiveSubTab("roletas");
            onNavigate?.();
          }}
        >
          <CircleDot className="h-4 w-4 shrink-0 text-cyan-400/80" aria-hidden />
          Roletas
        </button>
      ) : null}
      <button
        type="button"
        className={`${linkBase} w-full text-left ${mainTab === "casino" ? activeNav : ""}`}
        onClick={() => {
          setMainTab("casino");
          onNavigate?.();
        }}
      >
        <CircleDot className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
        Cassino
      </button>
      <button
        type="button"
        className={`${linkBase} w-full text-left ${mainTab === "esporte" ? activeNav : ""}`}
        onClick={() => {
          setMainTab("esporte");
          onNavigate?.();
        }}
      >
        <Volleyball className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
        Esporte
      </button>

      <div className="my-1 border-t border-border-color" aria-hidden />

      <button
        type="button"
        disabled
        className={`${linkBase} w-full cursor-not-allowed text-left opacity-60`}
        title="Em breve"
      >
        <Crown className="h-5 w-5 shrink-0 text-cyan-400/90" aria-hidden />
        Clube VIP
      </button>
      <button
        type="button"
        className={`${linkBase} w-full text-left ${mainTab === "suporte" ? activeNav : ""}`}
        onClick={() => {
          setMainTab("suporte");
          onNavigate?.();
        }}
      >
        <Headphones className="h-5 w-5 shrink-0 text-cyan-400" aria-hidden />
        Suporte
      </button>
      <button
        type="button"
        className={`${linkBase} w-full text-left hover:bg-danger/10 hover:text-danger`}
        onClick={() => {
          onLogout?.();
        }}
      >
        <LogOut className="h-5 w-5 shrink-0 text-cyan-400" aria-hidden />
        Deslogar
      </button>
    </nav>
  );
}

const BANNER_SLIDES = [
  {
    title: "Cashback",
    subtitle: "Ganhe cashbacks diários, semanais e mensais.",
    tone: "from-violet-600/40 via-indigo-950/50 to-slate-950",
    decor: "calendar" as const,
  },
  {
    title: "Cashback esportivo",
    subtitle: "Receba cashbacks de suas apostas esportivas",
    tone: "from-sky-600/35 via-blue-950/45 to-slate-950",
    decor: "sport" as const,
  },
  {
    title: "Clube Vip",
    subtitle: "Recompensas instantâneas e benefícios exclusivos em cada novo nível avançado.",
    tone: "from-amber-600/30 via-violet-950/40 to-slate-950",
    decor: "crown" as const,
  },
];

/**
 * Shell do lobby (barra lateral, cabeçalho, banners) + conteúdo por secção.
 */
export type RouletteLobbyHomeView = "dashboard" | "cassino";

export function RouletteLobbyPage({ homeView = "cassino" }: { homeView?: RouletteLobbyHomeView }) {
  const navigate = useNavigate();
  const [, bump] = useState(0);
  useDgaTableImages();
  const { liveApiEnabled } = useRouletteLiveApi();
  const [mainTab, setMainTab] = useState<LobbyMainTab>(
    homeView === "dashboard" ? "dashboard" : "casinoLive",
  );
  const [boardGamesSubTab, setBoardGamesSubTab] = useState<BoardGamesSubTab>("damasOnline");
  const [casinoLiveSubTab, setCasinoLiveSubTab] = useState<CasinoLiveSubTab>("roletas");

  useEffect(() => {
    if (homeView === "dashboard") {
      setMainTab("dashboard");
      return;
    }
    setMainTab("casinoLive");
    setCasinoLiveSubTab("roletas");
  }, [homeView]);

  const lobbyStrategySoundActive =
    mainTab === "casinoLive" && homeView === "cassino";

  useEffect(() => {
    setStrategySoundSuppressed(!lobbyStrategySoundActive);
    return () => setStrategySoundSuppressed(false);
  }, [lobbyStrategySoundActive]);

  const lobbyRotatingRoomObserveOnly = true;

  const [bannerIdx, setBannerIdx] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [headerProfileIconId, setHeaderProfileIconId] = useState<ProfileIconId>(() =>
    typeof window !== "undefined" ? readProfileIconId() : "avatar-01",
  );

  useEffect(() => {
    const sync = () => setHeaderProfileIconId(readProfileIconId());
    sync();
    window.addEventListener(PROFILE_ICON_CHANGED_EVENT, sync as EventListener);
    return () => window.removeEventListener(PROFILE_ICON_CHANGED_EVENT, sync as EventListener);
  }, []);

  const [primaryTableId, setPrimaryTableId] = useState<number | null>(() =>
    getPrimaryLiveTableId(),
  );

  /** Ids dos oito cartões; a Macao alinha-se ao SSE `ready` para coincidir com `localStorage` dos giros. */
  const [lobbyCardTableIds, setLobbyCardTableIds] = useState<readonly number[]>(() =>
    resolveLobbyCardTableIds(getLiveRouletteTableIds()),
  );

  useEffect(() => {
    const sync = () => setLobbyCardTableIds(resolveLobbyCardTableIds(getLiveRouletteTableIds()));
    sync();
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
  }, []);

  const primaryId = primaryTableId ?? lobbyCardTableIds[0]!;
  const macaoTid = lobbyCardTableIds[LOBBY_MACAO_SLOT_INDEX] ?? ROULETTE_MACAO_TABLE_ID;
  const lobbyLiveHistories = useLobbyLiveHistories(lobbyCardTableIds);

  const rotatingRoomTableIds = useMemo(() => {
    const resolved = resolveRotatingRoomTableIds(getLiveRouletteTableIds());
    return resolved.length > 0 ? resolved : [...ROTATING_ROOM_FIXED_TABLE_IDS];
  }, [lobbyCardTableIds]);

  const rotatingRoomHistories = useRotatingRoomHistories(rotatingRoomTableIds);
  const rotatingRoomSession = useRotatingRoomUmFatorSession(
    rotatingRoomTableIds,
    rotatingRoomHistories,
    { observeOnly: lobbyRotatingRoomObserveOnly },
  );

  const ruas9StreakLeaderId = useMemo(() => null, []);

  const lobbyCardTableIdsByAproveitamento = useMemo(
    () =>
      sortLobbyTableIdsByAproveitamento(
        lobbyCardTableIds,
        lobbyLiveHistories,
        CASINO_LIVE_STRATEGY,
        rotatingRoomSession,
      ),
    [lobbyCardTableIds, lobbyLiveHistories, rotatingRoomSession],
  );

  useEffect(() => {
    const syncPrimary = () => setPrimaryTableId(getPrimaryLiveTableId());
    syncPrimary();
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, syncPrimary);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, syncPrimary);
  }, []);

  useEffect(() => {
    const bumpAll = () => bump((x) => x + 1);
    const onHist = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteHistoryChangedDetail>).detail;
      if (d?.scope === "all" || d?.scope === "espelho") bumpAll();
    };
    window.addEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onHist);
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, bumpAll as EventListener);
    return () => {
      window.removeEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onHist);
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, bumpAll as EventListener);
    };
  }, []);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    setAccountPanelOpen(false);
    window.location.assign("/");
  };

  const headerPill = (tab: LobbyMainTab, label: string, Icon: typeof CircleDot) => {
    const active = mainTab === tab;
    return (
      <button
        type="button"
        onClick={() => {
          if (tab === "casinoLive") {
            navigate({ to: "/cassino" });
            setMainTab("casinoLive");
            setCasinoLiveSubTab("roletas");
            return;
          }
          if (tab === "dashboard") {
            navigate({ to: "/" });
            setMainTab("dashboard");
            return;
          }
          setMainTab(tab);
        }}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
          active
            ? "border-info/60 bg-sidebar-active text-text-primary shadow-theme"
            : "border-border-color bg-bg-card text-text-secondary hover:border-border-color hover:bg-bg-card-hover hover:text-text-primary"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary">
      <MinhaContaPanel open={accountPanelOpen} onClose={() => setAccountPanelOpen(false)} />
      {/* Sidebar desktop */}
      <aside className="theme-sidebar relative hidden w-[280px] shrink-0 flex-col border-r lg:flex">
        <div className="flex items-center justify-center border-b border-sidebar-border-fixed px-3 py-4">
          <Link to="/" aria-label="Ir para o dashboard">
            <SinglestakeLogo variant="stacked" className="h-[104px] w-full max-w-[260px]" />
          </Link>
        </div>

        <div className="border-b border-sidebar-border-fixed px-3 py-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-sidebar-fg-muted">
              Recompensas
            </span>
            <button
              type="button"
              className="text-[10px] font-semibold text-sidebar-fg hover:opacity-80"
            >
              Ver todos
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[Gift, PiggyBank, Calendar, Trophy].map((Icon, i) => (
              <button
                key={i}
                type="button"
                className="flex aspect-square items-center justify-center rounded-lg border border-sidebar-border-fixed bg-sidebar-hover text-sidebar-fg transition hover:bg-sidebar-active"
                aria-label="Recompensa"
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>

        <SidebarNav
          mainTab={mainTab}
          setMainTab={setMainTab}
          boardGamesSubTab={boardGamesSubTab}
          setBoardGamesSubTab={setBoardGamesSubTab}
          casinoLiveSubTab={casinoLiveSubTab}
          setCasinoLiveSubTab={setCasinoLiveSubTab}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="theme-overlay absolute inset-0"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="theme-sidebar relative ml-0 flex h-full w-[min(88vw,280px)] flex-col border-r shadow-theme">
            <div className="flex items-center justify-between gap-2 border-b border-sidebar-border-fixed px-3 py-2.5">
              <SinglestakeLogo className="h-16 min-w-0 max-w-[min(340px,82vw)] shrink-0" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="theme-sidebar-item rounded-lg p-2"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-sidebar-border-fixed px-3 py-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase text-sidebar-fg-muted">Recompensas</span>
                <span className="text-[10px] text-sidebar-fg">Ver todos</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[Gift, PiggyBank, Calendar, Trophy].map((Icon, i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-lg border border-sidebar-border-fixed bg-sidebar-hover text-sidebar-fg"
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                ))}
              </div>
            </div>
            <SidebarNav
              mobile
              mainTab={mainTab}
              setMainTab={setMainTab}
              boardGamesSubTab={boardGamesSubTab}
              setBoardGamesSubTab={setBoardGamesSubTab}
              casinoLiveSubTab={casinoLiveSubTab}
              setCasinoLiveSubTab={setCasinoLiveSubTab}
              onNavigate={() => setMobileMenuOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho: selectores + login / saldo / depositar */}
        <header className="app-top-bar sticky top-0 z-40 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="theme-sidebar-item rounded-lg p-2 lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              {headerPill("dashboard", "Dashboard", LayoutDashboard)}
              {headerPill("casinoLive", "Cassino ao vivo", Sparkles)}
              {headerPill("casino", "Cassino", CircleDot)}
              {headerPill("esporte", "Esporte", Volleyball)}
              {headerPill("suporte", "Suporte", Headphones)}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <ThemeToggle compact />
              <Link
                to="/mobile"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-950/50 md:hidden"
              >
                <Smartphone className="h-4 w-4" aria-hidden />
                Modo app
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-theme transition hover:opacity-90"
              >
                <Wallet className="h-4 w-4" aria-hidden />
                Depositar
              </button>
              <div className="hidden h-8 w-px bg-border-color sm:block" aria-hidden />
              <div className="flex items-center gap-2 rounded-lg border border-border-color bg-bg-card px-3 py-1.5">
                <span className="text-sm font-semibold tabular-nums text-info">R$ 0,00</span>
              </div>
              <div className="flex items-center gap-2 pl-1">
                <button
                  type="button"
                  onClick={() => setAccountPanelOpen(true)}
                  className="theme-sidebar-item flex min-w-0 max-w-[11rem] items-center gap-2 rounded-lg py-1 pl-0.5 pr-2 text-left sm:max-w-xs"
                  aria-label="Abrir minha conta"
                >
                  <ProfileIconAvatar id={headerProfileIconId} size="sm" />
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-xs font-semibold text-text-primary">Visitante</p>
                    <p className="text-[10px] text-text-secondary">Conta demo</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="theme-sidebar-item relative rounded-lg p-2"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-info px-0.5 text-[9px] font-bold text-kpi-foreground">
                    0
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Banners: fora do header sticky para rolar com a página */}
        <div className="border-b border-border-color bg-bg-primary">
          <div className="border-t border-border-color bg-bg-secondary/50 py-4">
            <div className="mx-auto w-full max-w-5xl px-3 sm:px-5">
              <div
                className={`relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-r p-6 sm:p-8 ${BANNER_SLIDES[bannerIdx]?.tone}`}
              >
                <div className="relative z-10 max-w-md">
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-200/90">
                    Destaque
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                    {BANNER_SLIDES[bannerIdx]?.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-200/95">
                    {BANNER_SLIDES[bannerIdx]?.subtitle}
                  </p>
                </div>
                {BANNER_SLIDES[bannerIdx]?.decor === "calendar" ? (
                  <Calendar
                    className="pointer-events-none absolute -right-1 bottom-4 h-32 w-32 text-white/[0.08] sm:-right-2 sm:bottom-8 sm:h-44 sm:w-44"
                    strokeWidth={1.15}
                    aria-hidden
                  />
                ) : BANNER_SLIDES[bannerIdx]?.decor === "sport" ? (
                  <Volleyball
                    className="pointer-events-none absolute -right-1 bottom-4 h-32 w-32 text-white/[0.08] sm:-right-2 sm:bottom-8 sm:h-44 sm:w-44"
                    strokeWidth={1.15}
                    aria-hidden
                  />
                ) : (
                  <Crown
                    className="pointer-events-none absolute -right-1 bottom-4 h-32 w-32 text-amber-200/[0.12] sm:-right-2 sm:bottom-8 sm:h-44 sm:w-44"
                    strokeWidth={1.15}
                    aria-hidden
                  />
                )}
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {BANNER_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBannerIdx(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === bannerIdx ? "w-6 bg-cyan-400" : "w-2 bg-slate-600 hover:bg-slate-500"
                      }`}
                      aria-label={`Banner ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo centralizado */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-8 sm:px-6">
          {mainTab === "dashboard" ? (
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/35 px-6 py-20 text-center sm:py-24">
              <LayoutDashboard className="mx-auto h-14 w-14 text-cyan-400/90" aria-hidden />
              <p className="mt-5 text-xl font-bold text-white">Dashboard</p>
              <p className="mt-2 text-sm text-slate-400">Em construção.</p>
              <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">
                As roletas ao vivo e o simulador ficam no Cassino ao vivo.
              </p>
              <Link
                to="/cassino"
                className="mt-8 inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Abrir Cassino ao vivo
              </Link>
            </div>
          ) : mainTab === "esporte" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 py-20 text-center">
              <Volleyball className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-lg font-semibold text-slate-300">Área desportiva</p>
              <p className="mt-1 text-sm text-slate-500">Em breve.</p>
            </div>
          ) : mainTab === "tabuleiro" ? (
            <div className="space-y-6">
              <nav
                className="flex flex-col gap-3 border-b border-slate-800/90 pb-4 sm:flex-row sm:items-end sm:justify-between"
                aria-label="Subcategorias de jogos de tabuleiro"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Jogos de Tabuleiro
                  </p>
                  <p className="mt-1 text-sm text-slate-400">Escolhe o jogo para ver as salas.</p>
                </div>
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-1.5 sm:rounded-full">
                  <button
                    type="button"
                    onClick={() => setBoardGamesSubTab("damasOnline")}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-semibold transition sm:rounded-full",
                      boardGamesSubTab === "damasOnline"
                        ? "bg-cyan-500/20 text-cyan-100 shadow-inner shadow-cyan-500/10"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                    )}
                  >
                    Dama on line
                  </button>
                </div>
              </nav>
              {boardGamesSubTab === "damasOnline" ? <DamasLobbyGrid /> : null}
            </div>
          ) : mainTab === "suporte" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 px-6 py-16 text-center sm:py-20">
              <Headphones className="mx-auto h-12 w-12 text-cyan-500/80" aria-hidden />
              <p className="mt-4 text-lg font-semibold text-white">Suporte</p>
              <p className="mt-2 max-w-md mx-auto text-sm text-slate-400">
                Canal de ajuda — em integração. Aqui poderás ligar chat ao vivo, FAQ ou o teu sistema de tickets.
              </p>
              <p className="mt-8 text-xs text-slate-500">
                Contacto de exemplo:{" "}
                <a
                  href="mailto:suporte@exemplo.com"
                  className="font-medium text-cyan-400 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-300"
                >
                  suporte@exemplo.com
                </a>
              </p>
            </div>
          ) : mainTab === "casinoLive" ? (
            <div className="space-y-6">
              <nav
                className="flex flex-col gap-3 border-b border-slate-800/90 pb-4 sm:flex-row sm:items-end sm:justify-between"
                aria-label="Subcategorias do cassino ao vivo"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Cassino ao vivo
                  </p>
                </div>
                <LiveApiToggleButton />
              </nav>
              <>
                {!liveApiEnabled ? (
                  <p className="text-center text-sm text-amber-300/90">
                    A API ao vivo está desligada. Clique em «Ligar API ao vivo» acima para receber giros
                    e indicações.
                  </p>
                ) : null}

                <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <RotatingRoomLobbyCard
                      session={rotatingRoomSession}
                      salaRoute={lobbySalaRotativaRoute(CASINO_LIVE_STRATEGY)}
                      salaLabel="Sala Rotativa · 1 Fator"
                    />
                    {lobbyCardTableIdsByAproveitamento.map((tid) => (
                      <LobbyCard
                        key={tid}
                        tableId={tid}
                        macaoTableId={macaoTid}
                        isPrimary={tid === primaryId}
                        liveHistory={lobbyLiveHistories[tid] ?? []}
                        strategyTab={CASINO_LIVE_STRATEGY}
                        isStreakLeader={ruas9StreakLeaderId !== null && tid === ruas9StreakLeaderId}
                        rotatingRoomSession={rotatingRoomSession}
                      />
                    ))}
                  </div>
              </>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 py-20 text-center">
              <CircleDot className="mx-auto h-12 w-12 text-cyan-500/50" aria-hidden />
              <p className="mt-4 text-lg font-semibold text-slate-300">Cassino</p>
              <p className="mt-1 text-sm text-slate-500">
                Slots e jogos instantâneos — em breve. As roletas ao vivo estão em{" "}
                <button
                  type="button"
                  className="font-medium text-cyan-400 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-300"
                  onClick={() => navigate({ to: "/cassino" })}
                >
                  Cassino ao vivo
                </button>
                .
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
