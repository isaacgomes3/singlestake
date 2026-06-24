import {
  parseDga24dSpinTableKeyFromEnv,
  startDga24dSpinSocket,
  type Dga24dSpin,
} from "./dga24dSpinSocket";

export type Dga24dSpinHubMessage =
  | { type: "spin"; spin: Dga24dSpin; replay?: boolean }
  | { type: "spin-replay-batch"; spins: Dga24dSpin[] }
  | { type: "status"; state: "reconnecting"; message: string };

type Listener = (msg: Dga24dSpinHubMessage) => void;

const listeners = new Set<Listener>();
let upstreamDispose: (() => void) | null = null;

const UPSTREAM_IDLE_MS = Number.isFinite(Number(process.env.ROULETTE_HUB_IDLE_SHUTDOWN_MS))
  ? Number(process.env.ROULETTE_HUB_IDLE_SHUTDOWN_MS)
  : 20_000;
let upstreamShutdownTimer: ReturnType<typeof setTimeout> | null = null;

let lastSnapshot: Dga24dSpin[] = [];
let lastEmitted: Dga24dSpin | null = null;

function cancelUpstreamShutdownTimer() {
  if (upstreamShutdownTimer) {
    clearTimeout(upstreamShutdownTimer);
    upstreamShutdownTimer = null;
  }
}

function broadcast(msg: Dga24dSpinHubMessage) {
  for (const listener of listeners) {
    listener(msg);
  }
}

function ensureUpstream() {
  cancelUpstreamShutdownTimer();
  if (upstreamDispose) return;

  const tableKey = parseDga24dSpinTableKeyFromEnv();
  console.log("[24D Spin] hub: upstream WS | key:", tableKey);

  upstreamDispose = startDga24dSpinSocket(
    (spin) => {
      lastEmitted = spin;
      const without = lastSnapshot.filter((s) => s.gameId !== spin.gameId);
      lastSnapshot = [spin, ...without].slice(0, 24);
      broadcast({ type: "spin", spin });
    },
    {
      tableKey,
      onTableHistorySnapshot: (spins) => {
        if (spins.length === 0) return;
        lastSnapshot = spins;
        lastEmitted = spins[0]!;
        broadcast({ type: "spin-replay-batch", spins: [...lastSnapshot] });
      },
      onDisconnect: (message) => {
        broadcast({ type: "status", state: "reconnecting", message });
      },
      debug: process.env.DEBUG_DGA_24D_WS === "1",
    },
  );
}

function shutdownUpstreamIfIdle() {
  if (listeners.size > 0) return;
  cancelUpstreamShutdownTimer();
  if (UPSTREAM_IDLE_MS < 0) return;
  if (UPSTREAM_IDLE_MS === 0) {
    upstreamDispose?.();
    upstreamDispose = null;
    lastSnapshot = [];
    lastEmitted = null;
    return;
  }
  upstreamShutdownTimer = setTimeout(() => {
    upstreamShutdownTimer = null;
    if (listeners.size > 0) return;
    console.log("[24D Spin] hub: idle — fechar upstream");
    upstreamDispose?.();
    upstreamDispose = null;
    lastSnapshot = [];
    lastEmitted = null;
  }, UPSTREAM_IDLE_MS);
}

export function subscribeDga24dSpinHub(listener: Listener): () => void {
  listeners.add(listener);
  if (lastSnapshot.length > 0) {
    listener({ type: "spin-replay-batch", spins: [...lastSnapshot] });
  } else if (lastEmitted) {
    listener({ type: "spin-replay-batch", spins: [lastEmitted] });
  }
  ensureUpstream();
  return () => {
    listeners.delete(listener);
    shutdownUpstreamIfIdle();
  };
}
