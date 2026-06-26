import { Puzzle } from "lucide-react";
import { useEffect, useState } from "react";

import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import {
  readRotatingRoomExtensionEnabled,
  ROTATING_ROOM_EXTENSION_ENABLED_KEY,
  ROTATING_ROOM_EXTENSION_PREFS_EVENT,
  writeRotatingRoomExtensionEnabled,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function RotatingRoomExtensionStatus({ className, compact }: Props) {
  const { present: extensionPresent } = useRotatingRoomExtensionPresent();
  const [enabled, setEnabled] = useState(readRotatingRoomExtensionEnabled);

  useEffect(() => {
    const sync = () => setEnabled(readRotatingRoomExtensionEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROTATING_ROOM_EXTENSION_ENABLED_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    };
  }, []);

  const toggle = () => {
    if (!extensionPresent) return;
    const next = !enabled;
    writeRotatingRoomExtensionEnabled(next);
    setEnabled(next);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border-color bg-bg-card/60",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Puzzle
          className={cn("shrink-0 text-text-secondary", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
          aria-hidden
        />
        <span
          className={cn(
            "font-semibold text-text-primary",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Extensão Chrome
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={!extensionPresent}
          aria-pressed={enabled}
          aria-label={enabled ? "Desligar extensão" : "Ligar extensão"}
          title={
            !extensionPresent
              ? "Extensão não detectada"
              : enabled
                ? "Extensão ligada"
                : "Extensão desligada"
          }
          className={cn(
            "ml-auto shrink-0 rounded-full border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            compact ? "h-6 w-6" : "h-7 w-7",
            !extensionPresent && "cursor-not-allowed opacity-40",
            enabled
              ? "border-success bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)]"
              : "border-red-500 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.35)]",
          )}
        />
      </div>
    </div>
  );
}
