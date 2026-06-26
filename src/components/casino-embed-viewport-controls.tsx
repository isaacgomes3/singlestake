import { Crop, RotateCcw } from "lucide-react";

import type { CasinoEmbedViewportInsets } from "@/lib/roulette/casinoEmbedViewportPrefs";
import { cn } from "@/lib/utils";

type Props = {
  viewport: CasinoEmbedViewportInsets;
  onChange: (patch: Partial<CasinoEmbedViewportInsets>) => void;
  onReset: () => void;
  className?: string;
  compact?: boolean;
};

function InsetSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[3.5rem_1fr_2.25rem] items-center gap-2 text-[10px] text-text-secondary">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <input
        type="range"
        min={0}
        max={25}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[var(--text-secondary)]"
      />
      <span className="text-right tabular-nums text-text-primary">{value.toFixed(1)}%</span>
    </label>
  );
}

export function CasinoEmbedViewportControls({
  viewport,
  onChange,
  onReset,
  className,
  compact = false,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-color bg-bg-card shadow-lg backdrop-blur-sm",
        compact ? "p-2.5" : "p-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary">
          <Crop className="h-3.5 w-3.5 text-text-secondary" aria-hidden />
          Moldura do vídeo
        </p>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md border border-border-color px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:bg-bg-card-hover"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Repor
        </button>
      </div>
      <p className="mb-2 text-[10px] leading-snug text-text-secondary">
        Ajuste o que fica visível dentro da moldura (corta o site à volta do jogo).
      </p>
      <div className="space-y-2">
        <InsetSlider label="Topo" value={viewport.topPct} onChange={(v) => onChange({ topPct: v })} />
        <InsetSlider
          label="Baixo"
          value={viewport.bottomPct}
          onChange={(v) => onChange({ bottomPct: v })}
        />
        <InsetSlider
          label="Esq."
          value={viewport.leftPct}
          onChange={(v) => onChange({ leftPct: v })}
        />
        <InsetSlider
          label="Dir."
          value={viewport.rightPct}
          onChange={(v) => onChange({ rightPct: v })}
        />
      </div>
    </div>
  );
}
