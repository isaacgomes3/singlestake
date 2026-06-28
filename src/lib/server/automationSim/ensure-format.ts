import {
  AUTOMATION_EXTRACT_FORMAT_VERSION,
} from "@/lib/back-office/rouletteAutomationSim";
import { resetGlobalAutomationCycle } from "@/lib/server/automationSim/reset-cycle";
import { resetAutomationSimEngineFlags } from "@/lib/server/automationSim/engine";
import { getAutomationSimState, initAutomationSimState } from "@/lib/server/automationSim/persistence";
import { parseRouletteTableIdsFromEnv } from "@/lib/server/rouletteSocket";

let formatCheckPromise: Promise<boolean> | null = null;

/** Repõe extrato + banca quando a versão em disco está desactualizada (uma vez por arranque). */
export async function ensureAutomationExtractUpToDate(): Promise<boolean> {
  if (formatCheckPromise) return formatCheckPromise;

  formatCheckPromise = (async () => {
    await initAutomationSimState();
    const sim = getAutomationSimState();
    if ((sim.extractFormatVersion ?? 0) >= AUTOMATION_EXTRACT_FORMAT_VERSION) {
      return false;
    }

    const tableIds = parseRouletteTableIdsFromEnv();
    if (tableIds.length === 0) {
      console.warn("[Automation] extractFormatVersion em falta — ROULETTE_TABLE_IDS não definido");
      return false;
    }

    const { ensureStrategyGlobalEngine } = await import("@/lib/server/strategyGlobal/engine");
    await ensureStrategyGlobalEngine(tableIds);
    await resetGlobalAutomationCycle({ liveTableIds: tableIds, broadcast: true });
    resetAutomationSimEngineFlags();
    console.info(
      `[Automation] extrato reposto — formato v${AUTOMATION_EXTRACT_FORMAT_VERSION}, saldo R$ 50.000, histórico limpo`,
    );
    return true;
  })().catch((err) => {
    formatCheckPromise = null;
    console.error("[Automation] falha ao repor extrato:", err);
    throw err;
  });

  return formatCheckPromise;
}
