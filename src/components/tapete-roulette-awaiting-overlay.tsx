import { cn } from "@/lib/utils";

import { RouletteSpinWheel } from "@/components/roulette-spin-wheel";

type Props = {
  open: boolean;
};

/**
 * Overlay sobre o tapete: roleta estilizada a girar até `open` passar a falso (novo resultado no histórico).
 */
export function TapeteRouletteAwaitingOverlay({ open }: Props) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[28] flex items-center justify-center rounded-[inherit] bg-slate-950/78 backdrop-blur-[3px]",
      )}
      role="status"
      aria-live="polite"
      aria-label="A aguardar resultado do próximo giro"
    >
      <div className="flex flex-col items-center gap-3 px-4">
        <RouletteSpinWheel size="full" />
        <p className="max-w-[16rem] text-center text-sm font-semibold leading-snug text-amber-50/95 drop-shadow sm:text-base">
          A aguardar resultado…
        </p>
      </div>
    </div>
  );
}
