import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import type { StreetStrategySpinFlash } from "@/hooks/useStreetStrategySpinOutcomeFlash";

type Props = {
  flash: StreetStrategySpinFlash;
  /**
   * `portal-body`: overlay em `document.body` (modo normal).
   * `inline-fullscreen`: filho do tapete em tela cheia — obrigatório para o texto aparecer dentro do `requestFullscreen()`.
   */
  variant?: "portal-body" | "inline-fullscreen";
};

function SpinFlashLayer({
  flash,
  outerClassName,
}: {
  flash: NonNullable<StreetStrategySpinFlash>;
  outerClassName: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none flex items-center justify-center bg-black/55 px-4 sm:px-6",
        outerClassName,
      )}
    >
      <div
        role="status"
        aria-live="assertive"
        className={cn(
          "max-w-[min(92vw,28rem)] rounded-3xl border-4 bg-[#050811]/96 px-10 py-8 text-center shadow-2xl ring-1 ring-white/10 sm:px-14 sm:py-10",
          flash.tie
            ? "border-amber-400 shadow-amber-500/25"
            : flash.won
              ? "border-emerald-400 shadow-emerald-500/30"
              : "border-red-500 shadow-red-600/25",
        )}
      >
        <span
          className={cn(
            "block text-5xl font-black tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:text-6xl",
            flash.tie ? "text-amber-300" : flash.won ? "text-emerald-400" : "text-red-500",
          )}
        >
          {flash.tie ? "Empate" : flash.won ? "Venceu" : "Perdeu"}
        </span>
      </div>
    </div>
  );
}

/** Overlay «Venceu» / «Perdeu» / «Empate» (Ruas 20% — transversal com ficha). Em tela cheia usar `variant="inline-fullscreen"` dentro do nó fullscreen. */
export function StreetStrategySpinFlashOverlay({ flash, variant = "portal-body" }: Props) {
  if (!flash) return null;

  if (variant === "inline-fullscreen") {
    return <SpinFlashLayer flash={flash} outerClassName="absolute inset-0 z-[500]" />;
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <SpinFlashLayer flash={flash} outerClassName="fixed inset-0 z-[9999]" />,
    document.body,
  );
}
