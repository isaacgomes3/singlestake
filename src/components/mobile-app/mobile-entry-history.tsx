import type { MobileEntryHistoryItem } from "@/lib/roulette/mobileEntryHistory";
import { cn } from "@/lib/utils";

type EntryVariant = "mobile" | "desktop";

function formatEntryClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function GaleRow({
  galeWon,
  maxRecovery = 3,
  variant = "mobile",
}: {
  galeWon: number | null;
  maxRecovery?: number;
  variant?: EntryVariant;
}) {
  const levels = Array.from({ length: Math.min(maxRecovery, 5) }, (_, i) => i + 1);
  const shell =
    variant === "desktop"
      ? "mt-3 rounded-xl border border-cyan-950/25 bg-[#060a14]/80 p-2"
      : "mt-3 rounded-xl bg-neutral-800/60 p-2";
  const labelClass = variant === "desktop" ? "text-slate-500" : "text-neutral-500";
  const idleBorder = variant === "desktop" ? "border-slate-700/80 bg-slate-900/50 text-slate-500" : "border-neutral-700/80 bg-neutral-900/50 text-neutral-500";
  const idleDot = variant === "desktop" ? "border-slate-600" : "border-neutral-600";

  return (
    <div className={shell}>
      <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-wide", labelClass)}>
        Zona de gale — opcional
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {levels.map((g) => {
          const active = galeWon === g;
          return (
            <div
              key={g}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-bold leading-tight",
                active
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : idleBorder,
              )}
            >
              {active ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                  ✓
                </span>
              ) : (
                <span className={cn("h-3.5 w-3.5 rounded-full border", idleDot)} />
              )}
              Gale {g}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatLine({
  label,
  value,
  valueClass,
  variant = "mobile",
}: {
  label: string;
  value: string;
  valueClass?: string;
  variant?: EntryVariant;
}) {
  const border = variant === "desktop" ? "border-cyan-950/20" : "border-neutral-800/80";
  const labelClass = variant === "desktop" ? "text-slate-500" : "text-neutral-500";
  const defaultValue = variant === "desktop" ? "text-slate-100" : "text-neutral-200";

  return (
    <div className={cn("flex items-center justify-between gap-3 border-b py-2 last:border-0", border)}>
      <span className={cn("text-sm", labelClass)}>{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueClass ?? defaultValue)}>{value}</span>
    </div>
  );
}

type Props = {
  items: MobileEntryHistoryItem[];
  singleFactor: boolean;
  maxRecovery: number;
  className?: string;
  variant?: EntryVariant;
};

function entryCardShell(variant: EntryVariant): string {
  if (variant === "desktop") {
    return "rounded-2xl border border-cyan-950/30 bg-[#0d1524]/95 p-4 shadow-md shadow-black/20";
  }
  return "rounded-2xl border border-neutral-800/90 bg-neutral-900/90 p-4";
}

function MobileEntryHistoryCard({
  entry,
  singleFactor,
  maxRecovery,
  variant = "mobile",
}: {
  entry: MobileEntryHistoryItem;
  singleFactor: boolean;
  maxRecovery: number;
  variant?: EntryVariant;
}) {
  const statusLabel = entry.won ? "Green" : "Red";
  const dotClass = entry.won ? "bg-emerald-400" : "bg-rose-400";
  const titleClass = variant === "desktop" ? "text-slate-100" : "text-neutral-200";
  const timeClass = variant === "desktop" ? "text-slate-500" : "text-neutral-500";

  return (
    <article className={entryCardShell(variant)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} aria-hidden />
          <span className={cn("text-sm font-bold", titleClass)}>{statusLabel}</span>
        </div>
        <span className={cn("text-xs tabular-nums", timeClass)}>{formatEntryClock(entry.ts)}</span>
      </div>
      <StatLine
        label={singleFactor ? "Factor" : "Colunas"}
        value={entry.factorsLabel}
        variant={variant}
      />
      <StatLine label="Últimos números" value={entry.triggerChain} variant={variant} />
      <StatLine label="Proteção" value={String(entry.recovery)} variant={variant} />
      <StatLine label="Confiança" value={entry.confidence} variant={variant} />
      <StatLine
        label="Número vencedor"
        value={entry.resultNumber != null ? String(entry.resultNumber) : "—"}
        valueClass={entry.won ? "text-emerald-400" : "text-rose-400"}
        variant={variant}
      />
      {entry.won ? <GaleRow galeWon={entry.galeWon} maxRecovery={maxRecovery} variant={variant} /> : null}
    </article>
  );
}

export function MobileEntryHistoryList({
  items,
  singleFactor,
  maxRecovery,
  className,
  variant = "mobile",
}: Props) {
  if (items.length === 0) return null;

  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label="Histórico de entradas">
      {items.map((entry) => (
        <MobileEntryHistoryCard
          key={entry.id}
          entry={entry}
          singleFactor={singleFactor}
          maxRecovery={maxRecovery}
          variant={variant}
        />
      ))}
    </section>
  );
}
