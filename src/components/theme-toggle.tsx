import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn("text-text-secondary hover:text-text-primary", className)}
        aria-label={isDark ? "Activar tema claro" : "Activar tema escuro"}
      >
        {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className={cn("gap-2 border-border-color bg-bg-secondary text-text-primary", className)}
      aria-label="Alternar tema"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" aria-hidden />
          <span>Claro</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" aria-hidden />
          <span>Escuro</span>
        </>
      )}
    </Button>
  );
}
