import { Link } from "@tanstack/react-router";

import { SinglestakeLogo } from "@/components/singlestake-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function AuthPageShell({
  title,
  subtitle,
  showHeroLogo,
  children,
  footer,
}: {
  title?: string;
  subtitle?: string;
  /** Logótipo grande no centro (ex.: página de login). */
  showHeroLogo?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
      <header
        className={cn(
          "flex items-center border-b border-border-color px-4 py-3 sm:px-6",
          showHeroLogo ? "justify-end" : "justify-between",
        )}
      >
        {showHeroLogo ? null : (
          <Link to="/entrar" className="inline-flex items-center gap-2">
            <SinglestakeLogo className="h-9 w-auto" />
          </Link>
        )}
        <div className="flex items-center gap-2">
          <LocaleSwitcher compact />
          <ThemeToggle compact />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          {showHeroLogo ? (
            <div className="mb-8 flex justify-center">
              <SinglestakeLogo className="h-24 w-auto max-w-[min(340px,88vw)] sm:h-28" />
            </div>
          ) : title || subtitle ? (
            <div className="mb-8 text-center">
              {title ? (
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              ) : null}
              {subtitle ? <p className="mt-2 text-sm text-text-secondary">{subtitle}</p> : null}
            </div>
          ) : null}
          <div className="theme-card rounded-2xl p-6 sm:p-8">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-text-secondary">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
