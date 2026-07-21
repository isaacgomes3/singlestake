import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { FootballStudioHubSnapshot } from "@/lib/server/footballStudio/types";
import { footballStudioSideLabel } from "@/lib/evolution/footballStudioSidePatterns";
import { cn } from "@/lib/utils";

export function FootballStudioLobbyCard() {
  const [snap, setSnap] = useState<FootballStudioHubSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/evolution/football-studio", { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as FootballStudioHubSnapshot;
        if (!cancelled) setSnap(data);
      } catch {
        /* hub offline */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 8_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const head = snap?.displayRounds?.[0] ?? null;
  const preview = (snap?.displayRounds ?? []).slice(0, 7);

  const article = (
    <article
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-[#0d1524] shadow-lg shadow-black/30",
        head ? "border-emerald-700/40" : "border-slate-800/80",
      )}
    >
      <div className="relative z-20 grid min-h-[2.25rem] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 border-b border-transparent px-1.5 py-1 sm:min-h-[2.5rem] sm:px-2 sm:py-1.5">
        <div className="flex min-w-0 items-center justify-start" aria-hidden>
          <span className="inline-flex h-5 w-5 shrink-0" />
        </div>
        <div className="flex min-w-0 max-w-full flex-col items-center justify-center px-1 text-center">
          <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[8px]">
            Evolution · Hub
          </p>
          <p className="mx-auto mt-0.5 max-w-[10rem] truncate text-[11px] font-extrabold leading-tight tracking-tight text-white sm:max-w-none sm:text-xs">
            Football Studio
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end">
          <span className="inline-flex shrink-0 items-center rounded-md border border-slate-600/90 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-slate-200 sm:text-[8px]">
            Top Card
          </span>
        </div>
      </div>

      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-950 to-[#060a14]">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(16,185,129,0.25), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <p
            className={cn(
              "text-2xl font-extrabold tracking-tight sm:text-3xl",
              head?.winner === "home"
                ? "text-red-400"
                : head?.winner === "away"
                  ? "text-blue-400"
                  : head?.winner === "draw"
                    ? "text-emerald-400"
                    : "text-slate-500",
            )}
          >
            {head ? footballStudioSideLabel(head.winner) : "—"}
          </p>
          {head?.home?.label && head?.away?.label ? (
            <p className="mt-1 text-[10px] text-slate-300">
              {head.home.label} · {head.away.label}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-slate-500">
              {snap ? `${snap.cardsWithSuits} com cartas` : "Aguardando hub…"}
            </p>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-nowrap justify-center gap-0.5 overflow-x-auto bg-gradient-to-t from-black via-black/75 to-transparent px-1 pb-1.5 pt-5">
          {preview.length === 0 ? (
            <span className="text-[9px] text-slate-500">Sem rondas</span>
          ) : (
            preview.map((round, i) => (
              <span
                key={`${round.gameId}-${i}`}
                className={cn(
                  "inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded border px-0.5 text-[8px] font-bold",
                  round.winner === "home" && "border-red-400/50 bg-red-600 text-white",
                  round.winner === "away" && "border-blue-400/50 bg-blue-600 text-white",
                  round.winner === "draw" && "border-emerald-400/50 bg-emerald-600 text-white",
                  i === 0 && "ring-1 ring-amber-300",
                )}
              >
                {round.home?.label && round.away?.label
                  ? `${round.home.label}/${round.away.label}`
                  : "·"}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-start justify-between gap-1.5 border-t border-slate-800/90 px-2 py-1.5 sm:px-2.5 sm:py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[11px] font-bold text-white sm:text-xs">Football Studio</h2>
          <p className="mt-0.5 truncate text-[8px] text-slate-500 sm:text-[9px]">
            {snap
              ? `${snap.history.length} rondas · Bridge ${snap.bridgeStatus} · abrir hub`
              : "Clique para abrir hub ao vivo"}
          </p>
        </div>
        <span className="shrink-0 self-center text-xs text-slate-600" aria-hidden>
          ♠
        </span>
      </div>
    </article>
  );

  return (
    <div className="relative block h-full min-h-0 rounded-2xl outline-none transition focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2 focus-within:ring-offset-[#060a14]">
      <Link
        to="/football-studio"
        className="absolute inset-0 z-[1] rounded-2xl"
        aria-label="Football Studio: abrir hub ao vivo"
      />
      <div className="relative z-[2] pointer-events-none h-full min-h-0">{article}</div>
    </div>
  );
}
