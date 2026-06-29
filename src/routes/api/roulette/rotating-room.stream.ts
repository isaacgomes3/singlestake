import { createFileRoute } from "@tanstack/react-router";

import { buildRotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorIndication";

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

export const Route = createFileRoute("/api/roulette/rotating-room/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { ensureAutomationSimEngine } = await import("@/lib/server/automationSim/engine");
        const { getAutomationConfig } = await import("@/lib/server/automationSim/config");
        const { getAutomationSimState } = await import("@/lib/server/automationSim/persistence");
        const { subscribeStrategyGlobalHub } = await import("@/lib/server/strategyGlobal/broadcast");
        const { subscribeRouletteHub } = await import("@/lib/server/rouletteHub");
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        await ensureAutomationSimEngine();
        const crossingEnabled = getAutomationConfig().enabledTriggers.crossing !== false;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const snapshot = getStrategyGlobalSnapshotOrThrow();
            const balance = getAutomationSimState().balance;
            controller.enqueue(
              sseData({
                type: "sync",
                indication: buildRotatingRoomSimulatorIndication(snapshot, balance, {
                  crossingEnabled,
                }),
              }),
            );

            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubscribeGlobal = subscribeStrategyGlobalHub((msg) => {
              if (msg.type === "sync" || msg.type === "update") {
                const automationBalance = getAutomationSimState().balance;
                controller.enqueue(
                  sseData({
                    type: "update",
                    revision: msg.snapshot.revision,
                    indication: buildRotatingRoomSimulatorIndication(msg.snapshot, automationBalance, {
                      crossingEnabled,
                    }),
                  }),
                );
              }
            });
            const unsubscribeRoulette = subscribeRouletteHub(() => {
              /* mantém giros ao vivo para indicações da sala rotativa */
            });

            const onAbort = () => {
              clearInterval(keepaliveTimer);
              unsubscribeGlobal();
              unsubscribeRoulette();
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
