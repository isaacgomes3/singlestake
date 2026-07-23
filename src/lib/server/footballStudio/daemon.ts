import { hydrateFootballStudioHub } from "./hub";
import { startFootballStudioBridgePoller } from "./bridgePoller";
import { startFootballStudioDinhutechPoller } from "./dinhutechPoller";

let bootPromise: Promise<void> | null = null;

/** Bridge só se FOOTBALL_STUDIO_BRIDGE=1 — por defeito só cartas (DinhuTech/Obs ingest). */
function bridgeEnabled(): boolean {
  return String(process.env.FOOTBALL_STUDIO_BRIDGE ?? "0").trim() === "1";
}

function startDaemon(): Promise<void> {
  return (async () => {
    await hydrateFootballStudioHub();
    // Poller interno: alimenta o hub sem script feeder externo.
    startFootballStudioDinhutechPoller();
    if (bridgeEnabled()) {
      startFootballStudioBridgePoller();
      console.log("[Football Studio] daemon: Bridge ON · cartas via POST ingest");
    } else {
      console.log(
        "[Football Studio] daemon: Bridge OFF · cartas DinhuTech (poller interno + ingest).",
      );
    }
  })();
}

export function ensureFootballStudioDaemon(): void {
  const g = globalThis as typeof globalThis & {
    __singlestakeFsDaemonBoot?: Promise<void> | null;
  };
  if (g.__singlestakeFsDaemonBoot) {
    bootPromise = g.__singlestakeFsDaemonBoot;
    return;
  }
  bootPromise = startDaemon().catch((err) => {
    bootPromise = null;
    g.__singlestakeFsDaemonBoot = null;
    console.error("[Football Studio] daemon: falha ao iniciar:", err);
    setTimeout(() => {
      if (!bootPromise) {
        console.log("[Football Studio] daemon: a tentar novamente…");
        ensureFootballStudioDaemon();
      }
    }, 5_000);
    throw err;
  });
  g.__singlestakeFsDaemonBoot = bootPromise;
}

export async function waitForFootballStudioDaemon(timeoutMs = 15_000): Promise<void> {
  ensureFootballStudioDaemon();
  if (!bootPromise) return;
  await Promise.race([
    bootPromise,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
