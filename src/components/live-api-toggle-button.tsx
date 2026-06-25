import { useRouletteLiveApi } from "@/lib/roulette/rouletteLiveApiContext";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LiveApiToggleButton({ className, compact }: Props) {
  const { liveApiEnabled, toggleLiveApi } = useRouletteLiveApi();

  return (
    <button
      type="button"
      onClick={toggleLiveApi}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border px-3 font-semibold transition",
        compact ? "h-8 text-xs" : "h-9 text-sm",
        liveApiEnabled
          ? "border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
          : "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25",
        className,
      )}
      aria-pressed={liveApiEnabled}
      aria-label={liveApiEnabled ? "Desligar API ao vivo" : "Ligar API ao vivo"}
    >
      {liveApiEnabled ? "API ao vivo ON" : "Ligar API ao vivo"}
    </button>
  );
}
