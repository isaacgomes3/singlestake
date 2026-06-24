import { Link } from "@tanstack/react-router";
import { Crop, Layers, Move, RotateCcw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RotatingRoomPanel } from "@/components/rotating-room-panel";
import { RotatingRoomClickBotPanel } from "@/components/rotating-room-click-bot-panel";
import { CasinoEmbedViewportControls } from "@/components/casino-embed-viewport-controls";
import { CasinoGameEmbedFrame } from "@/components/casino-game-embed-frame";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useCasinoEmbedViewport } from "@/hooks/useCasinoEmbedViewport";
import { ROTATING_ROOM_INDICATION_PANEL_ID } from "@/lib/roulette/rotatingRoomClickBotLearning";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { rotatingRoomLobbyFocusTableId } from "@/lib/roulette/rotatingRoomLobbySignal";
import {
  rotatingRoomCasinoMesaSearch,
  rotatingRoomTableOpenTarget,
} from "@/lib/roulette/rotatingRoomTableOpen";
import { hasSavedCasinoEmbedViewport } from "@/lib/roulette/casinoEmbedViewportPrefs";
import {
  clampRotatingRoomPanelOffset,
  clearRotatingRoomPanelOffset,
  readRotatingRoomIframeMode,
  readRotatingRoomPanelOffset,
  readRotatingRoomSignalOnlyMode,
  writeRotatingRoomIframeMode,
  writeRotatingRoomPanelOffset,
  writeRotatingRoomSignalOnlyMode,
} from "@/lib/roulette/rotatingRoomViewPrefs";
import { cn } from "@/lib/utils";

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

  const [iframeMode, setIframeMode] = useState(
    () => readRotatingRoomIframeMode() || hasSavedCasinoEmbedViewport(),
  );
  const { viewport, patchViewport, resetViewport } = useCasinoEmbedViewport();
  const [viewportControlsOpen, setViewportControlsOpen] = useState(false);
  const focusTableId = rotatingRoomLobbyFocusTableId(session);
  const [iframeTableId, setIframeTableId] = useState<number | null>(focusTableId);

  const panelOffsetRef = useRef(readRotatingRoomPanelOffset());
  const [panelOffset, setPanelOffset] = useState(() => panelOffsetRef.current);
  const panelDragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  /** Iframe segue a mesa em foco (indicação / posicionar / flash). Janela de apostas só no motor da estratégia. */
  useEffect(() => {
    if (focusTableId != null) setIframeTableId(focusTableId);
  }, [focusTableId]);

  const toggleIframeMode = useCallback(() => {
    setIframeMode((prev) => {
      const next = !prev;
      writeRotatingRoomIframeMode(next);
      return next;
    });
  }, []);

  const toggleSignalOnlyMode = useCallback(() => {
    setSignalOnlyPref((prev) => {
      const current = prev ?? isMobile;
      const next = !current;
      writeRotatingRoomSignalOnlyMode(next);
      return next;
    });
  }, [isMobile]);

  const onOpenTable = useCallback(
    (tableId: number) => {
      setIframeTableId(tableId);
      if (!iframeMode) {
        const target = rotatingRoomTableOpenTarget(tableId);
        if (target.kind === "embed") {
          window.open(target.href, "_blank", "noopener,noreferrer");
        }
      }
    },
    [iframeMode],
  );

  const resetPanelPosition = useCallback(() => {
    const zero = { x: 0, y: 0 };
    panelOffsetRef.current = zero;
    setPanelOffset(zero);
    clearRotatingRoomPanelOffset();
  }, []);

  const onPanelHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panelDragRef.current = {
      px: e.clientX,
      py: e.clientY,
      ox: panelOffsetRef.current.x,
      oy: panelOffsetRef.current.y,
    };
  }, []);

  const onPanelHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = panelDragRef.current;
    if (!d) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const next = clampRotatingRoomPanelOffset(
      { x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) },
      vw,
      vh,
    );
    panelOffsetRef.current = next;
    setPanelOffset(next);
  }, []);

  const onPanelHandlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panelDragRef.current) return;
    panelDragRef.current = null;
    writeRotatingRoomPanelOffset(panelOffsetRef.current);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* já libertado */
    }
  }, []);

  const activeIframeId = iframeTableId ?? focusTableId ?? tableIds[0] ?? null;
  const iframeEmbedUrl = activeIframeId != null ? getCasinoEmbedUrlForTable(activeIframeId) : null;
  const iframeLabel = activeIframeId != null ? lobbyTableDisplayName(activeIframeId) : null;
  const casinoMesaSearch =
    activeIframeId != null ? rotatingRoomCasinoMesaSearch(activeIframeId) : undefined;

  const effectiveIframeMode = iframeMode && !signalOnlyMode;

  const workspaceShell = useMemo(
    () =>
      effectiveIframeMode
        ? "relative mt-4 min-h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border border-slate-800/80 bg-black"
        : signalOnlyMode
          ? "relative mt-2"
          : "relative mt-4",
    [effectiveIframeMode, signalOnlyMode],
  );

  const openTableFromSignal = useCallback(
    (tableId: number) => {
      if (effectiveIframeMode) {
        onOpenTable(tableId);
        return;
      }
      const target = rotatingRoomTableOpenTarget(tableId);
      if (target.kind === "embed") {
        window.open(target.href, "_blank", "noopener,noreferrer");
      }
    },
    [effectiveIframeMode, onOpenTable],
  );

  return (
    <div className={cn("mt-4 space-y-3", signalOnlyMode && "mt-2 flex min-h-[calc(100dvh-11rem)] flex-col justify-center")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSignalOnlyMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              signalOnlyMode
                ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
                : "border-slate-700 text-slate-300 hover:bg-slate-800",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            {signalOnlyMode ? "Modo sinal" : "Modo completo"}
          </button>
          {!signalOnlyMode ? (
            <button
              type="button"
              onClick={toggleIframeMode}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                iframeMode
                  ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-100"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800",
              )}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden />
              {iframeMode ? "Iframe activo" : "Modo iframe"}
            </button>
          ) : null}
          {effectiveIframeMode && activeIframeId != null ? (
            <span className="text-xs text-slate-500">
              Mesa: <span className="font-semibold text-slate-300">{iframeLabel}</span>
            </span>
          ) : null}
        </div>
        {effectiveIframeMode ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewportControlsOpen((o) => !o)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                viewportControlsOpen
                  ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-100"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800",
              )}
            >
              <Crop className="h-3.5 w-3.5" aria-hidden />
              Moldura
            </button>
            {activeIframeId != null ? (
              <Link
                to="/casino-mesa"
                search={casinoMesaSearch}
                className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Abrir ferramentas da mesa
              </Link>
            ) : null}
            <button
              type="button"
              onClick={resetPanelPosition}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Centrar painel
            </button>
          </div>
        ) : null}
      </div>

      {effectiveIframeMode && viewportControlsOpen ? (
        <CasinoEmbedViewportControls
          viewport={viewport}
          onChange={patchViewport}
          onReset={resetViewport}
          compact
        />
      ) : null}

      <div className={workspaceShell}>
        {effectiveIframeMode ? (
          <>
            {iframeEmbedUrl ? (
              <CasinoGameEmbedFrame
                key={activeIframeId ?? iframeEmbedUrl}
                src={iframeEmbedUrl}
                title={iframeLabel ? `Casino — ${iframeLabel}` : "Casino"}
                viewport={viewport}
              />
            ) : activeIframeId != null ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-black px-6 text-center">
                <p className="max-w-md text-sm text-slate-400">
                  Sem URL de casino para <span className="text-white">{iframeLabel}</span>. Configure em
                  ferramentas da mesa ou abra abaixo.
                </p>
                <Link
                  to="/casino-mesa"
                  search={rotatingRoomCasinoMesaSearch(activeIframeId)}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"
                >
                  Configurar mesa {activeIframeId}
                </Link>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                Aguarde indicação de mesa
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-black/50 to-transparent"
              aria-hidden
            />
          </>
        ) : null}

        <div
          className={cn(
            "z-30",
            signalOnlyMode
              ? "relative mx-auto w-full max-w-md px-1"
              : "w-[min(100%,26rem)] sm:w-[min(100%,30rem)]",
            effectiveIframeMode
              ? "pointer-events-auto fixed left-1/2 top-[calc(5.5rem+env(safe-area-inset-top,0px))]"
              : !signalOnlyMode && "relative mx-auto",
          )}
          style={
            effectiveIframeMode
              ? {
                  transform: `translate(calc(-50% + ${panelOffset.x}px), ${panelOffset.y}px)`,
                }
              : undefined
          }
        >
          <div
            id={ROTATING_ROOM_INDICATION_PANEL_ID}
            className={cn(
              "overflow-hidden rounded-2xl border shadow-2xl shadow-black/45 backdrop-blur-md",
              effectiveIframeMode
                ? "border-slate-700/80 bg-[#0a101c]/95"
                : signalOnlyMode
                  ? "border-slate-700/70 bg-[#0a101c]/98"
                  : "border-transparent bg-transparent shadow-none",
            )}
          >
            {effectiveIframeMode ? (
              <div
                role="toolbar"
                aria-label="Arrastar painel de indicação"
                onPointerDown={onPanelHandlePointerDown}
                onPointerMove={onPanelHandlePointerMove}
                onPointerUp={onPanelHandlePointerUp}
                onPointerCancel={onPanelHandlePointerUp}
                className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-slate-800/90 bg-slate-900/95 px-3 py-2 active:cursor-grabbing"
              >
                <Move className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Indicação · arrastar
                </p>
              </div>
            ) : null}

            <RotatingRoomPanel
              session={session}
              histories={histories}
              tableIds={tableIds}
              maxRecovery={maxRecovery}
              onReset={onReset}
              onCorrectLastLoss={onCorrectLastLoss}
              panelTitle={panelTitle}
              compact={effectiveIframeMode}
              floatingChrome={effectiveIframeMode}
              signalOnly={signalOnlyMode || effectiveIframeMode}
              onOpenTable={effectiveIframeMode || signalOnlyMode ? openTableFromSignal : undefined}
            />
          </div>
        </div>
      </div>

      {!signalOnlyMode ? <RotatingRoomClickBotPanel session={session} /> : null}
    </div>
  );
}
