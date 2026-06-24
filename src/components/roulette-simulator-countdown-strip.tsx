import { cn } from "@/lib/utils";

type StripPhase = "idle" | "reveal" | "countdown" | "spinning";

type Props = {
  phase: StripPhase;
  countdownSec: number;
  revealNumber: number | null;
  revealNumberClassName: string;
};

/** Faixa acima do tapete — altura fixa; não desloca o layout entre fases. */
export function RouletteSimulatorCountdownStrip({
  phase,
  countdownSec,
  revealNumber,
  revealNumberClassName,
}: Props) {
  return (
    <div
      className="flex h-14 shrink-0 items-center justify-center border-b border-slate-800/70 bg-slate-950/60 px-3 sm:h-16"
      role="status"
      aria-live="polite"
      aria-label={
        phase === "reveal"
          ? `Novo giro: ${revealNumber ?? ""}`
          : phase === "countdown"
            ? `Próximo giro em ${countdownSec} segundos — apostas abertas`
            : phase === "spinning"
              ? "A aguardar resultado do giro"
              : "A aguardar giros da mesa"
      }
    >
      {phase === "reveal" && revealNumber !== null ? (
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-lg border-2 px-2.5 text-3xl font-black tabular-nums sm:h-12 sm:text-4xl",
              revealNumberClassName,
            )}
          >
            {revealNumber}
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/95 sm:text-xs">
            Novo giro · aposte no tapete
          </p>
        </div>
      ) : phase === "countdown" ? (
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black tabular-nums leading-none text-cyan-50 sm:text-5xl">
            {countdownSec}
            <span className="ml-1 text-xl font-bold text-cyan-400/85 sm:text-2xl">s</span>
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
            Próximo giro · apostas abertas
          </p>
        </div>
      ) : phase === "spinning" ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/90 sm:text-xs">
          A aguardar resultado…
        </p>
      ) : (
        <span className="sr-only">A aguardar giros</span>
      )}
    </div>
  );
}
