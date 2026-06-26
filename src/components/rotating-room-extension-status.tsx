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

type ExtensionApi = {
  setBridgeEnabled?: (enabled: boolean) => Promise<unknown>;
  getBridgeEnabled?: () => Promise<boolean>;
};

function extensionApi(): ExtensionApi | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { __singlestakeExtension?: ExtensionApi }).__singlestakeExtension ?? null;
}

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

  useEffect(() => {
    if (!extensionPresent) return;
    const api = extensionApi();
    if (!api?.getBridgeEnabled) return;
    void api.getBridgeEnabled().then((bridgeOn) => {
      writeRotatingRoomExtensionEnabled(bridgeOn);
      setEnabled(bridgeOn);
    });
  }, [extensionPresent]);

  const toggle = () => {
    if (!extensionPresent) return;
    const next = !enabled;
    writeRotatingRoomExtensionEnabled(next);
    setEnabled(next);
    void extensionApi()?.setBridgeEnabled?.(next);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border-color bg-bg-card/60",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        enabled && extensionPresent && "border-emerald-500/35",
        !enabled && extensionPresent && "border-red-500/35",
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
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wide",
            !extensionPresent && "text-text-secondary",
            extensionPresent && enabled && "text-emerald-400",
            extensionPresent && !enabled && "text-red-400",
          )}
        >
          {!extensionPresent ? "Ausente" : enabled ? "Ligada" : "Desligada"}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={!extensionPresent}
          aria-pressed={enabled}
          aria-label={enabled ? "Desligar extensão" : "Ligar extensão"}
          title={
            !extensionPresent
              ? "Instale e recarregue a extensão STAKE37"
              : enabled
                ? "Clique para desligar"
                : "Clique para ligar"
          }
          className={cn(
            "relative ml-auto shrink-0 rounded-full border-2 transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            compact ? "h-6 w-11" : "h-7 w-12",
            !extensionPresent && "cursor-not-allowed opacity-40",
            extensionPresent && enabled && "border-emerald-400 bg-emerald-500",
            extensionPresent && !enabled && "border-red-400 bg-red-500",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 block rounded-full bg-white shadow-md transition-[left]",
              compact ? "h-4 w-4" : "h-5 w-5",
              enabled ? (compact ? "left-[22px]" : "left-[22px]") : "left-0.5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
