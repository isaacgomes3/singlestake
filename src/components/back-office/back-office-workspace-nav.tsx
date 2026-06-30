import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { RotatingRoomExtensionStatus } from "@/components/rotating-room-extension-status";
import { useRotatingRoomIframeChrome } from "@/hooks/useRotatingRoomIframeChrome";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
import { cn } from "@/lib/utils";

type Props = {
  children?: ReactNode;
  /** Mostra controlos da sala rotativa (API + extensão). */
  rotatingRoom?: boolean;
  className?: string;
};

const backLinkClass =
  "inline-flex w-fit items-center gap-1.5 rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm font-semibold text-text-secondary transition hover:border-info/40 hover:text-text-primary";

export function BackOfficeWorkspaceNav({ children, rotatingRoom, className }: Props) {
  const iframeChrome = useRotatingRoomIframeChrome();

  if (rotatingRoom && iframeChrome) {
    return (
      <nav
        className={cn("mb-3 flex w-full flex-col gap-2", className)}
        aria-label="Navegação do back office"
      >
        <RotatingRoomExtensionStatus compact />
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "mb-6 flex w-full flex-col gap-2 rounded-2xl border border-border-color bg-bg-card/80 p-2 sm:p-3",
        className,
      )}
      aria-label="Navegação do back office"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link to={BACK_OFFICE_PATHS.home} className={backLinkClass}>
          ← Back office
        </Link>
        <Link to={BACK_OFFICE_PATHS.casinoAoVivo} className={backLinkClass}>
          Cassino ao vivo
        </Link>
      </div>
      {rotatingRoom ? (
        <div className="flex flex-col gap-2 border-t border-border-color pt-2">
          <RotatingRoomExtensionStatus compact />
          {!iframeChrome ? (
            <div className="flex flex-wrap gap-2">
              <Link
                to="/sala-rotativa-um-fator"
                className="rounded-lg border border-border-color bg-bg-secondary px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:border-info/40 hover:text-text-primary"
              >
                Sala · 1 Fator
              </Link>
              <Link
                to="/sala-rotativa-dois-fatores"
                className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-400/50"
              >
                Sala · 2 Fatores
              </Link>
              <Link
                to="/sala-rotativa-fibonacci"
                className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-200 hover:border-violet-400/50"
              >
                Sala · Fibonacci
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </nav>
  );
}
