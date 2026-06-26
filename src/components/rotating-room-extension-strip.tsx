import { Puzzle } from "lucide-react";
import { useEffect, useState } from "react";

import { useRotatingRoomExtensionAckLog } from "@/hooks/useRotatingRoomExtensionAckLog";
import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import {
  readEffectiveUmFatorMaxRecovery,
  readRotatingRoomExtensionStats,
  ROTATING_ROOM_EXTENSION_ENABLED_KEY,
  ROTATING_ROOM_EXTENSION_PREFS_EVENT,
  ROTATING_ROOM_EXTENSION_REAL_MODE_KEY,
  readRotatingRoomExtensionEnabled,
  readRotatingRoomExtensionRealMode,
  writeRotatingRoomExtensionEnabled,
  writeRotatingRoomExtensionMaxRecovery,
  writeRotatingRoomExtensionRealMode,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import { cn } from "@/lib/utils";

type Props = {
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession;
  mesaEmbedUrl?: string | null;
  className?: string;
};

export function RotatingRoomExtensionStrip({ session, className }: Props) {
  const [enabled, setEnabled] = useState(readRotatingRoomExtensionEnabled);
  const [realMode, setRealMode] = useState(readRotatingRoomExtensionRealMode);
  const { present: extensionPresent, prefs: extensionPongPrefs } = useRotatingRoomExtensionPresent();
  const [extensionPrefs, setExtensionPrefs] = useState(() => ({
    maxRecovery: readEffectiveUmFatorMaxRecovery(),
    ...readRotatingRoomExtensionStats(),
  }));
  const maxRecovery = extensionPrefs.maxRecovery;
  const placarWins = session.sessionStats.wins;
  const placarLosses = session.sessionStats.losses;

  useRotatingRoomExtensionAckLog(enabled);

  useEffect(() => {
    if (!readRotatingRoomExtensionEnabled()) {
      writeRotatingRoomExtensionEnabled(true);
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      setEnabled(readRotatingRoomExtensionEnabled());
      setRealMode(readRotatingRoomExtensionRealMode());
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === ROTATING_ROOM_EXTENSION_ENABLED_KEY ||
        event.key === ROTATING_ROOM_EXTENSION_REAL_MODE_KEY
      ) {
        sync();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!extensionPongPrefs) return;
    if (extensionPongPrefs.maxRecovery != null) {
      writeRotatingRoomExtensionMaxRecovery(extensionPongPrefs.maxRecovery);
    }
    setExtensionPrefs({
      maxRecovery: extensionPongPrefs.maxRecovery ?? readEffectiveUmFatorMaxRecovery(),
      wins: extensionPongPrefs.wins ?? 0,
      losses: extensionPongPrefs.losses ?? 0,
    });
  }, [extensionPongPrefs]);

  useEffect(() => {
    const onPrefs = () => {
      setExtensionPrefs({
        maxRecovery: readEffectiveUmFatorMaxRecovery(),
        ...readRotatingRoomExtensionStats(),
      });
    };
    window.addEventListener("singlestake-extension-prefs", onPrefs);
    return () => window.removeEventListener("singlestake-extension-prefs", onPrefs);
  }, []);

  const toggleReal = () => {
    setRealMode((prev) => {
      const next = !prev;
      if (next && !window.confirm("Activar entradas REAIS na mesa (martingale)? Confirma.")) {
        return prev;
      }
      writeRotatingRoomExtensionRealMode(next);
      return next;
    });
  };

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      writeRotatingRoomExtensionEnabled(next);
      return next;
    });
  };

  const signalsLinked = enabled && extensionPresent;

  return (
    <div
      className={cn(
        "relative z-[3] rounded-xl border border-cyan-400/45 bg-slate-900/95 px-2.5 py-2 shadow-md ring-1 ring-cyan-500/20",
        signalsLinked && "border-emerald-500/40 ring-emerald-500/25",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Puzzle className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/90">
          Extensão · sinais
        </span>

        {extensionPresent ? (
          <span className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-300">
            {signalsLinked ? "Ligado" : "Instalada"}
          </span>
        ) : (
          <span className="rounded-md border border-amber-500/40 bg-amber-950/40 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">
            Sem extensão
          </span>
        )}

        {extensionPresent ? (
          <span className="rounded-md border border-slate-600/60 bg-slate-900/80 px-1.5 py-0.5 text-[8px] font-semibold text-slate-300">
            {placarWins}V · {placarLosses}D · {maxRecovery}g
          </span>
        ) : null}

        <button
          type="button"
          onClick={toggleReal}
          disabled={!enabled}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            !enabled && "opacity-40",
            realMode
              ? "border-red-500/50 bg-red-950/50 text-red-300"
              : "border-slate-600 bg-slate-900/80 text-slate-400",
          )}
        >
          {realMode ? "Real" : "Demo"}
        </button>

        <button
          type="button"
          onClick={toggle}
          className={cn(
            "ml-auto rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            enabled
              ? "border-emerald-500/50 bg-emerald-950/50 text-emerald-300"
              : "border-slate-600 bg-slate-900/80 text-slate-400",
          )}
        >
          {enabled ? "Activo" : "Parado"}
        </button>
      </div>
    </div>
  );
}
