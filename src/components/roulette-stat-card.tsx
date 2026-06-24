import { useId, useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const MAX_CHART_POINTS = 96;

/** Moldura dos cartões de informação (azul do site + bordo ciano, texto branco). */
const STAT_CARD_BORDER = "border-cyan-500/35";
const STAT_CARD_SHELL_BASE =
  "relative overflow-hidden border-2 bg-gradient-to-br from-cyan-950/90 via-[#0d1524] to-[#060a14] shadow-lg shadow-black/40";

function downsampleSeries(values: number[], maxPoints: number): number[] {
  if (values.length === 0) return [];
  if (values.length <= maxPoints) return values;
  const out: number[] = [];
  const last = values.length - 1;
  for (let j = 0; j < maxPoints; j++) {
    const idx = Math.round((j / (maxPoints - 1)) * last);
    out.push(values[idx]!);
  }
  return out;
}

/** Onda suave decorativa quando nao ha serie numerica util. */
function decorativeWaveSeries(seed: string, n = 28): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : (i / (n - 1)) * Math.PI * 2;
    const wobble = Math.sin(t * 1.7 + (h % 7) * 0.4) * 0.12;
    out.push(0.42 + Math.sin(t + h * 0.01) * 0.22 + wobble);
  }
  return out;
}

function normalizeToUnitInterval(values: number[]): number[] {
  if (values.length === 0) return [];
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

function buildAreaPathD(normYs: number[]): string {
  const n = normYs.length;
  if (n === 0) return "";
  const topPad = 8;
  const bottomY = 100;
  const usable = bottomY - topPad - 6;
  const xAt = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (t: number) => topPad + (1 - t) * usable;

  let d = `M 0 ${bottomY} L ${xAt(0).toFixed(2)} ${yAt(normYs[0]!).toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${xAt(i).toFixed(2)} ${yAt(normYs[i]!).toFixed(2)}`;
  }
  d += ` L 100 ${bottomY} Z`;
  return d;
}

function buildLinePathD(normYs: number[]): string {
  const n = normYs.length;
  if (n === 0) return "";
  const topPad = 8;
  const bottomY = 100;
  const usable = bottomY - topPad - 6;
  const xAt = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (t: number) => topPad + (1 - t) * usable;
  let d = `M ${xAt(0).toFixed(2)} ${yAt(normYs[0]!).toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${xAt(i).toFixed(2)} ${yAt(normYs[i]!).toFixed(2)}`;
  }
  return d;
}

const TONE_GRADIENT: Record<
  "default" | "green" | "red" | "amber",
  readonly [string, string]
> = {
  default: ["#7dd3fc", "#0369a1"],
  green: ["#6ee7b7", "#34d399"],
  red: ["#fda4af", "#e879a9"],
  amber: ["#fcd34d", "#f59e0b"],
};

/** Gradiente do gráfico em variant lobby (harmoniza com o azul do cartão). */
const LOBBY_CHART_GRADIENT: readonly [string, string] = ["#7dd3fc", "#0284c7"];

export type RouletteStatCardSize = "sm" | "md" | "lg";

const STAT_SIZE_SHELL: Record<
  RouletteStatCardSize,
  { shell: string; label: string; value: string; hint: string; chart: string }
> = {
  sm: {
    shell: "min-h-[4.25rem] rounded-lg px-2.5 pb-5 pt-2",
    label: "text-[0.5rem] tracking-[0.06em]",
    value: "text-base font-bold sm:text-lg",
    hint: "mt-0.5 text-[0.5rem] sm:text-[0.55rem]",
    chart: "h-[34%] opacity-[0.35]",
  },
  md: {
    shell: "min-h-[7.5rem] rounded-xl px-4 pb-10 pt-4",
    label: "text-[0.65rem]",
    value: "text-2xl font-bold sm:text-3xl",
    hint: "mt-1 text-[0.65rem] sm:text-xs",
    chart: "h-[46%] opacity-[0.42]",
  },
  lg: {
    shell: "min-h-[9.5rem] rounded-2xl px-5 pb-12 pt-5",
    label: "text-xs tracking-wide",
    value: "text-3xl font-bold sm:text-4xl",
    hint: "mt-1.5 text-xs sm:text-sm",
    chart: "h-[48%] opacity-[0.45]",
  },
};

export function RouletteStatCard({
  label,
  value,
  tone = "default",
  evolution,
  variant = "default",
  hint,
  size = "md",
}: {
  label: string;
  value: string | number | ReactNode;
  tone?: "default" | "green" | "red" | "amber";
  /** Serie ao longo do tempo (ex.: cumulativo ou %); e normalizada para o grafico. */
  evolution?: number[];
  /** `lobby`: curva do gráfico em tons ciano; o cartão usa o mesmo moldura azul que `default`. */
  variant?: "default" | "lobby";
  /** Texto opcional por baixo do valor (ex.: desdobramento do placar). */
  hint?: string;
  size?: RouletteStatCardSize;
}) {
  const uid = useId();
  const gradId = `rs-area-${uid.replace(/:/g, "")}`;

  const valueClass =
    tone === "green"
      ? "text-emerald-200"
      : tone === "red"
        ? "text-rose-200"
        : tone === "amber"
          ? "text-amber-200"
          : "text-white";

  const [c0, c1] =
    variant === "lobby" && tone === "default" ? LOBBY_CHART_GRADIENT : TONE_GRADIENT[tone];

  const chartNorm = useMemo(() => {
    const raw =
      evolution && evolution.length > 0
        ? downsampleSeries(evolution, MAX_CHART_POINTS)
        : decorativeWaveSeries(label);
    return normalizeToUnitInterval(raw);
  }, [evolution, label]);

  const pathD = useMemo(() => buildAreaPathD(chartNorm), [chartNorm]);
  const lineD = useMemo(() => buildLinePathD(chartNorm), [chartNorm]);

  const centered = variant === "lobby";
  const isPrimitiveValue = typeof value === "string" || typeof value === "number";
  const sz = STAT_SIZE_SHELL[size];

  return (
    <div
      className={cn(
        STAT_CARD_SHELL_BASE,
        STAT_CARD_BORDER,
        sz.shell,
        centered ? "text-center" : "text-left",
      )}
    >
      <div className="relative z-10">
        <div className={cn("font-semibold uppercase text-white/85", sz.label)}>{label}</div>
        <div
          className={cn(
            size === "sm" ? "mt-0.5" : "mt-1.5",
            isPrimitiveValue
              ? cn(sz.value, "tabular-nums", valueClass, centered && "w-full")
              : "flex w-full justify-center",
          )}
        >
          {value}
        </div>
        {hint ? (
          <p className={cn("font-medium leading-tight text-white/65", sz.hint, centered && "text-center")}>
            {hint}
          </p>
        ) : null}
      </div>

      <svg
        className={cn("pointer-events-none absolute inset-x-0 bottom-0 w-full", sz.chart)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c0} stopOpacity="0.55" />
            <stop offset="100%" stopColor={c1} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path d={pathD} fill={`url(#${gradId})`} stroke="none" />
        <path
          d={lineD}
          fill="none"
          stroke={c0}
          strokeOpacity={0.35}
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
