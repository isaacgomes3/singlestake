import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { RotatingRoomExtensionStatus } from "@/components/rotating-room-extension-status";
import { RotatingRoomLobbyCard } from "@/components/rotating-room-panel";
import { useDgaTableImages } from "@/hooks/useDgaTableImages";
import { useUmFatorSession } from "@/hooks/useUmFatorSession";
import {
  buildUmFatorLiveViewForTable,
  readUmFatorMachineState,
} from "@/lib/roulette/umFatorCrossingStrategy";
import {
  useAutomationAlignedCrossingSession,
  useAutomationAlignedRotativaSession,
} from "@/hooks/useAutomationAlignedRotatingSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useLiveSseStatus } from "@/hooks/useLiveSseStatus";
import {
  lobbyTableCardFallbackBg,
  lobbyTableCardPhotoStyle,
  lobbyTableCardPhotoUrl,
} from "@/lib/roulette/lobbyTableCardAssets";
import {
  getLiveRouletteTableIds,
  getPrimaryLiveTableId,
  ROULETTE_LIVE_TABLE_CONFIG_EVENT,
} from "@/lib/roulette/liveTableConfig";
import {
  lobbyTableDisplayName,
  LOBBY_MACAO_SLOT_INDEX,
  resolveLobbyCardTableIds,
  resolveRotatingRoomTableIds,
  ROULETTE_MACAO_TABLE_ID,
  ROTATING_ROOM_FIXED_TABLE_IDS,
} from "@/lib/roulette/lobbyTables";
import {
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  ROULETTE_HISTORY_CHANGED_EVENT,
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { automationWorkspaceHref, isExternalHref } from "@/lib/app-profile";

import type { BackOfficeModuleId } from "@/lib/back-office/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/i18n-provider";

const AUTOMATION_SALA_ROUTE = automationWorkspaceHref("/sala-rotativa-um-fator");
const AUTOMATION_SALA_2F_ROUTE = automationWorkspaceHref("/sala-rotativa-dois-fatores");

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function historyCellClass(n: number, highlight: boolean): string {
  const base =
    "inline-flex h-5 min-w-[1.1rem] shrink-0 items-center justify-center rounded border px-0.5 text-[9px] font-bold tabular-nums leading-none shadow-inner";
  if (n === 0) {
    return `${base} ${highlight ? "border-white" : "border-emerald-500/50"} bg-emerald-600 text-white`;
  }
  if (RED.has(n)) {
    return `${base} ${highlight ? "border-white" : "border-red-500/40"} bg-red-600 text-white`;
  }
  return `${base} ${highlight ? "border-white" : "border-slate-700"} bg-slate-950 text-slate-100`;
}

function tableHasLocalUmFatorSignal(tableId: number, history: readonly number[]): boolean {
  const machine = readUmFatorMachineState(tableId);
  return buildUmFatorLiveViewForTable(tableId, history, machine).globalActive != null;
}

function CasinoTableCard({
  tableId,
  macaoTableId,
  title,
  tableLabel,
  recent,
  noSpinsLabel,
  signalActiveLabel,
  isPrimary,
  href,
  external,
}: {
  tableId: number;
  macaoTableId: number;
  title: string;
  tableLabel: string;
  recent: number[];
  noSpinsLabel: string;
  signalActiveLabel: string;
  isPrimary: boolean;
  href: string;
  external: boolean;
}) {
  const session = useUmFatorSession(tableId, recent, { observeOnly: true });
  const hasSignal = session.showTapeteSignal;
  const photoBg = lobbyTableCardPhotoUrl(tableId, macaoTableId);
  const photoStyle = lobbyTableCardPhotoStyle(tableId, macaoTableId);
  const cardClass = cn(
    "theme-card flex flex-col overflow-hidden rounded-2xl p-0 transition hover:border-border-color",
    hasSignal
      ? "border-warning/55 ring-2 ring-warning/30"
      : isPrimary
        ? "border-info/40"
        : "border-border-color",
  );
  const cardBody = (
    <article className="flex h-full flex-col">
      <div
        className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950"
        style={photoBg ? undefined : { background: lobbyTableCardFallbackBg() }}
      >
        {photoStyle ? (
          <div className="absolute inset-0 bg-cover bg-no-repeat" style={photoStyle} aria-hidden />
        ) : null}
        <div
          className={cn("absolute inset-0", photoBg ? "opacity-[0.22]" : "opacity-35")}
          style={{
            backgroundImage: photoBg
              ? "linear-gradient(180deg, rgba(8,13,24,0.28) 0%, transparent 48%, rgba(8,13,24,0.78) 100%), radial-gradient(ellipse 90% 55% at 50% 35%, rgba(0,0,0,0.12), transparent 52%)"
              : "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(6,182,212,0.15), transparent), linear-gradient(180deg, rgba(15,23,42,0.95) 0%, transparent 50%)",
          }}
          aria-hidden
        />
        {hasSignal ? (
          <span className="absolute left-2 top-2 z-[3] inline-flex rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-200 ring-1 ring-cyan-400/40 backdrop-blur-sm">
            {signalActiveLabel}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col bg-gradient-to-t from-black via-black/85 to-transparent px-1.5 pb-2 pt-5">
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto">
            {recent.length > 0 ? (
              recent.map((n, i) => (
                <span key={`${tableId}-${n}-${i}`} className={historyCellClass(n, i === 0)}>
                  {n}
                </span>
              ))
            ) : (
              <span className="text-[9px] font-medium text-slate-500">{noSpinsLabel}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-start justify-between gap-2 border-t border-border-color/80 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-bold text-white">{title}</h2>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{tableLabel}</p>
        </div>
      </div>
    </article>
  );

  if (external) {
    return (
      <a href={href} className={cardClass} target="_blank" rel="noopener noreferrer">
        {cardBody}
      </a>
    );
  }
  return (
    <Link to="/casino-mesa" search={{ mesa: tableId }} className={cardClass}>
      {cardBody}
    </Link>
  );
}

function readHistoriesForTables(tableIds: readonly number[]): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const id of tableIds) out[id] = readLiveTableHistory(id);
  return out;
}

export function useLobbyLiveHistories(tableIds: readonly number[]): Record<number, number[]> {
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
    window.addEventListener(ROULETTE_HISTORY_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
      window.removeEventListener(ROULETTE_HISTORY_CHANGED_EVENT, sync);
    };
  }, [idsKey, tableIds]);

  return histories;
}

export function useBackOfficeCasinoLiveData() {
  const [lobbyCardTableIds, setLobbyCardTableIds] = useState<readonly number[]>(() =>
    resolveLobbyCardTableIds(getLiveRouletteTableIds()),
  );

  useEffect(() => {
    const sync = () => setLobbyCardTableIds(resolveLobbyCardTableIds(getLiveRouletteTableIds()));
    sync();
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
  }, []);

  const primaryId = getPrimaryLiveTableId() ?? lobbyCardTableIds[0] ?? ROULETTE_MACAO_TABLE_ID;
  const histories = useLobbyLiveHistories(lobbyCardTableIds);

  const rotatingRoomTableIds = useMemo(() => {
    const resolved = resolveRotatingRoomTableIds(getLiveRouletteTableIds());
    return resolved.length > 0 ? resolved : [...ROTATING_ROOM_FIXED_TABLE_IDS];
  }, [lobbyCardTableIds]);

  const rotatingRoomHistories = useRotatingRoomHistories(rotatingRoomTableIds);
  const rotatingRoomSession = useAutomationAlignedRotativaSession(
    rotatingRoomTableIds,
    rotatingRoomHistories,
    { observeOnly: true },
  );
  const crossingSession = useAutomationAlignedCrossingSession(
    rotatingRoomTableIds,
    rotatingRoomHistories,
    { observeOnly: true },
  );

  return { lobbyCardTableIds, histories, primaryId, rotatingRoomSession, crossingSession };
}

type CasinoModuleId = Extract<BackOfficeModuleId, "casino-ao-vivo">;

function CassinoAoVivoRoletasGrid() {
  const { t } = useI18n();
  useDgaTableImages();
  const sseStatus = useLiveSseStatus();
  const { lobbyCardTableIds, histories, primaryId, rotatingRoomSession, crossingSession } =
    useBackOfficeCasinoLiveData();
  const macaoTid = lobbyCardTableIds[LOBBY_MACAO_SLOT_INDEX] ?? ROULETTE_MACAO_TABLE_ID;

  const sortedTableIds = useMemo(() => {
    return [...lobbyCardTableIds].sort((a, b) => {
      const signal = (tid: number) =>
        tableHasLocalUmFatorSignal(tid, histories[tid] ?? []) ? 1 : 0;
      const diff = signal(b) - signal(a);
      if (diff !== 0) return diff;
      if (a === primaryId) return -1;
      if (b === primaryId) return 1;
      return a - b;
    });
  }, [lobbyCardTableIds, histories, primaryId]);

  return (
    <div className="space-y-6">
      <RotatingRoomExtensionStatus />
      {sseStatus.status === "error" ? (
        <p className="text-sm text-amber-300">{t("casino.sseProxyError")}</p>
      ) : null}
      <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-0 flex-col gap-2 sm:col-span-1">
          <div className="min-h-0 flex-1">
            <RotatingRoomLobbyCard
              session={rotatingRoomSession}
              salaRoute={AUTOMATION_SALA_ROUTE}
              salaLabel={t("casino.roomLabel")}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2 sm:col-span-1">
          <div className="min-h-0 flex-1">
            <RotatingRoomLobbyCard
              session={crossingSession}
              salaRoute={AUTOMATION_SALA_2F_ROUTE}
              salaLabel={t("casino.room2FatoresLabel")}
              strategyBadge="2 Fatores"
            />
          </div>
        </div>
        {sortedTableIds.map((tid) => {
          const hist = histories[tid] ?? [];
          const recent = hist.slice(0, 6);
          const mesaHref = automationWorkspaceHref(`/casino-mesa?mesa=${tid}`);
          return (
            <CasinoTableCard
              key={tid}
              tableId={tid}
              macaoTableId={macaoTid}
              title={lobbyTableDisplayName(tid, macaoTid)}
              tableLabel={t("casino.tableLabel", { id: tid })}
              recent={recent}
              noSpinsLabel={t("casino.noSpins")}
              signalActiveLabel={t("casino.signalActive")}
              isPrimary={tid === primaryId}
              href={mesaHref}
              external={isExternalHref(mesaHref)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function BackOfficeCasinoContent({ moduleId: _moduleId }: { moduleId: CasinoModuleId }) {
  return <CassinoAoVivoRoletasGrid />;
}
