import { useMemo } from "react";

import { AutomationHistoryTable } from "@/components/back-office/automation-history-table";
import { RouletteAutomationSimulatorPanel } from "@/components/back-office/roulette-automation-simulator-panel";
import { finalizeAutomationSimState } from "@/lib/back-office/rouletteAutomationSim";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";

/** Painéis que dependem das APIs de automação — só no subdomínio dedicado. */
export function AutomationOverviewSections() {
  const { state, openBet } = useRouletteAutomationSim();

  const officialBalance = state.balance;
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
