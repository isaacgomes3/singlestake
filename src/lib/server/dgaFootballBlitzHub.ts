import { DGA_FOOTBALL_BLITZ_TABLE_KEYS } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import { DGA_FOOTBALL_BLITZ_SERVER_ROUNDS } from "@/lib/pragmatic/dgaFootballBlitzHistory";
import {
  startDgaFootballBlitzSocket,
  type DgaFootballBlitzRound,
} from "./dgaFootballBlitzSocket";

export type DgaFootballBlitzHubRound = DgaFootballBlitzRound & { tableKey: number };

export type DgaFootballBlitzHubMessage =
  | { type: "round"; tableKey: number; round: DgaFootballBlitzRound; replay?: boolean }
  | { type: "round-replay-batch"; tableKey: number; rounds: DgaFootballBlitzRound[] }
  | { type: "status"; state: "reconnecting"; message: string };

type Listener = (msg: DgaFootballBlitzHubMessage) => void;

const listeners = new Set<Listener>();
let upstreamDisposers: Array<() => void> = [];

const UPSTREAM_IDLE_MS = Number.isFinite(Number(process.env.ROULETTE_HUB_IDLE_SHUTDOWN_MS))
  ? Number(process.env.ROULETTE_HUB_IDLE_SHUTDOWN_MS)
  : 20_000;
let upstreamShutdownTimer: ReturnType<typeof setTimeout> | null = null;

const lastSnapshotByTable = new Map<number, DgaFootballBlitzRound[]>();
const lastEmittedByTable = new Map<number, DgaFootballBlitzRound>();

function cancelUpstreamShutdownTimer() {
  if (upstreamShutdownTimer) {
    clearTimeout(upstreamShutdownTimer);
    upstreamShutdownTimer = null;
  }
}

function broadcast(msg: DgaFootballBlitzHubMessage) {
  for (const listener of listeners) {
    listener(msg);
  }
}

function buildReplayMessages(): DgaFootballBlitzHubMessage[] {
  const out: DgaFootballBlitzHubMessage[] = [];
  for (const tableKey of DGA_FOOTBALL_BLITZ_TABLE_KEYS) {
    const snap = lastSnapshotByTable.get(tableKey);
    if (snap && snap.length > 0) {
      out.push({ type: "round-replay-batch", tableKey, rounds: [...snap] });
      continue;
    }
    const last = lastEmittedByTable.get(tableKey);
    if (last) {
      out.push({ type: "round-replay-batch", tableKey, rounds: [last] });
    }
  }
  return out;
}

function ensureUpstream() {
  cancelUpstreamShutdownTimer();
  if (upstreamDisposers.length > 0) return;

  console.log(
    "[Football Blitz] hub: upstream WS | mesas:",
    DGA_FOOTBALL_BLITZ_TABLE_KEYS.join(", "),
  );

  const disposers: Array<() => void> = [];
  for (const tableKey of DGA_FOOTBALL_BLITZ_TABLE_KEYS) {
    const dispose = startDgaFootballBlitzSocket(
      (round) => {
        lastEmittedByTable.set(tableKey, round);
        const without = (lastSnapshotByTable.get(tableKey) ?? []).filter(
          (r) => r.gameId !== round.gameId,
        );
        lastSnapshotByTable.set(tableKey, [round, ...without].slice(0, DGA_FOOTBALL_BLITZ_SERVER_ROUNDS));
        broadcast({ type: "round", tableKey, round });
      },
      {
        tableKey,
        onTableHistorySnapshot: (rounds) => {
          if (rounds.length === 0) return;
          const snap = rounds.slice(0, DGA_FOOTBALL_BLITZ_SERVER_ROUNDS);
          lastSnapshotByTable.set(tableKey, snap);
          lastEmittedByTable.set(tableKey, snap[0]!);
          broadcast({ type: "round-replay-batch", tableKey, rounds: [...snap] });
        },
        onDisconnect: (message) => {
          broadcast({ type: "status", state: "reconnecting", message });
        },
        debug: process.env.DEBUG_DGA_FOOTBALL_BLITZ_WS === "1",
      },
    );
    disposers.push(dispose);
  }
  upstreamDisposers = disposers;
}

function shutdownUpstreamIfIdle() {
  if (listeners.size > 0) return;
  cancelUpstreamShutdownTimer();
  if (UPSTREAM_IDLE_MS < 0) return;
  if (UPSTREAM_IDLE_MS === 0) {
    for (const d of upstreamDisposers) d();
    upstreamDisposers = [];
    lastSnapshotByTable.clear();
    lastEmittedByTable.clear();
    return;
  }
  upstreamShutdownTimer = setTimeout(() => {
    upstreamShutdownTimer = null;
    if (listeners.size > 0) return;
    console.log("[Football Blitz] hub: idle — fechar upstream");
    for (const d of upstreamDisposers) d();
    upstreamDisposers = [];
    lastSnapshotByTable.clear();
    lastEmittedByTable.clear();
  }, UPSTREAM_IDLE_MS);
}

export function subscribeDgaFootballBlitzHub(listener: Listener): () => void {
  listeners.add(listener);
  for (const msg of buildReplayMessages()) {
    listener(msg);
  }
  ensureUpstream();
  return () => {
    listeners.delete(listener);
    shutdownUpstreamIfIdle();
  };
}
