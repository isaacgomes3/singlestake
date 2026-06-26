import { Puzzle } from "lucide-react";

import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function RotatingRoomExtensionStatus({ className }: Props) {
  const { present: extensionPresent } = useRotatingRoomExtensionPresent();

  return (
    <div
      className={cn(
        "rounded-xl border border-border-color bg-bg-card/60 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Puzzle className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
        <span className="text-xs font-semibold text-text-primary">Extensão Chrome</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            extensionPresent ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          {extensionPresent ? "Detectada" : "Não detectada"}
        </span>
      </div>
    </div>
  );
}
