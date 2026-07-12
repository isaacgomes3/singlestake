import { SequenciasMonitorPanel } from "@/components/sequencias-monitor-panel";
import { useRotatingRoomSetup } from "@/hooks/useRotatingRoomSetup";
import { useSequenciasMonitor } from "@/hooks/useSequenciasMonitor";

/** Visor Sequências embutido no módulo Administração → Automação. */
export function BackOfficeSequenciasMonitorPanel() {
  const { tableIds, histories } = useRotatingRoomSetup();
  const { state, tableId, history, reset } = useSequenciasMonitor(histories, tableIds);

  return (
    <SequenciasMonitorPanel
      state={state}
      tableId={tableId}
      history={history}
      onReset={reset}
      embedded
    />
  );
}
