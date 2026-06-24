import {
  clampCasinoEmbedViewport,
  resolveCasinoEmbedViewport,
  type CasinoEmbedViewportInsets,
} from "@/lib/roulette/casinoEmbedViewportPrefs";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  title: string;
  className?: string;
  /** Moldura visível à volta da área recortada. */
  framed?: boolean;
  viewport?: CasinoEmbedViewportInsets;
};

/**
 * Iframe com moldura e recorte por percentagem (cross-origin — só overflow + offset).
 * Ajuste fino: `CasinoEmbedViewportControls` ou `roulette.casinoEmbedViewport.v1` no localStorage.
 */
export function CasinoGameEmbedFrame({
  src,
  title,
  className,
  framed = true,
  viewport,
}: Props) {
  const insets = viewport
    ? clampCasinoEmbedViewport(viewport)
    : resolveCasinoEmbedViewport();
  const widthPct = 100 + insets.leftPct + insets.rightPct;
  const heightPct = 100 + insets.topPct + insets.bottomPct;

  return (
    <div
      className={cn(
        className ?? "absolute inset-0",
        framed && "rounded-xl border-2 border-slate-600/70 bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,0,0,0.45)] ring-1 ring-cyan-950/40",
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-black">
        <iframe
          title={title}
          src={src}
          className="absolute border-0 bg-black"
          style={{
            top: `-${insets.topPct}%`,
            left: `-${insets.leftPct}%`,
            width: `${widthPct}%`,
            height: `${heightPct}%`,
          }}
          allow="fullscreen; payment; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {framed ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.04]"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

export { DEFAULT_CASINO_EMBED_VIEWPORT as CASINO_EMBED_CROP } from "@/lib/roulette/casinoEmbedViewportPrefs";
