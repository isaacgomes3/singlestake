import { FootballBlitzSpreadBadge } from "@/components/football-blitz-spread-badge";
import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import {
  FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS,
  type FootballBlitzRoundStored,
} from "@/lib/pragmatic/dgaFootballBlitzHistory";
import {
  superTrunfoGridPositionToIndex,
  SUPER_TRUNFO_GRID_POS_ALERT,
  SUPER_TRUNFO_GRID_POS_CRITICAL_1,
  SUPER_TRUNFO_GRID_POS_CRITICAL_12,
} from "@/lib/pragmatic/superTrunfoAlert";

export const FOOTBALL_BLITZ_HISTORY_GRID_COLS = 11;
export const FOOTBALL_BLITZ_HISTORY_GRID_ROWS = 2;
export const FOOTBALL_BLITZ_HISTORY_GRID_CELLS = FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS;

function gridRoleForIndex(index: number): "critical" | "alert" | undefined {
  if (
    index === superTrunfoGridPositionToIndex(SUPER_TRUNFO_GRID_POS_CRITICAL_1) ||
    index === superTrunfoGridPositionToIndex(SUPER_TRUNFO_GRID_POS_CRITICAL_12)
  ) {
    return "critical";
  }
  if (index === superTrunfoGridPositionToIndex(SUPER_TRUNFO_GRID_POS_ALERT)) {
    return "alert";
  }
  return undefined;
}
type GridProps = {
  history: readonly FootballBlitzRoundStored[];
  variant: FootballBlitzTableVariant;
};

/** Grelha 11×2: índice 0 = mais recente no canto superior esquerdo, leitura em linhas. */
export function FootballBlitzHistoryGrid11x2({ history, variant }: GridProps) {
  if (history.length === 0) {
    return (
      <div className="flex justify-center py-3">
        <span className="text-xs text-slate-500">Sem rondas ainda.</span>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[min(100%,520px)] grid-cols-11 gap-0.5 sm:gap-1">
      {Array.from({ length: FOOTBALL_BLITZ_HISTORY_GRID_CELLS }, (_, i) => {
        const round = history[i];
        const empty = round === undefined;
        return (
          <div
            key={`fb-grid-${i}`}
            className={`flex aspect-square min-h-[26px] min-w-0 items-center justify-center rounded-md border sm:min-h-[30px] ${
              empty ? "border-slate-800/60 bg-slate-950/40" : "border-transparent bg-transparent"
            }`}
          >
            {empty ? (
              <span className="text-[10px] text-slate-700/25">{"\u00a0"}</span>
            ) : (
              <FootballBlitzSpreadBadge
                round={round}
                variant={variant}
                highlight={i === 0}
                gridRole={gridRoleForIndex(i)}
              />            )}
          </div>
        );
      })}
    </div>
  );
}

type SectionProps = GridProps & {
  tableKey?: number;
  sectionClassName?: string;
};

export function FootballBlitzHistoryGrid11x2Section({
  history,
  variant,
  tableKey,
  sectionClassName,
}: SectionProps) {
  return (
    <section
      className={
        sectionClassName ??
        "mx-auto mt-4 max-w-4xl rounded-2xl border border-emerald-950/25 bg-[#0d1524]/90 px-2 py-2.5 shadow-lg shadow-black/20 sm:px-3"
      }
      aria-label={`Últimas ${FOOTBALL_BLITZ_HISTORY_GRID_CELLS} rondas em grelha ${FOOTBALL_BLITZ_HISTORY_GRID_COLS} por ${FOOTBALL_BLITZ_HISTORY_GRID_ROWS}`}
    >
      {history.length === 0 && tableKey != null ? (
        <div className="flex justify-center py-3">
          <span className="text-xs text-slate-500">Aguardando rondas da mesa {tableKey}…</span>
        </div>
      ) : (
        <FootballBlitzHistoryGrid11x2 history={history} variant={variant} />
      )}
    </section>
  );
}
