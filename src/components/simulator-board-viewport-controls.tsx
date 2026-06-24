import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  boardZoom: number;
  isFullscreen: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleFullscreen: () => void;
  className?: string;
};

const btnClass =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-950/50 bg-[#0d1524]/95 text-cyan-200 shadow-md transition hover:border-cyan-500/45 hover:bg-[#0d1524] hover:text-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-40";

export function SimulatorBoardViewportControls({
  boardZoom,
  isFullscreen,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleFullscreen,
  className,
}: Props) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="toolbar"
      aria-label="Zoom e tela cheia do tapete"
    >
      <button
        type="button"
        className={btnClass}
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Reduzir zoom"
        title="Reduzir zoom"
      >
        <ZoomOut className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className={cn(btnClass, "min-w-[2.75rem] px-1 text-[10px] font-bold tabular-nums")}
        onClick={onZoomReset}
        aria-label={`Zoom ${Math.round(boardZoom * 100)} por cento — repor`}
        title="Repor zoom (100%)"
      >
        {Math.round(boardZoom * 100)}%
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Aumentar zoom"
        title="Aumentar zoom"
      >
        <ZoomIn className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={onToggleFullscreen}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
        title={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
