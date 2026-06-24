import { useEffect, useRef, useState } from "react";

import { readLiveTableSpinTimesAligned } from "@/lib/roulette/historyStorage";
import { LIVE_TABLE_BETTING_WINDOW_SEC } from "@/lib/roulette/liveTableBettingWindow";

const TICK_MS = 250;
const SPIN_REVEAL_MS = 2800;

export const SIMULATOR_COUNTDOWN_START_SEC = LIVE_TABLE_BETTING_WINDOW_SEC;

function historyHeadIdentity(h: readonly number[]): string {
  if (h.length === 0) return "0:∅";
  return `${h.length}:${h[0]!}`;
}

export type SimulatorTapeteOverlayPhase = "hidden" | "reveal" | "countdown" | "spinning";

export type RouletteSimulatorSpinClock = {
  countdownSec: number;
  revealNumber: number | null;
  tapetePhase: SimulatorTapeteOverlayPhase;
};

function remainingSecFromEndAt(endAtMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));
}

function countdownEndAtFromLastSpin(
  tableId: number,
  historyNewestFirst: readonly number[],
  nowMs: number = Date.now(),
): number | null {
  if (historyNewestFirst.length === 0) return null;
  const times = readLiveTableSpinTimesAligned(tableId, historyNewestFirst.length);
  const t0 = times[0] ?? null;
  if (t0 != null) {
    const elapsedSec = Math.max(0, (nowMs - t0) / 1000);
    const left = Math.max(0, SIMULATOR_COUNTDOWN_START_SEC - elapsedSec);
    return nowMs + left * 1000;
  }
  return nowMs + SIMULATOR_COUNTDOWN_START_SEC * 1000;
}

/**
 * Contagem decrescente de 20 s após cada giro; a 0 mostra fase «spinning» até o próximo giro.
 */
export function useRouletteSimulatorSpinClock(
  tableId: number,
  historyNewestFirst: readonly number[],
): RouletteSimulatorSpinClock {
  const [countdownSec, setCountdownSec] = useState(SIMULATOR_COUNTDOWN_START_SEC);
  const [revealNumber, setRevealNumber] = useState<number | null>(null);
  const [tapetePhase, setTapetePhase] = useState<SimulatorTapeteOverlayPhase>("hidden");

  const headRef = useRef(historyHeadIdentity(historyNewestFirst));
  const countdownEndAtRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    headRef.current = historyHeadIdentity(historyNewestFirst);
    countdownEndAtRef.current = countdownEndAtFromLastSpin(tableId, historyNewestFirst);
    setRevealNumber(null);
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, [tableId]);

  useEffect(() => {
    const headId = historyHeadIdentity(historyNewestFirst);
    const num = historyNewestFirst[0];

    if (headRef.current !== headId && num !== undefined) {
      headRef.current = headId;
      countdownEndAtRef.current = Date.now() + SIMULATOR_COUNTDOWN_START_SEC * 1000;
      setRevealNumber(num);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => setRevealNumber(null), SPIN_REVEAL_MS);
    }
  }, [historyNewestFirst]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const endAt = countdownEndAtRef.current;
      if (endAt == null || historyNewestFirst.length === 0) {
        setTapetePhase("hidden");
        setCountdownSec(SIMULATOR_COUNTDOWN_START_SEC);
        return;
      }

      const remaining = remainingSecFromEndAt(endAt);
      setCountdownSec(remaining);

      if (revealNumber !== null) {
        setTapetePhase("reveal");
        return;
      }
      if (remaining > 0) {
        setTapetePhase("countdown");
        return;
      }
      setTapetePhase("spinning");
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [historyNewestFirst, revealNumber]);

  return { countdownSec, revealNumber, tapetePhase };
}
