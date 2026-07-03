import { useEffect, useMemo, useState } from "react";

import { AutomationHistoryTable } from "@/components/back-office/automation-history-table";
import { RouletteAutomationSimulatorPanel } from "@/components/back-office/roulette-automation-simulator-panel";
import {
  fetchGlobalAutomationFinance,
  type GlobalAutomationFinance,
} from "@/lib/back-office/global-automation-api";
import {
  finalizeAutomationSimState,
  ROULETTE_AUTOMATION_INITIAL_BANK,
} from "@/lib/back-office/rouletteAutomationSim";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";

/** Painéis que dependem das APIs de automação — só no subdomínio dedicado. */
export function AutomationOverviewSections() {
  const { state, openBet, revision } = useRouletteAutomationSim();
  const [finance, setFinance] = useState<GlobalAutomationFinance | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGlobalAutomationFinance().then(({ finance: data }) => {
      if (!cancelled) setFinance(data);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const officialBalance = finance?.balance ?? state.balance;
  const initialCapital = finance?.initialCapital ?? ROULETTE_AUTOMATION_INITIAL_BANK;
  const displayState = useMemo(
    () => finalizeAutomationSimState(state, officialBalance),
    [state, officialBalance],
  );

  return (
    <>
      <section>
        <RouletteAutomationSimulatorPanel />
      </section>
      <section>
        <AutomationHistoryTable
          rounds={displayState.rounds}
          openBet={openBet}
          balance={officialBalance}
        />
      </section>
    </>
  );
}
