import { Maximize2, Minimize2 } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Nums28PctTable } from "@/components/nums-28pct-table";
import { TapeteRouletteAwaitingOverlay } from "@/components/tapete-roulette-awaiting-overlay";
import { StreetStrategySpinFlashOverlay } from "@/components/street-strategy-spin-feedback";
import { toggleElementFullscreen } from "@/lib/dom/toggleElementFullscreen";
import type { Nums28PctSpinFlash } from "@/hooks/useNums28PctSpinOutcomeFlash";
import { useTapeteRouletteAwaitingSpin } from "@/hooks/useTapeteRouletteAwaitingSpin";
import type { Nums28PctActive } from "@/lib/roulette/nums28PctStrategy";
import { cn } from "@/lib/utils";

type BoardProps = {
  boardMeasureRef: RefObject<HTMLDivElement | null>;
  active: Nums28PctActive | null;
  resultPinNumber: number | null;
};

function Nums28BoardShell({ boardMeasureRef, active, resultPinNumber }: BoardProps) {
  return (
    <div
      ref={boardMeasureRef}
      className="overflow-x-auto rounded-2xl border border-emerald-500/25 bg-slate-950/90 p-3 shadow-inner ring-1 ring-white/5"
    >
      <Nums28PctTable
        active={active}
        halfHighlight={null}
        showCoverageHighlight
        showIndicationHalfOnOutsideRow={false}
        resultPinNumber={resultPinNumber}
      />
    </div>
  );
}

type Props = {
  active: Nums28PctActive | null;
  resultPinNumber?: number | null;
  spinFlash?: Nums28PctSpinFlash;
  /** Histórico newest-first: após 20 s com sinal, overlay de roleta até novo giro. Omitir para desactivar. */
  awaitSpinHistory?: readonly number[];
};

/** Tapete Números 2,8% com o mesmo chrome que Ruas 9% (tela cheia + overlay Venceu/Perdeu). */
export function Nums28PctStrategyTable({
  active,
  resultPinNumber = null,
  spinFlash = null,
  awaitSpinHistory,
}: Props) {
  const boardMeasureRef = useRef<HTMLDivElement | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fit, setFit] = useState<{ bw: number; bh: number; s: number }>({ bw: 0, bh: 0, s: 1 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = fullscreenRef.current;
    if (!el) return;
    const onFs = () => setIsFullscreen(document.fullscreenElement === el);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const recomputeFit = useCallback(() => {
    const stage = stageRef.current;
    const board = boardMeasureRef.current;
    if (!stage || !board) return;
    const bw = board.offsetWidth;
    const bh = board.offsetHeight;
    if (bw < 1 || bh < 1) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (cw < 1 || ch < 1) return;
    const pad = 0.94;
    const s = Math.min(cw / bw, ch / bh) * pad;
    if (!Number.isFinite(s) || s <= 0) return;
    setFit({ bw, bh, s });
  }, []);

  useLayoutEffect(() => {
    if (!isFullscreen) {
      setFit({ bw: 0, bh: 0, s: 1 });
      return;
    }
    recomputeFit();
    const ro = new ResizeObserver(() => recomputeFit());
    if (stageRef.current) ro.observe(stageRef.current);
    if (boardMeasureRef.current) ro.observe(boardMeasureRef.current);
    window.addEventListener("resize", recomputeFit);
    const id = requestAnimationFrame(recomputeFit);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", recomputeFit);
    };
  }, [isFullscreen, recomputeFit, active]);

  const onToggleFullscreen = useCallback(() => {
    void toggleElementFullscreen(fullscreenRef.current);
  }, []);

  const awaitingRouletteSpin = useTapeteRouletteAwaitingSpin(active, awaitSpinHistory);

  const boardProps: BoardProps = {
    boardMeasureRef,
    active,
    resultPinNumber: resultPinNumber ?? null,
  };

  const frame = cn(
    "relative rounded-2xl bg-transparent",
    isFullscreen &&
      "flex h-dvh max-h-dvh w-screen max-w-none flex-col overflow-hidden rounded-none bg-[#080d18] pt-12 sm:pt-14",
  );

  const { bw, bh, s } = fit;
  const fitReady = isFullscreen && bw > 0 && bh > 0;

  const flashForOverlay =
    spinFlash == null
      ? null
      : { resultNumber: spinFlash.resultNumber, won: spinFlash.won, tie: false as const };

  return (
    <div ref={fullscreenRef} className={frame}>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className={cn(
          "z-[35] flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-950/50 bg-[#0d1524]/95 text-cyan-200 shadow-md transition hover:border-cyan-500/45 hover:bg-[#0d1524] hover:text-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
          isFullscreen ? "fixed right-3 top-3 sm:right-5 sm:top-5" : "absolute right-2 top-2",
        )}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Sair de tela cheia" : "Ver tapete em tela cheia"}
        title={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
      </button>

      <TapeteRouletteAwaitingOverlay open={awaitingRouletteSpin} />

      {isFullscreen ? (
        <div
          ref={stageRef}
          className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-3 pb-4 pt-1 sm:px-5 sm:pb-6"
        >
          <div
            className="relative shrink-0"
            style={
              fitReady
                ? { width: bw * s, height: bh * s }
                : { minWidth: "min(100%, 720px)", minHeight: "40vh" }
            }
          >
            <div
              className="absolute left-0 top-0 will-change-transform"
              style={{
                width: bw || undefined,
                height: bh || undefined,
                transform: fitReady ? `scale(${s})` : undefined,
                transformOrigin: "top left",
              }}
            >
              <Nums28BoardShell {...boardProps} />
            </div>
          </div>
        </div>
      ) : (
        <Nums28BoardShell {...boardProps} />
      )}
      {flashForOverlay ? (
        <StreetStrategySpinFlashOverlay
          flash={flashForOverlay}
          variant={isFullscreen ? "inline-fullscreen" : "portal-body"}
        />
      ) : null}
    </div>
  );
}
