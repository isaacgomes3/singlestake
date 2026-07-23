import { hydrateFootballStudioHub } from "./hub";
import { startFootballStudioBridgePoller } from "./bridgePoller";
import { startFootballStudioDinhutechPoller } from "./dinhutechPoller";

let bootPromise: Promise<void> | null = null;

/** Bridge ON por defeito (verdade Evolution). FOOTBALL_STUDIO_BRIDGE=0 desliga. */
function bridgeEnabled(): boolean {
  return String(process.env.FOOTBALL_STUDIO_BRIDGE ?? "1").trim() !== "0";
}

function startDaemon(): Promise<void> {
  return (async () => {
    await hydrateFootballStudioHub();
    // Cartas/naipes (enriquecimento) — não é a timeline oficial.
    startFootballStudioDinhutechPoller();
    if (bridgeEnabled()) {
      startFootballStudioBridgePoller();
      console.log(
        "[Football Studio] daemon: Bridge ON (verdade) · DinhuTech só cartas",
      );
    } else {
      console.log(
        "[Football Studio] daemon: Bridge OFF · só cartas DinhuTech (fallback).",
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
