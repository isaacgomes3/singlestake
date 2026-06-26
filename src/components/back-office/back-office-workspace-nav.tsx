import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const iframeChrome = useRotatingRoomIframeChrome();
  const onCasinoOutros =
    pathname === "/football-blitz" || pathname === "/super-trunfo";

  const backTo = onCasinoOutros
    ? BACK_OFFICE_PATHS.casinoOutros
    : BACK_OFFICE_PATHS.casinoAoVivo;
  const backLabel = onCasinoOutros ? "Outros jogos" : "Cassino ao vivo";

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
        <Link to={backTo} className={backLinkClass}>
          {backLabel}
        </Link>
      </div>
      {rotatingRoom ? (
        <div className="flex flex-col gap-2 border-t border-border-color pt-2">
          <RotatingRoomExtensionStatus compact />
        </div>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </nav>
  );
}
