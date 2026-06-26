import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { RotatingRoomExtensionStatus } from "@/components/rotating-room-extension-status";
import { LobbyLiveRouletteColdBlock } from "@/components/lobby-live-table-cold-stats";
import { RotatingRoomLobbyCard } from "@/components/rotating-room-panel";
import { lobbyTableHasRotatingRoomSignal } from "@/lib/roulette/rotatingRoomLobbySignal";
import { useRotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
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
import { readRotatingRoomUmFatorSessionStats } from "@/lib/roulette/rotatingRoomUmFatorSession";
import {
  ROTATING_ROOM_UM_FATOR_CHANGED_EVENT,
  ROTATING_ROOM_UM_FATOR_RESET_EVENT,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import { UM_FATOR_RESET_EVENT } from "@/lib/roulette/umFatorCrossingStrategy";
import { cn } from "@/lib/utils";

import { Dga24dSpinLobbyCard } from "@/components/dga-24d-spin-lobby-card";
import {
  FootballBlitzTopCardLobbyCard,
  SuperTrunfoLobbyCard,
} from "@/components/football-blitz-lobby-card";
import { RouletteSimulatorPanel } from "@/components/roulette-simulator-panel";
import type { BackOfficeModuleId } from "@/lib/back-office/navigation";

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
  const rotatingRoomSession = useRotatingRoomUmFatorSession(rotatingRoomTableIds, rotatingRoomHistories, {
    observeOnly: true,
  });

  return { lobbyCardTableIds, histories, primaryId, rotatingRoomSession };
}

type StatisticsPanelProps = {
  tableIds: readonly number[];
  histories: Record<number, number[]>;
  rotatingRoomSession?: RotatingRoomUmFatorSession | null;
};

export function LobbyCasinoLiveStatisticsPanel({
  tableIds,
  histories,
  rotatingRoomSession,
}: StatisticsPanelProps) {
  const [selectedTid, setSelectedTid] = useState<number>(() => tableIds[0] ?? 0);
  const [placarRevision, setPlacarRevision] = useState(0);

  useEffect(() => {
    const bump = () => setPlacarRevision((v) => v + 1);
    window.addEventListener(UM_FATOR_RESET_EVENT, bump);
    window.addEventListener(ROTATING_ROOM_UM_FATOR_RESET_EVENT, bump);
    window.addEventListener(ROTATING_ROOM_UM_FATOR_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(UM_FATOR_RESET_EVENT, bump);
      window.removeEventListener(ROTATING_ROOM_UM_FATOR_RESET_EVENT, bump);
      window.removeEventListener(ROTATING_ROOM_UM_FATOR_CHANGED_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    if (tableIds.length === 0) return;
    if (!tableIds.includes(selectedTid)) setSelectedTid(tableIds[0]!);
  }, [tableIds, selectedTid]);

  const rows = useMemo(() => {
    return tableIds.map((tid) => {
      const h = histories[tid] ?? [];
      const stats = readRotatingRoomUmFatorSessionStats();
      const w = stats.wins;
      const l = stats.losses;
      const decided = w + l;
      const pct = rotatingRoomSessionAproveitamentoPct(stats);
      const isFocus =
        rotatingRoomSession != null &&
        lobbyTableHasRotatingRoomSignal(tid, "um1fator", rotatingRoomSession);
      return {
        tid,
        name: lobbyTableDisplayName(tid),
        spinCount: h.length,
        placarW: w,
        placarL: l,
        placarD: 0,
        decided,
        pct,
        vitSeguidas: 0,
        isLeader: isFocus,
      };
    });
  }, [tableIds, histories, placarRevision, rotatingRoomSession]);

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/35 p-4 shadow-inner sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Resumo ao vivo (1 Fator)
      </p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 sm:px-4">Mesa</th>
              <th className="px-3 py-2.5 sm:px-4">ID</th>
              <th className="px-3 py-2.5 text-right sm:px-4">Giros</th>
              <th className="px-3 py-2.5 text-right sm:px-4">W / L / D</th>
              <th className="px-3 py-2.5 text-right sm:px-4">Aproveit.</th>
              <th className="px-3 py-2.5 text-right sm:px-4">Vit. seg.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.tid}
                className={cn(
                  "border-b border-slate-800/60 last:border-0",
                  r.isLeader ? "bg-emerald-950/35" : "hover:bg-slate-800/30",
                )}
              >
                <td className="px-3 py-2.5 font-medium text-slate-100 sm:px-4">{r.name}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-500 sm:px-4">{r.tid}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300 sm:px-4">{r.spinCount}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300 sm:px-4">
                  <span className="text-emerald-400/95">{r.placarW}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-rose-400/90">{r.placarL}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-amber-300/85">{r.placarD}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-cyan-200 sm:px-4">
                  {r.decided > 0 ? `${r.pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-400 sm:px-4">
                  {r.vitSeguidas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-10">
        <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-slate-400">Estatística detalhada por mesa</p>
          <select
            value={selectedTid}
            onChange={(e) => setSelectedTid(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100"
          >
            {tableIds.map((tid) => (
              <option key={tid} value={tid}>
                {lobbyTableDisplayName(tid)} — {tid}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-5 max-w-3xl">
          <LobbyLiveRouletteColdBlock
            tableId={selectedTid}
            mesaTitle={lobbyTableDisplayName(selectedTid)}
            historyNewestFirst={histories[selectedTid] ?? []}
          />
        </div>
      </div>
    </div>
  );
}

type CasinoModuleId = Extract<
  BackOfficeModuleId,
  "casino-ao-vivo" | "casino-outros-jogos" | "casino-simulador" | "casino-estatisticas"
>;

function CassinoAoVivoRoletasGrid() {
  const { lobbyCardTableIds, histories, primaryId, rotatingRoomSession } = useBackOfficeCasinoLiveData();
  const macaoTid = lobbyCardTableIds[LOBBY_MACAO_SLOT_INDEX] ?? ROULETTE_MACAO_TABLE_ID;

  const sortedTableIds = useMemo(() => {
    return [...lobbyCardTableIds].sort((a, b) => {
      const signal = (tid: number) =>
        rotatingRoomSession &&
        lobbyTableHasRotatingRoomSignal(tid, "um1fator", rotatingRoomSession)
          ? 1
          : 0;
      const diff = signal(b) - signal(a);
      if (diff !== 0) return diff;
      if (a === primaryId) return -1;
      if (b === primaryId) return 1;
      return a - b;
    });
  }, [lobbyCardTableIds, primaryId, rotatingRoomSession]);

  return (
    <div className="space-y-6">
      <RotatingRoomExtensionStatus />
      <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">
            <RotatingRoomLobbyCard
              session={rotatingRoomSession}
              salaRoute="/sala-rotativa-um-fator"
              salaLabel="Sala Rotativa · 1 Fator"
            />
          </div>
        </div>
        {sortedTableIds.map((tid) => {
          const hasSignal =
            rotatingRoomSession != null &&
            lobbyTableHasRotatingRoomSignal(tid, "um1fator", rotatingRoomSession);
          const hist = histories[tid] ?? [];
          const recent = hist.slice(0, 6);
          return (
            <Link
              key={tid}
              to="/casino-mesa"
              search={{ mesa: tid }}
              className={cn(
                "theme-card flex flex-col rounded-2xl p-4 transition hover:border-border-color",
                hasSignal
                  ? "border-warning/55 ring-2 ring-warning/30"
                  : tid === primaryId
                    ? "border-info/40"
                    : "border-border-color",
              )}
            >
              <p className="text-sm font-bold text-white">{lobbyTableDisplayName(tid, macaoTid)}</p>
              <p className="mt-0.5 text-xs text-slate-500">Mesa {tid}</p>
              {hasSignal ? (
                <span className="mt-2 inline-flex w-fit rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
                  Sinal activo
                </span>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1">
                {recent.length > 0 ? (
                  recent.map((n, i) => (
                    <span
                      key={`${tid}-${n}-${i}`}
                      className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-800/90 px-1.5 text-xs font-bold tabular-nums text-slate-200"
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-600">Sem giros</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function BackOfficeCasinoContent({ moduleId }: { moduleId: CasinoModuleId }) {
  const { lobbyCardTableIds, histories, primaryId, rotatingRoomSession } = useBackOfficeCasinoLiveData();

  if (moduleId === "casino-ao-vivo") {
    return <CassinoAoVivoRoletasGrid />;
  }

  if (moduleId === "casino-outros-jogos") {
    return (
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 px-1 sm:gap-3 lg:grid-cols-3">
        <Dga24dSpinLobbyCard />
        <SuperTrunfoLobbyCard />
        <FootballBlitzTopCardLobbyCard />
      </div>
    );
  }

  if (moduleId === "casino-simulador") {
    return (
      <RouletteSimulatorPanel
        tableIds={lobbyCardTableIds}
        histories={histories}
        defaultTableId={primaryId}
      />
    );
  }

  return (
    <LobbyCasinoLiveStatisticsPanel
      tableIds={lobbyCardTableIds}
      histories={histories}
      rotatingRoomSession={rotatingRoomSession}
    />
  );
}
