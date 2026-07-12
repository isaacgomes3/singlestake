import { AlertTriangle, RotateCcw } from "lucide-react";

import {
  sequenciasAlertTypeLabel,
  sequenciasBestCardKind,
  type SequenciasAlertType,
  type SequenciasFactorCard,
  type SequenciasMonitorState,
} from "@/lib/roulette/sequenciasStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { colorOf } from "@/lib/roulette/streetPairTrigger";
import { cn } from "@/lib/utils";

type Props = {
  state: SequenciasMonitorState;
  tableId: number | null;
  history: readonly number[];
  onReset: () => void;
  /** Dentro do módulo do back office (evita título duplicado). */
  embedded?: boolean;
};

function FactorCard({
  title,
  kind,
  card,
  best,
  assertiveness,
}: {
  title: string;
  kind: SequenciasAlertType;
  card: SequenciasFactorCard;
  best: SequenciasAlertType | null;
  assertiveness: number;
}) {
  const isBest = best === kind;
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3 text-slate-900 shadow-sm",
        isBest ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300/60" : "border-slate-200",
      )}
    >
      <h3 className="mb-2 flex items-center gap-1 text-sm font-bold">
        {title}
        {isBest ? <span aria-hidden>⚡</span> : null}
      </h3>
      <div className="flex justify-between text-xs text-slate-600">
        <span>Vitórias:</span>
        <span className="font-bold text-emerald-600">{card.wins}</span>
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-600">
        <span>Derrotas:</span>
        <span className="font-bold text-red-600">{card.losses}</span>
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-600">
        <span>Último:</span>
        <span
          className={cn(
            "font-bold",
            card.last === "VERMELHO" || card.last === "Vermelho"
              ? "text-red-600"
              : "text-slate-900",
          )}
        >
          {card.last ?? "—"}
        </span>
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Assertividade {assertiveness}%
      </div>
    </div>
  );
}

export function SequenciasMonitorPanel({
  state,
  tableId,
  history,
  onReset,
  embedded = false,
}: Props) {
  const best = sequenciasBestCardKind(state);
  const alert = state.alert;
  const recent = history.slice(0, 16);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? (
            <p className="text-sm text-text-secondary">
              Monitor cor / altura / paridade — sequência limpa (≥2) ou suja (A·A·B·A)
              {tableId != null ? (
                <>
                  {" "}
                  · mesa{" "}
                  <span className="font-semibold text-text-primary">
                    {lobbyTableDisplayName(tableId)}
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            <>
              <h1 className="text-xl font-bold text-text-primary">Automação · Sequências</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Monitor cor / altura / paridade — sequência limpa (≥2) ou suja (A·A·B·A)
                {tableId != null ? (
                  <>
                    {" "}
                    · mesa{" "}
                    <span className="font-semibold text-text-primary">
                      {lobbyTableDisplayName(tableId)}
                    </span>
                  </>
                ) : null}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-card px-3 py-2 text-xs font-semibold text-text-secondary hover:border-info/40 hover:text-text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Zerar placar
        </button>
      </div>

      {alert ? (
        <div className="rounded-2xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-950/50 to-slate-950/80 px-4 py-4 shadow-lg shadow-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/90">
                Indicação activa · {sequenciasAlertTypeLabel(alert.type)}
                {alert.isDirty ? " · sequência suja" : " · sequência limpa"}
              </p>
              <p className="mt-1 text-3xl font-black tracking-tight text-amber-50">
                {alert.suggestion}
              </p>
              <p className="mt-2 font-mono text-sm text-amber-100/90">
                Confiança {alert.confidence}% · streak {alert.winStreak}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-color bg-bg-card/60 px-4 py-3 text-center text-sm text-text-secondary">
          Sem indicação — aguarda sequência ≥2 (ou padrão sujo com 4+ números)
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FactorCard
          title="Paridade"
          kind="parity"
          card={state.cards.parity}
          best={best}
          assertiveness={state.assertiveness.parity}
        />
        <FactorCard
          title="Cor"
          kind="color"
          card={state.cards.color}
          best={best}
          assertiveness={state.assertiveness.color}
        />
        <FactorCard
          title="Altura"
          kind="height"
          card={state.cards.height}
          best={best}
          assertiveness={state.assertiveness.height}
        />
      </div>

      <div className="rounded-2xl border border-border-color bg-bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-text-primary">Estatísticas Gerais</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Rodadas Totais:</span>
            <span className="font-semibold text-text-primary">{state.totalRounds}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Vitórias:</span>
            <span className="font-bold text-emerald-500">{state.sessionWins}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Derrotas:</span>
            <span className="font-bold text-red-500">{state.sessionLosses}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Histórico (mesa):</span>
            <span className="font-semibold text-text-primary">{history.length}</span>
          </div>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="rounded-2xl border border-border-color bg-bg-card/80 p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">
            Últimos giros (mais recente à esquerda)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((n, i) => {
              const col = colorOf(n);
              return (
                <span
                  key={`${i}-${n}`}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-bold",
                    col === "Zero"
                      ? "bg-emerald-700 text-white"
                      : col === "Vermelho"
                        ? "bg-red-600 text-white"
                        : "bg-slate-800 text-white",
                  )}
                >
                  {n}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
