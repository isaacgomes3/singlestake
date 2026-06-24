import { useEffect, useState } from "react";

import { Link } from "@tanstack/react-router";
import { Crown, Dices } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DamasLobbySlotSnapshot } from "@/lib/damas/types";

const STRIP =
  "flex min-h-[3.75rem] shrink-0 flex-col justify-center border-b px-3 py-2 text-center sm:min-h-[4rem]";

function CenterStatusBadge({
  line1,
  line2,
  tone,
}: {
  line1: string;
  line2: string;
  tone: "neutral" | "vip" | "live";
}) {
  const line2Class =
    tone === "vip"
      ? "text-amber-200"
      : tone === "live"
        ? "text-[#c4dc5a]"
        : "text-slate-200";
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-3 py-6 text-center sm:py-8"
      aria-live="polite"
    >
      <div
        className="rounded-xl border border-white/40 bg-white/22 px-2.5 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.22)] backdrop-blur-[10px] sm:px-3 sm:py-2"
        aria-hidden
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-black sm:text-[10px]">
          {line1}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-lg font-extrabold tabular-nums tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:text-2xl",
            line2Class,
          )}
        >
          {line2}
        </span>
      </div>
    </div>
  );
}

export function DamasLobbySlotCard({ slot }: { slot: DamasLobbySlotSnapshot }) {
  const isVip = slot.kind === "vip";
  const subtitle = isVip ? "Funcionamento programado" : `Casa · ${slot.roomId}`;
  const statusText = slot.footerStatus;

  const centerLine1 = "Sala VIP";
  const centerLine2 = "Em breve";
  const tone: "vip" | "live" | "neutral" = "vip";

  const borderShell = isVip
    ? "border-amber-500/45 ring-1 ring-amber-500/25 shadow-[0_0_28px_rgba(245,158,11,0.12)]"
    : "border-slate-800/80";

  const publicStatusUpper =
    statusText === "Em jogo" || statusText === "Partida terminada" ? "text-[#b8e86a]" : "text-emerald-300/95";

  const topStrip = isVip ? (
    <div
      className={cn(
        STRIP,
        "relative z-20 border-amber-500/40 bg-gradient-to-r from-amber-950 via-amber-900/85 to-amber-950",
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-200/95 sm:text-[10px]">
        Programado
      </p>
      <p className="mt-0.5 flex items-center justify-center gap-1.5 truncate text-sm font-extrabold tracking-tight text-white sm:text-base">
        <Crown className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        {slot.label}
      </p>
    </div>
  ) : (
    <div
      className={cn(
        STRIP,
        "relative z-20 border-emerald-700/40 bg-gradient-to-r from-emerald-950 via-slate-900/95 to-emerald-950",
      )}
      role="status"
      aria-live="polite"
      aria-label={`Estado da sala: ${statusText}`}
    >
      <p
        className={cn(
          "text-[9px] font-bold uppercase tracking-[0.22em] sm:text-[10px]",
          publicStatusUpper,
        )}
      >
        {statusText}
      </p>
      <p className="mt-0.5 flex items-center justify-center gap-1.5 truncate text-sm font-extrabold tracking-tight text-white sm:text-base">
        <Dices className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        {slot.label}
      </p>
    </div>
  );

  const body = (
    <article
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-[#0d1524] shadow-xl",
        borderShell,
      )}
    >
      {topStrip}
      <div
        className={cn(
          "relative aspect-[16/10] w-full shrink-0 overflow-hidden",
          isVip ? "bg-gradient-to-b from-slate-800 to-slate-950" : "bg-slate-950",
        )}
      >
        {isVip ? (
          <>
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(245,158,11,0.12), transparent), linear-gradient(180deg, rgba(15,23,42,0.95) 0%, transparent 50%)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Dices className="select-none text-6xl text-amber-500/15 sm:text-7xl" aria-hidden />
            </div>
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/damas/lobby-board.png)" }}
              role="img"
              aria-label="Tabuleiro de damas"
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(8,12,22,0.35) 0%, transparent 50%, rgba(8,12,22,0.25) 100%)",
              }}
              aria-hidden
            />
          </>
        )}
        {isVip ? <CenterStatusBadge line1={centerLine1} line2={centerLine2} tone={tone} /> : null}
      </div>
      <div className="flex shrink-0 items-start justify-between gap-2 border-t border-slate-800/90 px-3 py-2.5 sm:px-3.5 sm:py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h2 className="min-w-0 truncate text-sm font-bold tracking-tight text-white sm:text-base">
              {slot.label}
            </h2>
            {!isVip ? (
              <span className="shrink-0 whitespace-nowrap text-[10px] leading-tight sm:text-[11px]">
                <span className="font-semibold uppercase tracking-wide text-slate-500">Jogadores </span>
                <span className="font-bold tabular-nums text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]">
                  {slot.playerCount}/2
                </span>
              </span>
            ) : null}
          </div>
          {isVip ? (
            <p className="mt-0.5 truncate text-[10px] text-slate-400 sm:text-[11px]">{statusText}</p>
          ) : null}
          <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-[11px]">{subtitle}</p>
        </div>
        <span className="shrink-0 self-center text-base text-slate-600 sm:text-lg" aria-hidden>
          ♡
        </span>
      </div>
    </article>
  );

  if (isVip) {
    return (
      <div className="block h-full min-h-0 cursor-not-allowed rounded-2xl opacity-95" title={slot.footerStatus}>
        {body}
      </div>
    );
  }

  return (
    <Link
      to="/damas"
      search={{ room: slot.roomId }}
      className="block h-full min-h-0 rounded-2xl outline-none transition hover:opacity-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a14]"
      aria-label={`${slot.label}: ${slot.footerStatus}. Abrir sala de damas.`}
    >
      {body}
    </Link>
  );
}

export function DamasLobbyGrid() {
  const [slots, setSlots] = useState<DamasLobbySlotSnapshot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/damas?lobby=1");
        const j = (await res.json()) as { slots?: DamasLobbySlotSnapshot[] };
        if (!cancelled && Array.isArray(j.slots)) setSlots(j.slots);
      } catch {
        if (!cancelled) setSlots(null);
      }
    };
    void load();
    const t = setInterval(() => void load(), 2800);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!slots) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[320px] animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/40"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {slots.map((s) => (
        <DamasLobbySlotCard key={s.roomId} slot={s} />
      ))}
    </div>
  );
}