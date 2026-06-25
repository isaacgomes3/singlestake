/**
 * Mantém o WebSocket Pragmatic e o motor global activos sem depender de clientes SSE no browser.
 */
let started = false;

export function ensureRouletteHubDaemon(): void {
  if (started) return;
  started = true;

  void (async () => {
    const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
    const { subscribeRouletteHub } = await import("@/lib/server/rouletteHub");
    const { ensureStrategyGlobalEngine } = await import("@/lib/server/strategyGlobal/engine");
    const { ensureAutomationSimEngine } = await import("@/lib/server/automationSim/engine");

    const tableIds = parseRouletteTableIdsFromEnv();
    await ensureStrategyGlobalEngine(tableIds);
    await ensureAutomationSimEngine();

    subscribeRouletteHub(() => {
      /* noop — mantém upstream vivo */
    });

    console.log("[Roleta] daemon: hub ao vivo sempre activo para", tableIds.length, "mesa(s)");
  })().catch((err) => {
    started = false;
    console.error("[Roleta] daemon: falha ao iniciar:", err);
  });
}
