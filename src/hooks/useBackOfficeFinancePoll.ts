import { useEffect } from "react";

/** Intervalo para alinhar saldo/extrato ao motor de automação sem SSE pesado. */
export const BACK_OFFICE_FINANCE_POLL_MS = 12_000;

export function useBackOfficeFinancePoll(onPoll: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => onPoll(), BACK_OFFICE_FINANCE_POLL_MS);
    return () => window.clearInterval(id);
  }, [onPoll, enabled]);
}
