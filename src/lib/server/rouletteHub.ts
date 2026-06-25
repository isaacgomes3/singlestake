import { setDgaTableMeta } from "@/lib/server/dgaTableMetaCache";
import {
  parseRouletteTableIdsFromEnv,
  startRouletteSocket,
  type RouletteSpin,
} from "./rouletteSocket";

export type RouletteHubMessage =
  | {
      type: "spin";
      spin: RouletteSpin;
      /** Só na subscrição inicial — não é giro novo. */
      replay?: boolean;
    }
  | { type: "spin-replay-batch"; spins: RouletteSpin[] }
  | { type: "status"; state: "reconnecting"; message: string };

type Listener = (msg: RouletteHubMessage) => void;

const listeners = new Set<Listener>();
/** Uma ligação WS por mesa (`ROULETTE_TABLE_IDS`). */
let upstreamDisposers: Array<() => void> = [];
/**
 * ms após o último cliente SSE sair antes de fechar o WS Pragmatic (evita churn em dev/HMR).
 * Valor negativo = nunca fechar por idle (útil se a API “parar” ao ficar sem clientes SSE).
 * 0 = fechar logo que o último cliente sair.
 */
const UPSTREAM_IDLE_MS = Number.isFinite(Number(process.env.ROULETTE_HUB_IDLE_SHUTDOWN_MS))
  ? Number(process.env.ROULETTE_HUB_IDLE_SHUTDOWN_MS)
  : 20_000;
let upstreamShutdownTimer: ReturnType<typeof setTimeout> | null = null;
/** Último giro emitido por mesa (para replay ao subscrever SSE). */
const lastEmittedByTable = new Map<number, RouletteSpin>();
/** Último snapshot `last20Results` por mesa (gameId já com prefixo `mesa::`). */
const tableHistorySnapshotById = new Map<number, RouletteSpin[]>();

let strategyGlobalBoot: Promise<void> | null = null;

function bootStrategyGlobal(): Promise<void> {
  if (!strategyGlobalBoot) {
    const tableIds = parseRouletteTableIdsFromEnv();
    strategyGlobalBoot = import("@/lib/server/strategyGlobal/engine")
      .then((m) => m.ensureStrategyGlobalEngine(tableIds))
      .catch((err) => {
        console.error("[StrategyGlobal] falha ao iniciar:", err);
        strategyGlobalBoot = null;
      })
      .then(() => undefined);
  }
  return strategyGlobalBoot ?? Promise.resolve();
}

function onStrategyGlobalSpin(spin: RouletteSpin): void {
  void bootStrategyGlobal().then(() =>
    import("@/lib/server/strategyGlobal/engine").then((m) => {
      m.ingestStrategyGlobalSpin(spin, parseRouletteTableIdsFromEnv());
    }),
  );
}

function onStrategyGlobalTableSnapshot(tableId: number, spins: RouletteSpin[]): void {
  void bootStrategyGlobal().then(() =>
    import("@/lib/server/strategyGlobal/engine").then((m) => {
      m.ingestStrategyGlobalHistorySnapshot(tableId, spins, parseRouletteTableIdsFromEnv());
    }),
  );
}

function cancelUpstreamShutdownTimer() {
  if (upstreamShutdownTimer) {
    clearTimeout(upstreamShutdownTimer);
    upstreamShutdownTimer = null;
  }
}

function broadcast(msg: RouletteHubMessage) {
  for (const listener of listeners) {
    listener(msg);
  }
}

function buildReplayBatch(): RouletteSpin[] {
  const tableIds = parseRouletteTableIdsFromEnv();
  const spins: RouletteSpin[] = [];
  for (const tid of tableIds) {
    const snap = tableHistorySnapshotById.get(tid);
    if (snap && snap.length > 0) {
      spins.push(...snap);
    } else {
      const sp = lastEmittedByTable.get(tid);
      if (sp) spins.push(sp);
    }
  }
  return spins;
}

function ensureUpstream() {
  cancelUpstreamShutdownTimer();
  if (upstreamDisposers.length > 0) return;

  const tableIds = parseRouletteTableIdsFromEnv();
  console.log(
    "[Roleta] hub: a iniciar WebSocket upstream —",
    tableIds.length,
    "mesa(s):",
    tableIds.join(", "),
  );

  const disposers: Array<() => void> = [];
  for (const tableId of tableIds) {
    const dispose = startRouletteSocket(
      (spin) => {
        const scoped: RouletteSpin = {
          number: spin.number,
          gameId: `${tableId}::${spin.gameId}`,
        };
        lastEmittedByTable.set(tableId, scoped);
        onStrategyGlobalSpin(scoped);
        broadcast({ type: "spin", spin: scoped });
      },
      {
        tableId,
        onTableHistorySnapshot: (spins) => {
          if (spins.length === 0) return;
          const scoped = spins.map((s) => ({
            number: s.number,
            gameId: `${tableId}::${s.gameId}`,
          }));
          tableHistorySnapshotById.set(tableId, scoped);
          lastEmittedByTable.set(tableId, scoped[0]!);
          onStrategyGlobalTableSnapshot(tableId, scoped);
        },
        onTableMeta: (meta) => {
          setDgaTableMeta(tableId, meta);
        },
        onDisconnect: (message) => {
          broadcast({ type: "status", state: "reconnecting", message });
        },
        debug: process.env.DEBUG_ROULETTE_WS === "1",
      },
    );
    disposers.push(dispose);
  }
  upstreamDisposers = disposers;
}

function shutdownUpstreamIfIdle() {
  if (listeners.size > 0) return;
  cancelUpstreamShutdownTimer();
  if (UPSTREAM_IDLE_MS < 0) {
    return;
  }
  if (UPSTREAM_IDLE_MS === 0) {
    for (const d of upstreamDisposers) d();
    upstreamDisposers = [];
    lastEmittedByTable.clear();
    tableHistorySnapshotById.clear();
    return;
  }
  upstreamShutdownTimer = setTimeout(() => {
    upstreamShutdownTimer = null;
    if (listeners.size > 0) return;
    console.log(
      "[Roleta] hub: nenhum cliente SSE há",
      UPSTREAM_IDLE_MS / 1000,
      "s — a fechar WebSocket Pragmatic",
    );
    for (const d of upstreamDisposers) d();
    upstreamDisposers = [];
    lastEmittedByTable.clear();
    tableHistorySnapshotById.clear();
  }, UPSTREAM_IDLE_MS);
}

/**
 * Um WebSocket upstream por mesa; todos os clientes SSE recebem os mesmos eventos agregados.
 */
export function subscribeRouletteHub(listener: Listener): () => void {
  listeners.add(listener);
  const batch = buildReplayBatch();
  if (batch.length > 0) {
    listener({ type: "spin-replay-batch", spins: batch });
  }
  ensureUpstream();
  void bootStrategyGlobal();
  return () => {
    listeners.delete(listener);
    shutdownUpstreamIfIdle();
  };
}
