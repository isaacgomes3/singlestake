import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CircleDot, Home, User } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  hideNav?: boolean;
};

function NavItem({
  to,
  label,
  icon,
  active,
  exact,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={exact ? { exact: true } : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-semibold",
        active ? "text-amber-400" : "text-neutral-500",
      )}
    >
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", active && "bg-amber-400/10")}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function MobileAppShell({ hideNav = false }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onPerfil = pathname === "/mobile/perfil" || pathname.startsWith("/mobile/perfil/");
  const onJogos =
    !onPerfil &&
    (pathname === "/mobile" ||
      pathname.startsWith("/mobile/roleta") ||
      pathname === "/mobile/um1fator" ||
      pathname === "/mobile/dois2fatores");
  const onLobby = pathname === "/";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-neutral-100">
      <div className="flex-1 overflow-x-hidden overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      {!hideNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-800/90 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1">
            <NavItem
              to="/mobile"
              label="Jogos"
              active={onJogos}
              exact
              icon={<CircleDot className="h-5 w-5" aria-hidden />}
            />
            <NavItem
              to="/mobile/perfil"
              label="Perfil"
              active={onPerfil}
              icon={<User className="h-5 w-5" aria-hidden />}
            />
            <NavItem
              to="/"
              label="Lobby"
              active={onLobby}
              icon={<Home className="h-5 w-5" aria-hidden />}
            />
          </div>
        </nav>
      ) : null}
    </div>
  );
}
