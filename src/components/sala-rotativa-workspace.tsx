import { useCallback, useEffect, useMemo, useState } from "react";
import { Smartphone } from "lucide-react";

import { RotatingRoomPanel } from "@/components/rotating-room-panel";
import { RotatingRoomExtensionStrip } from "@/components/rotating-room-extension-strip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { rotatingRoomLobbyFocusTableId } from "@/lib/roulette/rotatingRoomLobbySignal";
import { rotatingRoomTableOpenTarget } from "@/lib/roulette/rotatingRoomTableOpen";
import {
  readRotatingRoomSignalOnlyMode,
  writeRotatingRoomIframeMode,
  writeRotatingRoomSignalOnlyMode,
} from "@/lib/roulette/rotatingRoomViewPrefs";
import { cn } from "@/lib/utils";

const ROTATING_ROOM_INDICATION_PANEL_ID = "rotating-room-indication-panel";

type Props = {
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession;
  histories: Record<number, readonly number[]>;
  tableIds: readonly number[];
  maxRecovery: number;
  panelTitle?: string;
  onReset: () => void;
  onCorrectLastLoss?: () => void;
};

export function SalaRotativaWorkspace({
  session,
  histories,
  tableIds,
  maxRecovery,
  panelTitle = "Sala Rotativa",
  onReset,
  onCorrectLastLoss,
}: Props) {
  const isMobile = useIsMobile();
  const [signalOnlyPref, setSignalOnlyPref] = useState<boolean | null>(() =>
    readRotatingRoomSignalOnlyMode(),
  );
  const signalOnlyMode = signalOnlyPref ?? isMobile;

  useEffect(() => {
    writeRotatingRoomIframeMode(false);
  }, []);

  const focusTableId = rotatingRoomLobbyFocusTableId(session);
  const activeTableId = focusTableId ?? tableIds[0] ?? null;
  const mesaEmbedUrl = activeTableId != null ? getCasinoEmbedUrlForTable(activeTableId) : null;
  const mesaLabel = activeTableId != null ? lobbyTableDisplayName(activeTableId) : null;

  const toggleSignalOnlyMode = useCallback(() => {
    setSignalOnlyPref((prev) => {
      const current = prev ?? isMobile;
      const next = !current;
      writeRotatingRoomSignalOnlyMode(next);
      return next;
    });
  }, [isMobile]);

  const openTableInBrowser = useCallback((tableId: number) => {
    const target = rotatingRoomTableOpenTarget(tableId);
    if (target.kind === "embed") {
      window.open(target.href, "_blank", "noopener,noreferrer");
    }
  }, []);

  const workspaceShell = useMemo(
    () => (signalOnlyMode ? "relative mt-2" : "relative mt-4"),
    [signalOnlyMode],
  );

  return (
    <div
      className={cn(
        "mt-4 space-y-3",
        signalOnlyMode && "mt-2 flex min-h-[calc(100dvh-11rem)] flex-col justify-center",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSignalOnlyMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              signalOnlyMode
                ? "border-warning/50 bg-bg-card text-text-primary"
                : "border-border-color text-text-secondary hover:bg-bg-card-hover hover:text-text-primary",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            {signalOnlyMode ? "Modo sinal" : "Modo completo"}
          </button>
          {mesaLabel ? (
            <span className="text-xs text-text-secondary">
              Mesa: <span className="font-semibold text-text-primary">{mesaLabel}</span>
              <span className="opacity-80"> · casino no navegador</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className={workspaceShell}>
        <div
          className={cn(
            "z-30",
            signalOnlyMode
              ? "relative mx-auto w-full max-w-md px-1"
              : "relative mx-auto w-[min(100%,26rem)] sm:w-[min(100%,30rem)]",
          )}
        >
          <div
            id={ROTATING_ROOM_INDICATION_PANEL_ID}
            className={cn(
              "overflow-hidden rounded-2xl border shadow-2xl shadow-black/45 backdrop-blur-md",
              signalOnlyMode
                ? "border-border-color/80 bg-bg-card/98"
                : "border-transparent bg-transparent shadow-none",
            )}
          >
            <RotatingRoomPanel
              session={session}
              histories={histories}
              tableIds={tableIds}
              maxRecovery={maxRecovery}
              onReset={onReset}
              onCorrectLastLoss={onCorrectLastLoss}
              panelTitle={panelTitle}
              signalOnly={signalOnlyMode}
              onOpenTable={openTableInBrowser}
            />
          </div>

          <RotatingRoomExtensionStrip session={session} mesaEmbedUrl={mesaEmbedUrl} className="mt-2" />
        </div>
      </div>
    </div>
  );
}
