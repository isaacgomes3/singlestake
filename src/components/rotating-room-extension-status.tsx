import { Puzzle } from "lucide-react";

import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import { isLikelyExtensionBridgeOrigin } from "@/lib/roulette/rotatingRoomExtensionBridge";
import {
  readRotatingRoomExtensionEnabled,
  readRotatingRoomExtensionRealMode,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Estado da extensão Chrome (sem enviar sinais — isso fica no bridge global). */
export function RotatingRoomExtensionStatus({ className }: Props) {
  const { present: extensionPresent } = useRotatingRoomExtensionPresent();
  const extensionEnabled = readRotatingRoomExtensionEnabled();
  const realMode = readRotatingRoomExtensionRealMode();
  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  const signalsReady = extensionPresent;

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
        {extensionPresent ? (
          <span className="text-[10px] text-text-secondary">
            {realMode ? "Modo REAL" : "Modo demo"} ·{" "}
            {extensionEnabled ? "liga manual ON" : "automático no back office"}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-text-secondary">
        {!extensionPresent ? (
          <>
            Abra <span className="font-mono text-[10px] text-text-primary">{pageOrigin}</span> no{" "}
            <strong className="text-text-primary">Google Chrome</strong> (extensões não funcionam no
            browser do Cursor). Recarregue em{" "}
            <span className="font-mono text-[10px] text-text-primary">chrome://extensions</span>
            {!isLikelyExtensionBridgeOrigin(pageOrigin) ? " (adicione ao manifest)" : ""} e F5.
          </>
        ) : signalsReady ? (
          "Sinais Um Fator são enviados automaticamente quando há JOGANDO na sala rotativa."
        ) : (
          "A aguardar ligação completa…"
        )}
      </p>
    </div>
  );
}
