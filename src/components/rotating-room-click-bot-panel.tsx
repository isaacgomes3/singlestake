import { Bot, Eraser, MousePointerClick, Puzzle, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";

import {
  useRotatingRoomClickBotLearning,
  type ClickBotLearningMode,
} from "@/hooks/useRotatingRoomClickBotLearning";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import {
  isLikelyExtensionBridgeOrigin,
  pingRotatingRoomExtension,
  ROTATING_ROOM_EXTENSION_PONG_TYPE,
} from "@/lib/roulette/rotatingRoomExtensionBridge";
import { cn } from "@/lib/utils";

type Props = {
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession;
};

export function RotatingRoomClickBotPanel({ session }: Props) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<ClickBotLearningMode>("dry");

  const { log, clearLog, currentPlan } = useRotatingRoomClickBotLearning({
    session,
    enabled: open && enabled,
    mode,
  });

  const [extensionPresent, setExtensionPresent] = useState(false);
  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  useEffect(() => {
    if (!open || mode !== "extension") {
      setExtensionPresent(false);
      return;
    }

    const onPong = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { type?: string };
      if (data?.type === ROTATING_ROOM_EXTENSION_PONG_TYPE) setExtensionPresent(true);
    };

    window.addEventListener("message", onPong);
    pingRotatingRoomExtension();
    const interval = window.setInterval(pingRotatingRoomExtension, 2000);

    return () => {
      window.removeEventListener("message", onPong);
      window.clearInterval(interval);
    };
  }, [open, mode]);

  return (
    <div className="rounded-xl border border-violet-500/35 bg-violet-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-violet-200/90"
      >
        <span className="inline-flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          Bot de clique (aprendizagem)
        </span>
        <span className="text-[10px] text-violet-300/70">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-violet-500/25 px-3 py-3">
          <p className="text-[10px] leading-relaxed text-violet-200/75">
            Lê o estado da <strong className="font-semibold text-violet-100">Sala Rotativa</strong>.
            Modos <strong className="font-semibold text-violet-100">Só log</strong> e{" "}
            <strong className="font-semibold text-violet-100">Clicar UI</strong> actuam no painel desta app.
            Modo <strong className="font-semibold text-violet-100">Extensão</strong> envia o plano à extensão
            Chrome (pasta <code className="text-violet-100/90">extension/</code>) — aí sim pode injectar no
            iframe da mesa.
          </p>

          {mode === "extension" ? (
            <div className="space-y-1">
              <p
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[10px]",
                  extensionPresent
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200/90"
                    : "border-amber-500/40 bg-amber-950/25 text-amber-200/90",
                )}
              >
                {extensionPresent
                  ? "Extensão detectada nesta página."
                  : "Extensão não detectada nesta página."}
              </p>
              {!extensionPresent ? (
                <ul className="list-inside list-disc space-y-0.5 text-[10px] text-amber-200/80">
                  <li>
                    Recarregue esta página (<strong className="font-semibold">F5</strong>) depois de
                    instalar a extensão.
                  </li>
                  <li>
                    Em <code className="text-amber-100">chrome://extensions</code>, clique{" "}
                    <strong className="font-semibold">Recarregar</strong> na extensão GOG (v0.1.1).
                  </li>
                  <li>
                    URL actual: <code className="text-amber-100">{pageOrigin}</code>
                    {!isLikelyExtensionBridgeOrigin(pageOrigin)
                      ? " — não está na lista por defeito; edite manifest.json"
                      : null}
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                enabled
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                  : "border-slate-600 text-slate-400",
              )}
            >
              {enabled ? "Activo" : "Parado"}
            </button>

            <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/80 p-0.5">
              <button
                type="button"
                onClick={() => setMode("dry")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold",
                  mode === "dry" ? "bg-slate-600 text-white" : "text-slate-400",
                )}
              >
                <ScrollText className="h-3 w-3" aria-hidden />
                Só log
              </button>
              <button
                type="button"
                onClick={() => setMode("click")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold",
                  mode === "click" ? "bg-slate-600 text-white" : "text-slate-400",
                )}
              >
                <MousePointerClick className="h-3 w-3" aria-hidden />
                Clicar UI
              </button>
              <button
                type="button"
                onClick={() => setMode("extension")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold",
                  mode === "extension" ? "bg-slate-600 text-white" : "text-slate-400",
                )}
              >
                <Puzzle className="h-3 w-3" aria-hidden />
                Extensão
              </button>
            </div>

            <button
              type="button"
              onClick={clearLog}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
            >
              <Eraser className="h-3 w-3" aria-hidden />
              Limpar
            </button>
          </div>

          <div className="rounded-lg border border-slate-800/80 bg-[#060a14]/80 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Plano actual</p>
            <ul className="mt-1 space-y-1">
              {currentPlan.map((action, i) => (
                <li key={i} className="text-[11px] text-slate-300">
                  {action.kind === "wait" ? (
                    <span className="text-slate-500">⏳ {action.reason}</span>
                  ) : (
                    <span>
                      <span className="font-semibold text-cyan-300/90">[{action.target}]</span>{" "}
                      {action.label}
                      <span className="text-slate-500"> — {action.reason}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800/80 bg-black/40 px-2 py-1.5 [scrollbar-width:thin]">
            {log.length === 0 ? (
              <p className="py-2 text-center text-[10px] text-slate-600">Sem eventos ainda.</p>
            ) : (
              <ul className="space-y-2">
                {log.map((row) => (
                  <li key={row.id} className="border-b border-slate-800/60 pb-2 last:border-0">
                    <p className="text-[9px] tabular-nums text-slate-500">{row.at}</p>
                    {row.actions.map((action, i) => (
                      <p key={i} className="text-[10px] text-slate-400">
                        {action.kind === "wait"
                          ? `⏳ ${action.reason}`
                          : `🖱 ${action.target} → ${action.label}`}
                      </p>
                    ))}
                    {row.extensionAck === false && mode === "extension" ? (
                      <p className="text-[10px] text-violet-400/80">… à espera da extensão</p>
                    ) : null}
                    {row.executed?.map((ex, i) => (
                      <p
                        key={`ex-${i}`}
                        className={cn(
                          "text-[10px]",
                          ex.ok ? "text-emerald-400/90" : "text-amber-400/90",
                        )}
                      >
                        {ex.ok ? "✓" : "⚠"} {ex.detail}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
