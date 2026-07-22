import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FootballBlitzTopCardLobbyCard } from "@/components/football-blitz-lobby-card";
import { FootballStudioLobbyCard } from "@/components/football-studio-lobby-card";
import { useDgaTableImages } from "@/hooks/useDgaTableImages";
import { useIce2fSession } from "@/hooks/useIce2fSession";
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
  ROULETTE_MACAO_TABLE_ID,
} from "@/lib/roulette/lobbyTables";
import {
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  ROULETTE_HISTORY_CHANGED_EVENT,
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { tableHasLocalIce2fSignal } from "@/lib/roulette/ice2fTableSession";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/i18n-provider";

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

function CasinoTableCard({
  tableId,
  macaoTableId,
  title,
  tableLabel,
  recent,
  fullHistory,
  noSpinsLabel,
  signalActiveLabel,
  openLabel,
  isPrimary,
  sseOnline,
}: {
  tableId: number;
  macaoTableId: number;
  title: string;
  tableLabel: string;
  recent: number[];
  fullHistory: number[];
  noSpinsLabel: string;
  signalActiveLabel: string;
  openLabel: string;
  isPrimary: boolean;
  sseOnline: boolean;
}) {
  const session = useIce2fSession(tableId, fullHistory, { observeOnly: true });
  const hasSignal = session.showTapeteSignal;
  const photoBg = lobbyTableCardPhotoUrl(tableId, macaoTableId);
  const photoStyle = lobbyTableCardPhotoStyle(tableId, macaoTableId);
  const cardClass = cn(
    "theme-lobby-card flex flex-col p-0 transition",
    hasSignal && "ring-2 ring-[var(--brand-orange,#ff6b00)]/40",
    isPrimary && !hasSignal && "border-[var(--brand-orange,#ff6b00)]/35",
  );
  const cardBody = (
    <article className="flex h-full flex-col">
      <div
        className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-b from-neutral-800 to-black"
        style={photoBg ? undefined : { background: lobbyTableCardFallbackBg() }}
      >
        {photoStyle ? (
          <div className="absolute inset-0 bg-cover bg-no-repeat" style={photoStyle} aria-hidden />
        ) : null}
        <div
          className={cn("absolute inset-0", photoBg ? "opacity-[0.28]" : "opacity-40")}
          style={{
            backgroundImage: photoBg
              ? "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 48%, rgba(0,0,0,0.85) 100%)"
              : "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,107,0,0.12), transparent), linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 50%)",
          }}
          aria-hidden
        />
        <div className="absolute left-2 top-2 z-[3] flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm",
              sseOnline
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
                : "bg-neutral-800/80 text-neutral-400 ring-1 ring-neutral-600/50",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                sseOnline ? "bg-emerald-400" : "bg-neutral-500",
              )}
            />
            {sseOnline ? "Online" : "Offline"}
          </span>
          {hasSignal ? (
            <span className="inline-flex rounded-full bg-[var(--brand-orange,#ff6b00)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-200 ring-1 ring-orange-400/40 backdrop-blur-sm">
              {signalActiveLabel}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col bg-gradient-to-t from-black via-black/85 to-transparent px-1.5 pb-2 pt-5">
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto">
            {recent.length > 0 ? (
              recent.map((n, i) => (
                <span key={`${tableId}-${n}-${i}`} className={historyCellClass(n, i === 0)}>
                  {n}
                </span>
              ))
            ) : (
              <span className="text-[9px] font-medium text-neutral-500">{noSpinsLabel}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-800 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-white">{title}</h2>
          <p className="mt-0.5 truncate text-[10px] text-neutral-500">{tableLabel}</p>
        </div>
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-950/80 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-200 transition group-hover:border-[var(--brand-orange,#ff6b00)]/50 group-hover:text-white">
          {openLabel}
        </span>
      </div>
    </article>
  );

  return (
    <Link to="/casino-mesa" search={{ mesa: tableId }} className={cn(cardClass, "group")}>
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

  return { lobbyCardTableIds, histories, primaryId };
}

function CassinoAoVivoRoletasGrid({ searchQuery = "" }: { searchQuery?: string }) {
  const { t } = useI18n();
  useDgaTableImages();
  const sseStatus = useLiveSseStatus();
  const { lobbyCardTableIds, histories, primaryId } = useBackOfficeCasinoLiveData();
  const macaoTid = lobbyCardTableIds[LOBBY_MACAO_SLOT_INDEX] ?? ROULETTE_MACAO_TABLE_ID;
  const q = searchQuery.trim().toLowerCase();

  const sortedTableIds = useMemo(() => {
    return [...lobbyCardTableIds].sort((a, b) => {
      const signal = (tid: number) => (tableHasLocalIce2fSignal(tid, histories[tid] ?? []) ? 1 : 0);
      const diff = signal(b) - signal(a);
      if (diff !== 0) return diff;
      if (a === primaryId) return -1;
      if (b === primaryId) return 1;
      return a - b;
    });
  }, [lobbyCardTableIds, histories, primaryId]);

  const filteredTableIds = useMemo(() => {
    if (!q) return sortedTableIds;
    return sortedTableIds.filter((tid) => {
      const name = lobbyTableDisplayName(tid, macaoTid).toLowerCase();
      return name.includes(q) || String(tid).includes(q);
    });
  }, [sortedTableIds, q, macaoTid]);

  const showBlitz =
    !q ||
    "football blitz".includes(q) ||
    "top card".includes(q) ||
    "blitz".includes(q);
  const showStudio =
    !q ||
    "football studio".includes(q) ||
    "studio".includes(q) ||
    "futebol".includes(q);

  return (
    <div className="space-y-4">
      {sseStatus.status === "error" ? (
        <p className="text-sm text-amber-300">{t("casino.sseProxyError")}</p>
      ) : null}
      <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {filteredTableIds.map((tid) => {
          const hist = histories[tid] ?? [];
          const recent = hist.slice(0, 6);
          return (
            <CasinoTableCard
              key={tid}
              tableId={tid}
              macaoTableId={macaoTid}
              title={lobbyTableDisplayName(tid, macaoTid)}
              tableLabel={t("casino.tableLabel", { id: tid })}
              recent={recent}
              fullHistory={hist}
              noSpinsLabel={t("casino.noSpins")}
              signalActiveLabel={t("casino.signalActive")}
              openLabel={t("casino.openTable")}
              isPrimary={tid === primaryId}
              sseOnline={sseStatus.status === "open"}
            />
          );
        })}
        {showBlitz ? <FootballBlitzTopCardLobbyCard /> : null}
        {showStudio ? <FootballStudioLobbyCard /> : null}
      </div>
      {filteredTableIds.length === 0 && !showBlitz && !showStudio ? (
        <p className="text-sm text-neutral-500">{t("casino.searchNoResults")}</p>
      ) : null}
    </div>
  );
}

export function BackOfficeCasinoContent({ searchQuery }: { searchQuery?: string }) {
  return <CassinoAoVivoRoletasGrid searchQuery={searchQuery} />;
}
