import { createFileRoute } from "@tanstack/react-router";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const SSE_KEEPALIVE_MS = 25_000;
const sseKeepalive = new TextEncoder().encode(": keepalive\n\n");

function sseData(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const Route = createFileRoute("/api/roulette/automation-sim/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { ensureAutomationSimEngine, getAutomationSimSnapshotOrThrow } = await import(
          "@/lib/server/automationSim/engine"
        );
        const { subscribeAutomationSimHub } = await import("@/lib/server/automationSim/broadcast");

        ensureRouletteHubDaemon();
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        await ensureAutomationSimEngine();

        const initialStrategy = getStrategyGlobalSnapshotOrThrow();
        const initialSnapshot = await getAutomationSimSnapshotOrThrow(initialStrategy);

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              sseData({
                type: "sync",
                snapshot: initialSnapshot,
              }),
            );

            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubAutomation = subscribeAutomationSimHub((snapshot) => {
              controller.enqueue(sseData({ type: "update", snapshot }));
            });

            const onAbort = () => {
              clearInterval(keepaliveTimer);
              unsubAutomation();
              try {
                controller.close();
              } catch {
                /* já fechado */
              }
            };

            request.signal.addEventListener("abort", onAbort, { once: true });
            if (request.signal.aborted) onAbort();
          },
        });

        return new Response(stream, { headers: { ...SSE_HEADERS } });
      },
    },
  },
});
