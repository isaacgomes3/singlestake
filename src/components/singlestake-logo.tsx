import { cn } from "@/lib/utils";

const LOGO_SRC = "/images/stake37-logo.png";

type SinglestakeLogoProps = {
  className?: string;
  /**
   * `horizontal` — barra superior, login, tabs.
   * `stacked` — sidebar (mesma arte, mais altura).
   */
  variant?: "horizontal" | "stacked";
};

/** Logótipo STAKE37 (PNG com fundo escuro — combina com tema grafite). */
export function SinglestakeLogo({ className, variant = "horizontal" }: SinglestakeLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="STAKE37"
      width={320}
      height={128}
      draggable={false}
      className={cn(
        "h-auto w-auto max-w-full object-contain object-center",
        variant === "stacked" ? "max-h-[88px]" : "max-h-12",
        className,
      )}
    />
  );
}
