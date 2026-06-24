import { MapPin, Maximize2, Minimize2 } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { TapeteRouletteAwaitingOverlay } from "@/components/tapete-roulette-awaiting-overlay";
import { StreetStrategySpinFlashOverlay } from "@/components/street-strategy-spin-feedback";
import { toggleElementFullscreen } from "@/lib/dom/toggleElementFullscreen";
import type { StreetStrategySpinFlash } from "@/hooks/useStreetStrategySpinOutcomeFlash";
import { useTapeteRouletteAwaitingSpin } from "@/hooks/useTapeteRouletteAwaitingSpin";
import { cn } from "@/lib/utils";
import {
  colorOf,
  streetBetTargetsFromActive,
  type StreetStrategyActive,
} from "@/lib/roulette/streetStrategy";

function numberCellClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

function ChipStreet({ label = "1" }: { label?: string }) {
  return (
    <span
      className="pointer-events-none absolute bottom-0 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 translate-y-[52%] items-center justify-center rounded-full border-2 border-amber-100/95 bg-amber-200 text-[11px] font-black leading-none text-amber-950 shadow-lg ring-2 ring-black/30"
      aria-hidden
    >
      {label}
    </span>
  );
}

function ChipOutside({ label = "6" }: { label?: string }) {
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-100/95 bg-amber-200 text-sm font-black text-amber-950 shadow-lg ring-2 ring-black/30"
      aria-hidden
    >
      {label}
    </span>
  );
}

type BoardShellProps = {
  boardMeasureRef: RefObject<HTMLDivElement | null>;
  active: StreetStrategyActive | null;
  betStreets: ReadonlySet<number> | null;
  outsideZone: "1-18" | "19-36" | null;
  excluded: ReadonlySet<number> | null;
  /** Casa do último sorteio (0–36): pino no tapete durante o feedback. */
  resultPinNumber: number | null;
};

function StreetStrategyBoardShell({
  boardMeasureRef,
  active,
  betStreets,
  outsideZone,
  excluded,
  resultPinNumber,
}: BoardShellProps) {
  return (
    <div
      ref={boardMeasureRef}
      className="overflow-x-auto rounded-2xl border border-emerald-500/25 bg-slate-950/90 p-3 shadow-inner ring-1 ring-white/5"
    >
      <div className="mx-auto min-w-[min(100%,560px)] max-w-[720px] text-[11px] sm:text-xs">
        <div className="flex items-stretch gap-0.5">
          <div
            className={`relative flex w-9 shrink-0 items-stretch sm:w-11 ${numberCellClass(0)} rounded-l-md border font-bold sm:text-sm`}
          >
            <div className="relative flex flex-1 items-center justify-center">
              0
              {resultPinNumber === 0 ? (
                <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[28%]">
                  <MapPin
                    className="h-5 w-5 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-6 sm:w-6"
                    aria-hidden
                  />
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-12 gap-0.5">
            {Array.from({ length: 12 }, (_, col) => {
              const streetId = col + 1;
              const top = 3 * (col + 1);
              const mid = 3 * col + 2;
              const bot = 3 * col + 1;
              const isBet = betStreets?.has(streetId) ?? false;
              const isExcluded = excluded?.has(streetId) ?? false;
              const dimExcluded = active && isExcluded;

              return (
                <div
                  key={streetId}
                  className={`relative flex min-w-0 flex-col gap-0.5 ${dimExcluded ? "opacity-45" : ""}`}
                >
                  {[top, mid, bot].map((n) => (
                    <div
                      key={n}
                      className={`relative flex aspect-[5/4] min-h-[26px] items-center justify-center rounded-sm border font-bold tabular-nums sm:min-h-[30px] sm:text-xs ${numberCellClass(n)}`}
                    >
                      {n}
                      {resultPinNumber === n ? (
                        <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[30%]">
                          <MapPin
                            className="h-5 w-5 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-6 sm:w-6"
                            aria-hidden
                          />
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {isBet ? <ChipStreet label="1" /> : null}
                  {dimExcluded ? (
                    <span className="pointer-events-none absolute -bottom-1 left-1/2 z-[5] max-w-[4.5rem] -translate-x-1/2 text-center text-[7px] font-semibold uppercase leading-tight tracking-wide text-rose-400/90 sm:max-w-none sm:text-[8px]">
                      excl.
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-0.5 grid grid-cols-12 gap-0.5 pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]">
          <div className="col-span-4 flex items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90">
            1.ª 12
          </div>
          <div className="col-span-4 flex items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90">
            2.ª 12
          </div>
          <div className="col-span-4 flex items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90">
            3.ª 12
          </div>
        </div>

        <div className="mt-0.5 grid grid-cols-12 gap-0.5 pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]">
          {(
            [
              { key: "low", label: "Baixo\n1–18", span: 2, zone: "1-18" as const },
              { key: "even", label: "PARES", span: 2, zone: null },
              { key: "red", label: "◆", span: 2, zone: null, red: true },
              { key: "black", label: "◆", span: 2, zone: null, black: true },
              { key: "odd", label: "ÍMPARES", span: 2, zone: null },
              { key: "high", label: "Alto\n19–36", span: 2, zone: "19-36" as const },
            ] as const
          ).map((cell) => {
            const streetZoneChip = cell.zone != null && outsideZone === cell.zone;
            const showOutsideChip = streetZoneChip;
            const chipLabel: string | null = streetZoneChip ? "6" : null;

            const base =
              "relative flex min-h-[44px] items-center justify-center rounded-sm border py-2.5 font-semibold";
            let cls = "border-slate-700 bg-slate-900/90 text-slate-200";
            if ("red" in cell) cls = "border-red-500/40 bg-red-700/70 text-red-50";
            if ("black" in cell) cls = "border-slate-600 bg-slate-800 text-slate-100";
            if (showOutsideChip) cls = `${cls} ring-2 ring-amber-400/50`;

            return (
              <div
                key={cell.key}
                className={`${base} ${cls}`}
                style={{ gridColumn: `span ${cell.span} / span ${cell.span}` }}
              >
                {chipLabel != null ? <ChipOutside label={chipLabel} /> : null}
                <span
                  className={`${"red" in cell || "black" in cell ? "text-lg" : ""} ${cell.key === "low" || cell.key === "high" ? "whitespace-pre-line text-center leading-tight" : ""}`}
                >
                  {cell.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Props = {
  active: StreetStrategyActive | null;
  /** Último sorteio a evidenciar no tapete (pino). */
  resultPinNumber?: number | null;
  /** Feedback «Venceu» / «Perdeu» — renderizado no tapete em tela cheia para ficar visível no fullscreen. */
  spinFlash?: StreetStrategySpinFlash | null;
  /**
   * Histórico newest-first: com indicação activa, após 20 s mostra overlay de roleta até chegar um novo giro.
   * Omitir para desactivar.
   */
  awaitSpinHistory?: readonly number[];
};

export function StreetStrategyTable({
  active,
  resultPinNumber = null,
  spinFlash = null,
  awaitSpinHistory,
}: Props) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardMeasureRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Dimensões naturais do tapete e escala para caber na área (mantém proporção). */
  const [fit, setFit] = useState({ bw: 0, bh: 0, s: 1 });

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
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

  const targets = active ? streetBetTargetsFromActive(active) : null;
  const betStreets = targets ? new Set(targets.streetIds) : null;
  const outsideZone = targets?.outsideZone ?? null;
  const excluded = active ? new Set(active.excludedStreetIds) : null;

  const boardProps: BoardShellProps = {
    boardMeasureRef,
    active,
    betStreets,
    outsideZone,
    excluded,
    resultPinNumber: resultPinNumber ?? null,
  };

  const frame = cn(
    "relative rounded-2xl bg-transparent",
    isFullscreen &&
      "flex h-dvh max-h-dvh w-screen max-w-none flex-col overflow-hidden rounded-none bg-[#080d18] pt-12 sm:pt-14",
  );

  const { bw, bh, s } = fit;
  const fitReady = isFullscreen && bw > 0 && bh > 0;

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
              <StreetStrategyBoardShell {...boardProps} />
            </div>
          </div>
        </div>
      ) : (
        <StreetStrategyBoardShell {...boardProps} />
      )}
      {spinFlash ? (
        <StreetStrategySpinFlashOverlay
          flash={spinFlash}
          variant={isFullscreen ? "inline-fullscreen" : "portal-body"}
        />
      ) : null}
    </div>
  );
}
