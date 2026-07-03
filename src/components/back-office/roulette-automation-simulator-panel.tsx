import { AutomationPauseBanner } from "@/components/back-office/automation-pause-banner";
import { RotatingRoomExtensionStatus } from "@/components/rotating-room-extension-status";
import { RotatingRoomLobbyCard } from "@/components/rotating-room-panel";
import { useAutomationAlignedRotativaSession } from "@/hooks/useAutomationAlignedRotatingSession";
import { useRotatingRoomSetup } from "@/hooks/useRotatingRoomSetup";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";

export function RouletteAutomationSimulatorPanel() {
  const { config } = useRouletteAutomationSim();
  const { tableIds, histories } = useRotatingRoomSetup();
  const lobbySession = useAutomationAlignedRotativaSession(tableIds, histories, {
    observeOnly: true,
  });

  return (
    <div className="automation-panel overflow-hidden rounded-2xl">
      {config?.blocksNewEntries ? (
        <AutomationPauseBanner config={config} className="border-b border-border-color px-5 py-3" />
      ) : null}
      <div className="flex min-h-0 flex-col gap-2 p-3">
        <RotatingRoomExtensionStatus compact />
        <RotatingRoomLobbyCard
          embedded
          openInIframe
          session={lobbySession}
          salaRoute="/sala-rotativa-um-fator"
          salaLabel="Sala Rotativa"
        />
      </div>
    </div>
  );
}
