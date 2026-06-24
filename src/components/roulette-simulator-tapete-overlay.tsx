import { RouletteSpinWheel } from "@/components/roulette-spin-wheel";
import type { SimulatorTapeteOverlayPhase } from "@/hooks/useRouletteSimulatorSpinClock";
import { cn } from "@/lib/utils";

type Props = {
  phase: SimulatorTapeteOverlayPhase;
};

/** Roleta a girar: overlay completo (apostas fechadas até o resultado). */
export function RouletteSimulatorTapeteOverlay({ phase }: Props) {
  if (phase !== "spinning") return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-[28] flex items-center justify-center rounded-[inherit] bg-slate-950/78 backdrop-blur-[3px]",
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
