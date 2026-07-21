import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { BackOfficeWorkspaceNav } from "@/components/back-office/back-office-workspace-nav";
import { RouletteStatCard } from "@/components/roulette-stat-card";
import {
  analyzeFootballStudioSidePatterns,
  footballStudioSideLabel,
  type FootballStudioSide,
} from "@/lib/evolution/footballStudioSidePatterns";
import type { TopCardParsedCard } from "@/lib/evolution/topCardEvoParser";
import { formatTopCardLabel } from "@/lib/evolution/topCardEvoParser";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
import type {
  FootballStudioDisplayRound,
  FootballStudioHubMessage,
  FootballStudioHubSnapshot,
} from "@/lib/server/footballStudio/types";
import { cn } from "@/lib/utils";

const HISTORY_GRID_SIZE = 16;

const SIDE_CHIP: Record<FootballStudioSide, string> = {
  home: "bg-red-600 text-white border-red-400/40",
  away: "bg-blue-600 text-white border-blue-400/40",
  draw: "bg-emerald-600 text-white border-emerald-400/40",
};

const BRIDGE_STATUS_LABEL: Record<FootballStudioHubSnapshot["bridgeStatus"], string> = {
  idle: "A iniciar…",
  ok: "Bridge OK",
  error: "Bridge erro",
  "no-key": "Sem API key",
};

function cardText(card: TopCardParsedCard | null | undefined): string {
  return formatTopCardLabel(card) || "—";
}

function RoundChip({
  round,
  highlight,
}: {
  round: FootballStudioDisplayRound | null;
  highlight?: boolean;
}) {
  if (!round) {
    return (
      <span className="inline-flex min-h-[2.25rem] items-center justify-center rounded-md border border-dashed border-slate-700 bg-[#0b1729] text-[9px] font-semibold text-slate-600">
        ·
      </span>
    );
  }
  const homeLabel = formatTopCardLabel(round.home);
  const awayLabel = formatTopCardLabel(round.away);
  const hasCards = Boolean(homeLabel && awayLabel);
  return (
    <span
      className={cn(
        "inline-flex min-h-[2.4rem] items-center justify-center rounded-md border px-0.5 py-0.5 text-center leading-tight",
        SIDE_CHIP[round.winner],
        highlight && "ring-2 ring-amber-300 ring-offset-1 ring-offset-[#080d18]",
      )}
      title={
        hasCards
          ? `Casa ${homeLabel} · Visitante ${awayLabel} → ${footballStudioSideLabel(round.winner)}`
          : footballStudioSideLabel(round.winner)
      }
    >
      {hasCards ? (
        <span className="max-w-full px-0.5 text-[10px] font-extrabold tracking-tight">
          {homeLabel}/{awayLabel}
        </span>
      ) : (
        <span className="text-[10px] font-bold opacity-40">·</span>
      )}
    </span>
  );
}

export function FootballStudioHubPage() {
  const [snap, setSnap] = useState<FootballStudioHubSnapshot | null>(null);
  const [live, setLive] = useState<"connecting" | "live" | "error">("connecting");

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let sseLive = false;

    const applySnapshot = (next: FootballStudioHubSnapshot) => {
      if (cancelled) return;
      setSnap((prev) => {
        // Evita flicker: ignora snapshot mais antigo que o actual.
        if (
          prev?.updatedAt &&
          next.updatedAt &&
          Date.parse(next.updatedAt) < Date.parse(prev.updatedAt)
        ) {
          return prev;
        }
        // Mesmo conteúdo de visor → não re-render desnecessário.
        if (
          prev?.lastCards?.gameId &&
          next.lastCards?.gameId === prev.lastCards.gameId &&
          prev.lastCards.winner === next.lastCards?.winner &&
          prev.ecoSignal?.signalId === next.ecoSignal?.signalId &&
          prev.displayRounds[0]?.gameId === next.displayRounds[0]?.gameId &&
          prev.history[0]?.gameId === next.history[0]?.gameId
        ) {
          return {
            ...next,
            // mantém referência estável do lastCards se igual
            lastCards: prev.lastCards,
          };
        }
        return next;
      });
    };

    const bootstrap = async () => {
      try {
        const res = await fetch("/api/evolution/football-studio", { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FootballStudioHubSnapshot;
        applySnapshot(data);
      } catch {
        /* SSE / poll tentam de novo */
      }
    };

    void bootstrap();

    const url = new URL("/api/evolution/football-studio/stream", window.location.origin).href;
    source = new EventSource(url);
    source.onopen = () => {
      sseLive = true;
      if (!cancelled) setLive("live");
    };
    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as FootballStudioHubMessage;
        if (msg.type === "ready" || msg.type === "snapshot") {
          applySnapshot(msg.snapshot);
          sseLive = true;
          if (!cancelled) setLive("live");
        } else if (msg.type === "status") {
          setSnap((prev) =>
            prev
              ? {
                  ...prev,
                  bridgeStatus: msg.bridgeStatus,
                  lastError: msg.message ?? prev.lastError,
                }
              : prev,
          );
        }
      } catch {
        /* ignore parse */
      }
    };
    source.onerror = () => {
      sseLive = false;
      if (!cancelled) setLive("error");
    };

    // Poll só como fallback se SSE cair (evita oscilar com updates duplicados).
    pollTimer = setInterval(() => {
      if (!sseLive) void bootstrap();
    }, 5_000);

    return () => {
      cancelled = true;
      source?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const patterns = useMemo(
    () => analyzeFootballStudioSidePatterns(snap?.history ?? [], { minSamples: 2 }),
    [snap?.history],
  );

  const displayRounds = snap?.displayRounds ?? [];
  const lastCards = snap?.lastCards ?? null;
  const head = displayRounds[0] ?? lastCards;
  const gridSlots = Array.from({ length: HISTORY_GRID_SIZE }, (_, i) => displayRounds[i] ?? null);

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="mb-3 rounded-xl border border-emerald-950/30 bg-[#060a14]/90 px-3 py-2 text-center text-sm text-slate-400">
          Football Studio / Top Card
          <span className="text-slate-500"> · DinhuTech cartas · hub 24h</span>
        </p>

        <BackOfficeWorkspaceNav />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
                live === "live"
                  ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-200"
                  : live === "error"
                    ? "border-rose-700/60 bg-rose-950/40 text-rose-200"
                    : "border-slate-700 bg-slate-900/80 text-slate-300",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  live === "live"
                    ? "bg-emerald-400"
                    : live === "error"
                      ? "bg-rose-400"
                      : "bg-slate-500",
                )}
              />
              {live === "live" ? "Ao vivo" : live === "error" ? "SSE interrompido" : "A ligar…"}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2.5 py-1">
              {snap ? BRIDGE_STATUS_LABEL[snap.bridgeStatus] : "—"}
            </span>
            {snap?.updatedAt ? (
              <span className="text-slate-500">
                act. {new Date(snap.updatedAt).toLocaleTimeString("pt-BR")}
              </span>
            ) : null}
          </div>
          <Link
            to={BACK_OFFICE_PATHS.home}
            className="text-cyan-400 hover:text-cyan-300"
          >
            ← Back office
          </Link>
        </div>

        <section className="mt-6 overflow-x-auto pb-2 [scrollbar-width:thin] md:overflow-visible md:pb-0">
          <div className="mx-auto grid min-w-[28rem] max-w-6xl grid-cols-4 gap-3 md:min-w-0 md:w-full">
            <RouletteStatCard
              label="Rondas Bridge"
              value={snap?.history.length ?? 0}
              variant="lobby"
            />
            <RouletteStatCard
              label="Com cartas"
              value={snap?.cardsWithSuits ?? 0}
              tone="green"
              variant="lobby"
            />
            <RouletteStatCard
              label="Transições"
              value={patterns.coloredTransitions}
              variant="lobby"
            />
            <RouletteStatCard
              label="100% (≥2)"
              value={patterns.perfectTransitions.length}
              tone="green"
              variant="lobby"
            />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800/80 bg-[#0d1524] p-5 sm:p-6">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Última ronda
          </p>
          <p
            className={cn(
              "mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl",
              head?.winner === "home"
                ? "text-red-400"
                : head?.winner === "away"
                  ? "text-blue-400"
                  : head?.winner === "draw"
                    ? "text-emerald-400"
                    : "text-slate-500",
            )}
          >
            {head ? footballStudioSideLabel(head.winner) : "Aguardando…"}
          </p>
          <p className="mt-2 text-center text-sm text-slate-300">
            Casa{" "}
            <span className="font-bold text-red-300">
              {cardText(head?.home ?? lastCards?.home)}
            </span>
            {" · "}
            Visitante{" "}
            <span className="font-bold text-blue-300">
              {cardText(head?.away ?? lastCards?.away)}
            </span>
          </p>
          {snap?.ecoSignal ? (
            <div
              className={cn(
                "mt-4 rounded-2xl border px-4 py-3 text-center",
                snap.ecoSignal.indication === "home"
                  ? "border-red-500/50 bg-red-950/40"
                  : "border-blue-500/50 bg-blue-950/40",
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                Coincidência · entrada
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-black sm:text-3xl",
                  snap.ecoSignal.indication === "home" ? "text-red-300" : "text-blue-300",
                )}
              >
                {footballStudioSideLabel(snap.ecoSignal.indication)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Gatilho {snap.ecoSignal.triggerHomeRank}/{snap.ecoSignal.triggerAwayRank}{" "}
                {footballStudioSideLabel(snap.ecoSignal.triggerWinner).toLowerCase()} · 2
                ocorrências 100% · cor à esquerda
              </p>
            </div>
          ) : (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Sem alerta — aguarda 2 ocorrências exactas com a mesma cor à esquerda
            </p>
          )}
          {snap?.note ? (
            <p className="mt-3 text-center text-[11px] text-slate-500">{snap.note}</p>
          ) : null}
          {snap?.lastError ? (
            <p className="mt-2 text-center text-[11px] text-rose-300">{snap.lastError}</p>
          ) : null}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Histórico (16)
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {gridSlots.map((round, i) => {
              const matchIds = new Set(snap?.ecoSignal?.referenceGameIds?.map(String) ?? []);
              const isMatch = round?.gameId != null && matchIds.has(String(round.gameId));
              const isTrigger =
                snap?.ecoSignal != null && String(round?.gameId) === String(snap.ecoSignal.triggerGameId);
              return (
                <RoundChip
                  key={round?.gameId ?? `empty-${i}`}
                  round={round}
                  highlight={i === 0 || isMatch || isTrigger}
                />
              );
            })}
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Após X → próximo (100%)
            </p>
            {patterns.perfectTransitions.length === 0 ? (
              <p className="text-sm text-slate-500">Sem padrões 100% ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {patterns.perfectTransitions.slice(0, 8).map((row) => (
                  <li
                    key={`${row.from}-${row.to}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#081221] px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-semibold text-slate-200">{row.fromLabel}</span>
                      <span className="text-slate-500"> → </span>
                      <span className="font-semibold text-cyan-200">{row.toLabel}</span>
                    </span>
                    <span className="tabular-nums text-xs text-emerald-300">
                      {row.hits}/{row.samples}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Top transições
            </p>
            {patterns.transitions.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados de transição.</p>
            ) : (
              <ul className="space-y-1.5">
                {patterns.transitions.slice(0, 8).map((row) => (
                  <li
                    key={`top-${row.from}-${row.to}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#081221] px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-semibold text-slate-200">{row.fromLabel}</span>
                      <span className="text-slate-500"> → </span>
                      <span className="font-semibold text-slate-300">{row.toLabel}</span>
                    </span>
                    <span className="tabular-nums text-xs text-slate-400">
                      {row.rate}% · {row.hits}/{row.samples}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {patterns.perfectDigrams.length > 0 ? (
          <section className="mt-5 rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Digramas 100%
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {patterns.perfectDigrams.slice(0, 10).map((row) => (
                <li
                  key={`${row.first}-${row.second}-${row.next}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#081221] px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    {row.firstLabel}+{row.secondLabel}
                    <span className="text-slate-500"> → </span>
                    <span className="font-semibold text-cyan-200">{row.nextLabel}</span>
                  </span>
                  <span className="tabular-nums text-xs text-emerald-300">
                    {row.hits}/{row.samples}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
