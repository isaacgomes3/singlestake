import { cn } from "@/lib/utils";

type Props = {
  size?: "mini" | "full";
  className?: string;
};

const SIZES = {
  mini: {
    outer: "h-14 w-14 border-[3px] sm:h-16 sm:w-16",
    hub: "h-6 w-6 sm:h-7 sm:w-7",
    dot: "h-2 w-2",
    pointer: "border-x-[5px] border-b-[10px]",
    glow: "shadow-[0_0_20px_rgba(251,191,36,0.32)]",
  },
  full: {
    outer: "h-[9.25rem] w-[9.25rem] border-[5px] sm:h-40 sm:w-40",
    hub: "h-10 w-10 sm:h-11 sm:w-11",
    dot: "h-3 w-3",
    pointer: "border-x-[7px] border-b-[14px]",
    glow: "shadow-[0_0_36px_rgba(251,191,36,0.38)]",
  },
} as const;

const WHEEL_GRADIENT = `conic-gradient(
  #15803d 0deg 28deg,
  #b91c1c 28deg 73deg,
  #0f172a 73deg 118deg,
  #b91c1c 118deg 163deg,
  #0f172a 163deg 208deg,
  #b91c1c 208deg 253deg,
  #0f172a 253deg 298deg,
  #b91c1c 298deg 343deg,
  #0f172a 343deg 360deg
)`;

/** Roleta estilizada a girar (tapete / simulador). */
export function RouletteSpinWheel({ size = "full", className }: Props) {
  const s = SIZES[size];

  return (
    <div className={cn("relative", size === "full" && "sm:scale-110", className)}>
      <div
        className={cn(
          "tapete-roulette-whirl rounded-full border-amber-400/95",
          s.outer,
          s.glow,
        )}
        style={{ background: WHEEL_GRADIENT }}
        aria-hidden
      />
      <div
        className={cn(
          "absolute left-1/2 top-0 z-[1] h-0 w-0 -translate-x-1/2 border-x-transparent border-b-amber-300 drop-shadow-md",
          s.pointer,
        )}
      />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-200/90 bg-[#0a0f18] shadow-inner ring-1 ring-black/40",
          s.hub,
        )}
        aria-hidden
      >
        <span
          className={cn(
            "rounded-full bg-amber-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] ring-1 ring-amber-100/50",
            s.dot,
          )}
        />
      </div>
    </div>
  );
}
