import { triggerDailyAutomationYield } from "@/lib/server/finance/automation-yield";
import {
  getAutomationSchedulerIntervalMs,
  getAutomationYieldSchedule,
  getAutomationYieldTimezone,
  getClockInTimezone,
  getLastAutomationYieldYmd,
  isAutomationSchedulerEnabled,
  shouldRunAutomationYieldNow,
} from "@/lib/server/finance/automation-scheduler-state";
import {
  getBinaryResetSchedule,
  getBinaryResetTimezone,
  getLastBinaryResetYmd,
  resetBinaryPointsDaily,
  setLastBinaryResetYmd,
} from "@/lib/server/network/binary-daily-reset";
import { refreshExpiredSubscriptions } from "@/lib/server/finance/subscription-access";

let started = false;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function schedulerTick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await refreshExpiredSubscriptions();

    const tz = getAutomationYieldTimezone();
    const clock = getClockInTimezone(tz);
    const schedule = getAutomationYieldSchedule();

    if (!shouldRunAutomationYieldNow(clock, schedule)) return;

    const last = await getLastAutomationYieldYmd();
    if (last === clock.ymd) return;

    const result = await triggerDailyAutomationYield({ ymd: clock.ymd });
    console.log(
      `[Financeiro] rendimento diário automático (${clock.ymd} ${tz}):`,
      `${result.yieldPct}% · creditado R$ ${result.credited.toFixed(2)} · perdido R$ ${result.missed.toFixed(2)}`,
    );

    const binaryTz = getBinaryResetTimezone();
    const binaryClock = getClockInTimezone(binaryTz);
    const binarySchedule = getBinaryResetSchedule();
    if (shouldRunAutomationYieldNow(binaryClock, binarySchedule)) {
      const lastBinary = await getLastBinaryResetYmd();
      if (lastBinary !== binaryClock.ymd) {
        const reset = await resetBinaryPointsDaily();
        await setLastBinaryResetYmd(binaryClock.ymd);
        console.log(
          `[Financeiro] reset binário (${binaryClock.ymd} ${binaryTz}):`,
          `${reset.usersReset} utilizadores · ${reset.rowsCleared} linhas`,
        );
      }
    }
  } catch (err) {
    console.error("[Financeiro] scheduler rendimento diário:", err);
  } finally {
    running = false;
  }
}

/** Agenda verificação periódica do rendimento diário (uma vez por dia). */
export function ensureAutomationYieldScheduler(): void {
  if (!isAutomationSchedulerEnabled()) return;
  if (started) return;
  started = true;

  const intervalMs = getAutomationSchedulerIntervalMs();
  const schedule = getAutomationYieldSchedule();
  const tz = getAutomationYieldTimezone();

  console.log(
    `[Financeiro] scheduler activo: ${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")} (${tz}), verificação a cada ${Math.round(intervalMs / 60_000)} min`,
  );

  void schedulerTick();
  timer = setInterval(() => {
    void schedulerTick();
  }, intervalMs);
}

export async function runAutomationYieldIfDue(options?: {
  force?: boolean;
  ymd?: string;
}): Promise<
  | { ran: true; result: Awaited<ReturnType<typeof triggerDailyAutomationYield>> }
  | { ran: false; reason: string }
> {
  const tz = getAutomationYieldTimezone();
  const clock = getClockInTimezone(tz);
  const ymd = options?.ymd ?? clock.ymd;

  if (!options?.force) {
    const schedule = getAutomationYieldSchedule();
    if (!shouldRunAutomationYieldNow(clock, schedule)) {
      return { ran: false, reason: "Ainda não é a hora agendada." };
    }
    const last = await getLastAutomationYieldYmd();
    if (last === ymd) {
      return { ran: false, reason: "Rendimento deste dia já foi processado." };
    }
  }

  const result = await triggerDailyAutomationYield({ ymd, force: options?.force });
  return { ran: true, result };
}
