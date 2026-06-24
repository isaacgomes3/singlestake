import { colorOf } from "@/lib/roulette/streetStrategy";
import { heightOf } from "@/lib/roulette/streetPairTrigger";
import { cn } from "@/lib/utils";

export const ROULETTE_HISTORY_GRID_COLS = 11;
export const ROULETTE_HISTORY_GRID_ROWS = 3;
export const ROULETTE_HISTORY_GRID_ROWS_2 = 2;
export const ROULETTE_HISTORY_GRID_CELLS = ROULETTE_HISTORY_GRID_COLS * ROULETTE_HISTORY_GRID_ROWS;

export type RouletteHistoryGridColorMode = "color" | "height";

function spinHistoryMatBadgeClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

/** Metade Baixo 1–18 vs Alto 19–36 (zero à parte). */
function spinHistoryHeightBadgeClass(n: number) {
  const h = heightOf(n);
  if (h === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (h === "Baixo") return "border-sky-400/45 bg-sky-700/90 text-sky-50";
  return "border-rose-400/45 bg-rose-800/90 text-rose-50";
}

type GridRows = 1 | typeof ROULETTE_HISTORY_GRID_ROWS_2 | typeof ROULETTE_HISTORY_GRID_ROWS;

export type RouletteHistoryGridCellRole = "compare" | "base";

type GridProps = {
  history: readonly number[];
  /** `1` = só a primeira linha (11 giros); `2` = 11×2 (22); `3` = grelha completa 11×3 (33). */
  rows?: GridRows;
  /** `color` = vermelho/preto; `height` = metade Baixo 1–18 / Alto 19–36. */
  colorMode?: RouletteHistoryGridColorMode;
  /** Realce de posições críticas (ex.: Ruas 9% pos. 1, 11 e 12). */
  cellRoleForIndex?: (index: number) => RouletteHistoryGridCellRole | undefined;
};

/** Grelha 11×N (N=1, 2 ou 3): índice 0 = mais recente no canto superior esquerdo, leitura em linhas. */
export function RouletteHistoryGrid11x3({
  history,
  rows = ROULETTE_HISTORY_GRID_ROWS,
  colorMode = "color",
  cellRoleForIndex,
}: GridProps) {
  const rowCount = rows;
  const cellCount = ROULETTE_HISTORY_GRID_COLS * rowCount;
  const badgeClass = colorMode === "height" ? spinHistoryHeightBadgeClass : spinHistoryMatBadgeClass;

  if (history.length === 0) {
    return (
      <div className="flex justify-center py-4">
        <span className="text-sm text-slate-500">Sem giros ainda.</span>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[min(100%,520px)] grid-cols-11 gap-0.5 sm:gap-1">
      {Array.from({ length: cellCount }, (_, i) => {
        const n = history[i];
        const empty = n === undefined;
        const role = cellRoleForIndex?.(i);
        return (
          <div
            key={`spin-grid-${i}`}
            className={cn(
              "flex aspect-square min-h-[26px] min-w-0 items-center justify-center rounded-md border text-[11px] font-bold tabular-nums sm:min-h-[30px] sm:text-xs",
              empty
                ? "border-slate-800/60 bg-slate-950/40 text-slate-700/25"
                : badgeClass(n!),
              role === "compare" && "ring-2 ring-cyan-300/90 ring-offset-1 ring-offset-[#0d1524]",
              role === "base" && "ring-2 ring-amber-200/90 ring-offset-1 ring-offset-[#0d1524]",
            )}
          >
            {empty ? "\u00a0" : n}
          </div>
        );
      })}
    </div>
  );
}

const defaultSectionClass =
  "mx-auto mt-4 max-w-4xl rounded-2xl border border-slate-800/90 bg-slate-900/55 px-2 py-2.5 sm:px-3";

type SectionProps = GridProps & {
  /** Classes do `<section>` (substitui o estilo por defeito se definido). */
  sectionClassName?: string;
};

export function RouletteHistoryGrid11x3Section({
  history,
  sectionClassName,
  rows = ROULETTE_HISTORY_GRID_ROWS,
  colorMode = "color",
  cellRoleForIndex,
}: SectionProps) {
  const rowCount = rows;
  const cellCount = ROULETTE_HISTORY_GRID_COLS * rowCount;
  return (
    <section
      className={sectionClassName ?? defaultSectionClass}
      aria-label={`Ultimos ${cellCount} giros em grelha ${ROULETTE_HISTORY_GRID_COLS} por ${rowCount}; o mais recente no canto superior esquerdo, leitura em linhas.`}
    >
      <RouletteHistoryGrid11x3
        history={history}
        rows={rows}
        colorMode={colorMode}
        cellRoleForIndex={cellRoleForIndex}
      />
    </section>
  );
}
