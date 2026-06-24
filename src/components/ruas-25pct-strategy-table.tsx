import { Maximize2, Minimize2 } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Ruas25PctTable } from "@/components/ruas-25pct-table";
import { TapeteRouletteAwaitingOverlay } from "@/components/tapete-roulette-awaiting-overlay";
import { StreetStrategySpinFlashOverlay } from "@/components/street-strategy-spin-feedback";
import { toggleElementFullscreen } from "@/lib/dom/toggleElementFullscreen";
import type { Ruas25PctSpinFlash } from "@/hooks/useRuas25PctSpinOutcomeFlash";
import { useTapeteRouletteAwaitingSpin } from "@/hooks/useTapeteRouletteAwaitingSpin";
import type { Ruas25PctActive } from "@/lib/roulette/ruas25PctStrategy";
import { cn } from "@/lib/utils";

function Ruas25Indication({ active }: { active: Ruas25PctActive }) {
  const [e0, e1] = active.excludedNumbers;
  return (
    <div className="mt-4 px-2 text-center" aria-live="polite">
      <p className="text-[2.25rem] font-extrabold leading-snug tracking-tight text-emerald-50 sm:text-4xl">
        Exclusão: {e0} e {e1}
      </p>
    </div>
  );
}

type BoardProps = {
  boardMeasureRef: RefObject<HTMLDivElement | null>;
  active: Ruas25PctActive | null;
  resultPinNumber: number | null;
};

function Ruas25BoardShell({ boardMeasureRef, active, resultPinNumber }: BoardProps) {
  return (
    <div ref={boardMeasureRef}>
      <Ruas25PctTable active={active} resultPinNumber={resultPinNumber} />
    </div>
  );
}

type Props = {
  active: Ruas25PctActive | null;
  resultPinNumber?: number | null;
  spinFlash?: Ruas25PctSpinFlash;
  awaitSpinHistory?: readonly number[];
};

export function Ruas25PctStrategyTable({
  active,
  resultPinNumber = null,
  spinFlash = null,
  awaitSpinHistory,
}: Props) {
  const boardMeasureRef = useRef<HTMLDivElement | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fit, setFit] = useState({ bw: 0, bh: 0, s: 1 });
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
          "z-[35] flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-950/50 bg-[#0d1524]/95 text-emerald-200 shadow-md transition hover:border-emerald-500/45 hover:bg-[#0d1524] hover:text-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
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
              <Ruas25BoardShell {...boardProps} />
            </div>
          </div>
        </div>
      ) : (
        <Ruas25BoardShell {...boardProps} />
      )}
      {active ? <Ruas25Indication active={active} /> : null}
      {flashForOverlay ? (
        <StreetStrategySpinFlashOverlay
          flash={flashForOverlay}
          variant={isFullscreen ? "inline-fullscreen" : "portal-body"}
        />
      ) : null}
    </div>
  );
}
