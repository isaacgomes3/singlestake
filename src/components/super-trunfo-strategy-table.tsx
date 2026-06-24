import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import type { FootballBlitzWinner } from "@/lib/pragmatic/dgaFootballBlitzHistory";
import {
  isSuperTrunfoMainBetActive,
  isSuperTrunfoSpreadBetActive,
  type SuperTrunfoActive,
} from "@/lib/pragmatic/superTrunfoAlert";
import { toggleElementFullscreen } from "@/lib/dom/toggleElementFullscreen";
import { cn } from "@/lib/utils";

const HOME_SPREADS: { value: number; odds: string }[] = [
  { value: 3.5, odds: "2:1" },
  { value: 1.5, odds: "1:1" },
  { value: 7.5, odds: "8:1" },
  { value: 5.5, odds: "4:1" },
  { value: 10.5, odds: "40:1" },
  { value: 9.5, odds: "20:1" },
];

const AWAY_SPREADS: { value: number; odds: string }[] = [
  { value: 1.5, odds: "1:1" },
  { value: 3.5, odds: "2:1" },
  { value: 5.5, odds: "4:1" },
  { value: 7.5, odds: "8:1" },
  { value: 9.5, odds: "20:1" },
  { value: 10.5, odds: "40:1" },
];

function Chip({ label = "1" }: { label?: string }) {
  return (
    <span
      className="pointer-events-none absolute bottom-1 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-amber-100/95 bg-amber-200 text-[11px] font-black leading-none text-amber-950 shadow-lg ring-2 ring-black/35 super-trunfo-chip-pulse"
      aria-hidden
    >
      {label}
    </span>
  );
}

function awaySpreadCellClass(variant: FootballBlitzTableVariant): string {
  if (variant === "top-card") {
    return "border-sky-300/35 bg-gradient-to-b from-sky-400/90 to-blue-600/95 text-white";
  }
  return "border-rose-300/35 bg-gradient-to-b from-rose-500/90 to-rose-700/95 text-white";
}

function awayMainBetClass(variant: FootballBlitzTableVariant): string {
  if (variant === "top-card") {
    return "border-sky-300/40 bg-gradient-to-b from-sky-400 to-blue-600 text-white";
  }
  return "border-rose-300/40 bg-gradient-to-b from-rose-500 to-rose-700 text-white";
}

function SpreadCell({
  value,
  odds,
  side,
  active,
  variant,
}: {
  value: number;
  odds: string;
  side: FootballBlitzWinner;
  active: SuperTrunfoActive | null;
  variant: FootballBlitzTableVariant;
}) {
  const lit = active != null && isSuperTrunfoSpreadBetActive(active, side, value);
  const isHome = side === "home";

  return (
    <div
      className={cn(
        "relative flex min-h-[3.25rem] flex-col items-center justify-center rounded-md border px-1 py-2 text-center sm:min-h-[3.75rem]",
        isHome
          ? "border-amber-300/35 bg-gradient-to-b from-amber-400/90 to-amber-600/95 text-amber-950"
          : awaySpreadCellClass(variant),
        lit && "ring-2 ring-amber-200/90 street-indication-pulse z-10",
      )}
    >
      <span className="text-sm font-black italic leading-none sm:text-base">+{value}</span>
      <span className="mt-0.5 text-[10px] font-bold opacity-90 sm:text-xs">{odds}</span>
      {lit ? <Chip /> : null}
    </div>
  );
}

function MainBetCell({
  title,
  odds,
  side,
  active,
  className,
}: {
  title: string;
  odds: string;
  side: FootballBlitzWinner;
  active: SuperTrunfoActive | null;
  className: string;
}) {
  const lit = active != null && isSuperTrunfoMainBetActive(active, side);

  return (
    <div
      className={cn(
        "relative flex min-h-[7.5rem] flex-col items-center justify-center rounded-lg border px-2 py-3 text-center sm:min-h-[8.5rem]",
        className,
        lit && "ring-2 ring-amber-100/95 street-indication-pulse z-10",
      )}
    >
      <p className="text-lg font-black italic tracking-tight sm:text-xl">{title}</p>
      <p className="mt-1 text-sm font-bold opacity-95 sm:text-base">{odds}</p>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold opacity-80 sm:text-xs">
        <span>0</span>
        <span>R$ 0,00</span>
        <span>0%</span>
      </div>
      {lit ? <Chip /> : null}
    </div>
  );
}

type Props = {
  active: SuperTrunfoActive | null;
  variant?: FootballBlitzTableVariant;
};

export function SuperTrunfoStrategyTable({ active, variant = "super-trunfo" }: Props) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const onToggleFullscreen = useCallback(() => {
    void toggleElementFullscreen(fullscreenRef.current);
  }, []);

  const frame = cn(
    "relative rounded-2xl bg-transparent",
    isFullscreen &&
      "flex h-dvh max-h-dvh w-screen max-w-none flex-col overflow-hidden rounded-none bg-[#0a2618] pt-12 sm:pt-14",
  );

  return (
    <div ref={fullscreenRef} className={frame}>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className={cn(
          "z-[35] flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-900/60 bg-[#0d1524]/95 text-emerald-200 shadow-md transition hover:border-emerald-500/45 hover:text-emerald-50",
          isFullscreen ? "fixed right-3 top-3 sm:right-5 sm:top-5" : "absolute right-2 top-2",
        )}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Sair de tela cheia" : "Ver tapete em tela cheia"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-emerald-900/50 bg-[#0f3d22] p-2 shadow-inner sm:p-3",
          isFullscreen && "mx-auto flex h-full w-full max-w-6xl flex-1 flex-col justify-center",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.12), transparent 55%)",
          }}
          aria-hidden
        />

        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] gap-1.5 sm:gap-2">
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
            {HOME_SPREADS.map((s) => (
              <SpreadCell
                key={`h-${s.value}`}
                value={s.value}
                odds={s.odds}
                side="home"
                active={active}
                variant={variant}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            <MainBetCell
              title="MANDANTE"
              odds="1:1"
              side="home"
              active={active}
              className="border-amber-300/40 bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950"
            />
            <MainBetCell
              title="EMPATE"
              odds="11:1"
              side="draw"
              active={active}
              className="border-emerald-300/40 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white"
            />
            <MainBetCell
              title="VISITANTE"
              odds="1:1"
              side="away"
              active={active}
              className={awayMainBetClass(variant)}
            />
          </div>

          <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
            {AWAY_SPREADS.map((s) => (
              <SpreadCell
                key={`a-${s.value}`}
                value={s.value}
                odds={s.odds}
                side="away"
                active={active}
                variant={variant}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
