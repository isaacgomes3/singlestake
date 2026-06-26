/**
 * Mantém o WebSocket Pragmatic e o motor global activos sem depender de clientes SSE no browser.
 */
let bootPromise: Promise<void> | null = null;

function startDaemon(): Promise<void> {
  return (async () => {
    await import("@/lib/server/ensureNodeWebSocket");
    const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
    const { subscribeRouletteHub, waitForRouletteHubData } = await import(
      "@/lib/server/rouletteHub"
    );
    const { ensureStrategyGlobalEngine } = await import("@/lib/server/strategyGlobal/engine");
    const { ensureAutomationSimEngine } = await import("@/lib/server/automationSim/engine");

    const tableIds = parseRouletteTableIdsFromEnv();
    await ensureStrategyGlobalEngine(tableIds);
    await ensureAutomationSimEngine();

    subscribeRouletteHub(() => {
      /* noop — mantém upstream vivo */
    });

    console.log("[Roleta] daemon: hub ao vivo sempre activo para", tableIds.length, "mesa(s)");
    await waitForRouletteHubData(12_000);
  })();
}

export function ensureRouletteHubDaemon(): void {
  if (bootPromise) return;
  bootPromise = startDaemon().catch((err) => {
    bootPromise = null;
    console.error("[Roleta] daemon: falha ao iniciar:", err);
    throw err;
  });
}

/** Aguarda o hub Pragmatic (útil em APIs que respondem antes do WS ligar). */
export async function waitForRouletteHubDaemon(timeoutMs = 12_000): Promise<void> {
  ensureRouletteHubDaemon();
  if (!bootPromise) return;
  await Promise.race([
    bootPromise,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
