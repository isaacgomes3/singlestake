/**
 * Processa rendimento diário de automação (cron externo / Task Scheduler).
 * Uso: npm run cron:daily-yield
 */
import "dotenv/config";

import { closeDb } from "../src/lib/server/db/client";
import { runAutomationYieldIfDue } from "../src/lib/server/finance/automation-scheduler";
import { getAutomationYieldTimezone, getClockInTimezone } from "../src/lib/server/finance/automation-scheduler-state";

async function main() {
  const force = process.argv.includes("--force");
  const tz = getAutomationYieldTimezone();
  const ymd = getClockInTimezone(tz).ymd;

  const outcome = await runAutomationYieldIfDue({ force, ymd });
  if (!outcome.ran) {
    console.log("Ignorado:", outcome.reason);
    return;
  }

  const r = outcome.result;
  console.log(
    `Concluído: ${r.yieldPct}% · creditado R$ ${r.credited.toFixed(2)} · perdido R$ ${r.missed.toFixed(2)}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
