import { AutomationHistoryTable } from "@/components/back-office/automation-history-table";
import { RouletteAutomationSimulatorPanel } from "@/components/back-office/roulette-automation-simulator-panel";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";

/** Painéis que dependem das APIs de automação — só no subdomínio dedicado. */
export function AutomationOverviewSections() {
  const { state: globalAutomation, openBet } = useRouletteAutomationSim();

  return (
    <>
      <section>
        <RouletteAutomationSimulatorPanel />
      </section>
      <section>
        <AutomationHistoryTable
          rounds={globalAutomation.rounds}
          openBet={openBet}
          balance={globalAutomation.balance}
        />
      </section>
    </>
  );
}
