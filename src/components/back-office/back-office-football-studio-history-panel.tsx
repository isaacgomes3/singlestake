import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Crown } from "lucide-react";

import {
  analyzeFootballStudioSidePatternByCard,
  findFootballStudioSidePatternAlert,
  footballStudioRoundHasAce,
} from "@/lib/evolution/footballStudioSidePatternByCard";
import type { FootballStudioSide } from "@/lib/evolution/footballStudioSidePatterns";
import type { TopCardRound } from "@/lib/evolution/topCardEvoParser";
import type {
  FootballStudioHubMessage,
  FootballStudioHubSnapshot,
} from "@/lib/server/footballStudio/types";
import { cn } from "@/lib/utils";

const COLOR_HISTORY_LIMIT = 48;

type SideTone = {
  chip: string;
  soft: string;
  bar: string;
  text: string;
  label: string;
  short: string;
};

const SIDE_TONES: Record<FootballStudioSide, SideTone> = {
  home: {
    chip: "bg-red-600 text-white border-red-400/40",
    soft: "bg-red-600/90 text-white",
    bar: "bg-red-500",
    text: "text-red-300",
    label: "Casa",
    short: "C",
  },
  away: {
    chip: "bg-blue-600 text-white border-blue-400/40",
    soft: "bg-blue-600/90 text-white",
    bar: "bg-blue-500",
    text: "text-blue-300",
    label: "Visitante",
    short: "V",
  },
  draw: {
    chip: "bg-emerald-600 text-white border-emerald-400/40",
    soft: "bg-emerald-700/90 text-emerald-50",
    bar: "bg-emerald-500",
    text: "text-emerald-300",
    label: "Empate",
    short: "E",
  },
};

function useFootballStudioHubHistory() {
  const [snap, setSnap] = useState<FootballStudioHubSnapshot | null>(null);
  const [live, setLive] = useState<"connecting" | "live" | "error">("connecting");

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const applySnapshot = (next: FootballStudioHubSnapshot) => {
      if (cancelled) return;
      setSnap(next);
    };

    const bootstrap = async () => {
      try {
        const res = await fetch("/api/evolution/football-studio", { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FootballStudioHubSnapshot;
        applySnapshot(data);
        if (!cancelled) setLive("live");
      } catch {
        if (!cancelled) setLive("error");
      }
    };

    void bootstrap();

    const url = new URL("/api/evolution/football-studio/stream", window.location.origin).href;
    source = new EventSource(url);
    source.onopen = () => {
      if (!cancelled) setLive("live");
    };
    source.onerror = () => {
      if (!cancelled) setLive("error");
    };
    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as FootballStudioHubMessage;
        if (msg.type === "ready" || msg.type === "snapshot") {
          applySnapshot(msg.snapshot);
        } else if (msg.type === "cards" || msg.type === "bridge-round" || msg.type === "status") {
          void bootstrap();
        }
      } catch {
        /* ignore malformed */
      }
    };

    pollTimer = setInterval(() => void bootstrap(), 12_000);

    return () => {
      cancelled = true;
      source?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const history = useMemo(() => {
    const cards = snap?.cardHistory ?? [];
    if (cards.length > 0) return cards;
    return (snap?.displayRounds ?? []).filter((r) => Boolean(r.home?.rank && r.away?.rank));
  }, [snap]);

  return { history, snap, live };
}

function maxSideStreak(
  historyNewestFirst: readonly { winner: FootballStudioSide }[],
  side: "home" | "away",
): number {
  let max = 0;
  let cur = 0;
  for (let i = historyNewestFirst.length - 1; i >= 0; i -= 1) {
    const w = historyNewestFirst[i]?.winner;
    if (w === side) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}

function buildColorStats(history: readonly TopCardRound[]) {
  let home = 0;
  let away = 0;
  let draw = 0;
  let aces = 0;
  for (const round of history) {
    if (round.winner === "home") home += 1;
    else if (round.winner === "away") away += 1;
    else if (round.winner === "draw") draw += 1;
    if (footballStudioRoundHasAce(round)) aces += 1;
  }
  const total = home + away + draw;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    home,
    away,
    draw,
    aces,
    total,
    homePct: pct(home),
    awayPct: pct(away),
    drawPct: pct(draw),
    maxHomeStreak: maxSideStreak(history, "home"),
    maxAwayStreak: maxSideStreak(history, "away"),
  };
}

function StatTile({
  title,
  value,
  pct,
  className,
  icon,
}: {
  title: string;
  value: number | string;
  pct?: number;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-black/20 px-3 py-3 shadow-inner", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-90">{title}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums leading-none">{value}</p>
      {pct != null ? (
        <p className="mt-1 text-xs font-semibold tabular-nums opacity-90">{pct}%</p>
      ) : null}
    </div>
  );
}

function DistributionBars({
  homePct,
  awayPct,
  drawPct,
}: {
  homePct: number;
  awayPct: number;
  drawPct: number;
}) {
  const rows: Array<{ key: FootballStudioSide; pct: number }> = [
    { key: "home", pct: homePct },
    { key: "away", pct: awayPct },
    { key: "draw", pct: drawPct },
  ];
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#080d18]/80 p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Distribuição
      </p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className={cn("w-20 text-xs font-semibold", SIDE_TONES[row.key].text)}>
              {SIDE_TONES[row.key].label}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-900">
              <div
                className={cn("h-full rounded-full transition-all", SIDE_TONES[row.key].bar)}
                style={{ width: `${Math.max(row.pct, row.pct > 0 ? 2 : 0)}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-300">
              {row.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorHistoryPanel({
  history,
  stats,
}: {
  history: readonly TopCardRound[];
  stats: ReturnType<typeof buildColorStats>;
}) {
  const rows = history.slice(0, COLOR_HISTORY_LIMIT);
  return (
    <section className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Histórico de cor
        </p>
        <p className="text-[11px] text-slate-400">
          Máxima{" "}
          <span className={cn("font-bold", SIDE_TONES.home.text)}>C {stats.maxHomeStreak}</span>
          {" · "}
          <span className={cn("font-bold", SIDE_TONES.away.text)}>V {stats.maxAwayStreak}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sem rondas ainda. Liga o feeder Dinhutech.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
          {rows.map((round, i) => {
            const tone = SIDE_TONES[round.winner] ?? SIDE_TONES.draw;
            const chipLabel =
              round.home?.rank && round.away?.rank
                ? `${round.home.rank}/${round.away.rank}`
                : tone.short;
            return (
              <span
                key={`${round.gameId}-color-${i}`}
                className={cn(
                  "inline-flex min-h-[2.6rem] items-center justify-center rounded-lg border px-1 text-center text-[11px] font-extrabold leading-tight sm:min-h-[2.85rem] sm:text-xs",
                  tone.chip,
                  i === 0 && "ring-2 ring-amber-300/80 ring-offset-1 ring-offset-[#0d1524]",
                )}
                title={`${tone.label} · ${chipLabel}`}
              >
                {chipLabel}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PatternStatColumn({
  title,
  hint,
  rows,
  accentClass,
  barClass,
}: {
  title: string;
  hint: string;
  rows: Array<{ card: number; label: string; hits: number; samples: number; rate: number }>;
  accentClass: string;
  barClass: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", accentClass)}>{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Sem amostra ainda.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={`${title}-${row.label}`}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#081221] px-2.5 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
                {i + 1}
              </span>
              <span className="w-8 text-center text-base font-black text-white">{row.label}</span>
              <div className="min-w-0 flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={cn("h-full rounded-full", barClass)}
                    style={{ width: `${Math.max(row.rate, row.rate > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-slate-200">
                {row.rate}%
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                {row.hits}/{row.samples}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidePatternStatsPanel({ history }: { history: readonly TopCardRound[] }) {
  const analysis = useMemo(
    () => analyzeFootballStudioSidePatternByCard(history, { top: 6, minSamples: 1 }),
    [history],
  );
  const alert = useMemo(
    () => findFootballStudioSidePatternAlert(history, { minSamples: 2 }),
    [history],
  );
  const indicationTone = alert ? SIDE_TONES[alert.indication] : null;

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Padrão de lado por carta
        </p>
        <span className="rounded-full border border-slate-700 bg-[#081221] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-300">
          {analysis.transitions} transições
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Após a carta sair: manter = mesmo lado vencedor na seguinte · mudar = lado oposto. Alerta
        quando a última ronda junta duas cartas 100% manter ou duas 100% mudar (≥2 amostras).
      </p>

      {alert && indicationTone ? (
        <div
          className="mb-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/35 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                Alerta · encontro 100% {alert.mode === "maintain" ? "mantém" : "muda"}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <span
                  className={cn(
                    "font-bold",
                    alert.mode === "maintain" ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {alert.homeLabel}
                </span>
                <span className="text-slate-500"> ({alert.homeSamples}×)</span>
                <span className="mx-1.5 text-slate-600">/</span>
                <span
                  className={cn(
                    "font-bold",
                    alert.mode === "maintain" ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {alert.awayLabel}
                </span>
                <span className="text-slate-500"> ({alert.awaySamples}×)</span>
                <span className="text-slate-400">
                  {" "}
                  · ambas {alert.mode === "maintain" ? "mantêm" : "mudam"} 100%
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {alert.mode === "maintain"
                  ? "Próxima ronda tende a repetir o lado vencedor actual"
                  : "Próxima ronda tende a inverter o lado vencedor actual"}
              </p>
            </div>
            <div
              className={cn(
                "shrink-0 rounded-xl px-4 py-2 text-center shadow-lg",
                indicationTone.soft,
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
                Indica
              </p>
              <p className="text-lg font-black leading-tight">{indicationTone.label}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <PatternStatColumn
          title="Mais mudam o padrão"
          hint="Lado vencedor troca na ronda seguinte"
          rows={analysis.changeSide}
          accentClass="text-rose-300"
          barClass="bg-rose-500"
        />
        <PatternStatColumn
          title="Mais mantêm o padrão"
          hint="Mesmo lado vencedor na ronda seguinte"
          rows={analysis.maintainSide}
          accentClass="text-emerald-300"
          barClass="bg-emerald-500"
        />
      </div>
    </section>
  );
}

/** Painel Automação → Football Studio: histórico Dinhutech idêntico ao Blitz. */
export function BackOfficeFootballStudioHistoryPanel() {
  const { history, snap, live } = useFootballStudioHubHistory();
  const colorStats = useMemo(() => buildColorStats(history), [history]);
  const liveLabel =
    live === "live" ? "ao vivo" : live === "connecting" ? "a ligar…" : "offline";
  const feedHint =
    colorStats.total === 0
      ? " · sem cartas no hub — corre npm run feeder:football-studio:dinhutech"
      : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Visor ao vivo Football Studio via hub Dinhutech — histórico de cor e padrão de lado por
        carta. Sem área de stream.
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100">Football Studio · Top Card</h3>
            <p className="text-xs text-slate-500">
              Dinhutech · {colorStats.total} rondas · hub {liveLabel}
              {snap?.bridgeStatus ? ` · bridge ${snap.bridgeStatus}` : ""}
              {feedHint}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            title={`Casa · ${SIDE_TONES.home.label}`}
            value={colorStats.home}
            pct={colorStats.homePct}
            className={SIDE_TONES.home.soft}
          />
          <StatTile
            title={`Visit · ${SIDE_TONES.away.label}`}
            value={colorStats.away}
            pct={colorStats.awayPct}
            className={SIDE_TONES.away.soft}
          />
          <StatTile
            title="Empate"
            value={colorStats.draw}
            pct={colorStats.drawPct}
            className={SIDE_TONES.draw.soft}
          />
          <StatTile
            title="Ás total"
            value={colorStats.aces}
            className="border-amber-500/40 bg-amber-400 text-black"
            icon={<Crown className="h-4 w-4 opacity-80" />}
          />
        </div>

        <DistributionBars
          homePct={colorStats.homePct}
          awayPct={colorStats.awayPct}
          drawPct={colorStats.drawPct}
        />

        <ColorHistoryPanel history={history} stats={colorStats} />
        <SidePatternStatsPanel history={history} />
      </div>
    </div>
  );
}
