import { cn } from "@/lib/utils";

type Props = {
  number: number;
  onClick: (number: number) => void;
  isSelected?: boolean;
  size?: "sm" | "md" | "lg";
};

function colorClass(number: number): string {
  if (number === 0) return "bg-emerald-600 text-white";
  const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  if (red.includes(number)) return "bg-[#dc2626] text-white";
  return "bg-[#1f2937] text-white";
}

export function CalculadoraRouletteNumber({
  number,
  onClick,
  isSelected = false,
  size = "md",
}: Props) {
  const sizeClasses = {
    sm: "h-8 w-8 min-w-8 text-xs",
    md: "h-12 w-12 min-w-12 text-sm",
    lg: "h-16 w-16 min-w-16 text-lg",
  };

  return (
    <button
      type="button"
      onClick={() => onClick(number)}
      className={cn(
        "rounded-lg border-2 font-bold transition-transform duration-200 hover:scale-105 hover:shadow-lg",
        colorClass(number),
        sizeClasses[size],
        isSelected
          ? "ring-4 ring-amber-400/80 ring-offset-2 ring-offset-slate-950"
          : "border-slate-600",
      )}
    >
      {number}
    </button>
  );
}
