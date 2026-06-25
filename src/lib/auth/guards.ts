import { redirect } from "@tanstack/react-router";

import { isBackOfficeWorkspacePath } from "@/lib/back-office/routes";

import { isAuthenticated } from "./session";

/** Sessão vive em localStorage — guards só correm no cliente. */
function canReadSession(): boolean {
  return typeof window !== "undefined";
}

export function requireAuth(redirectTo?: string) {
  if (!canReadSession()) return;
  if (!isAuthenticated()) {
    throw redirect({
      to: "/entrar",
      search: redirectTo ? { redirect: redirectTo } : {},
    });
  }
}

export function redirectIfAuthenticated(fallback = "/back-office") {
  if (!canReadSession()) return;
  if (isAuthenticated()) {
    const target =
      typeof window !== "undefined"
        ? (() => {
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get("redirect");
            if (redirect?.startsWith("/back-office")) return redirect;
            return fallback;
          })()
        : fallback;
    window.location.replace(target);
  }
}

export function isBackOfficeAppPath(pathname: string): boolean {
  return (
    pathname === "/entrar" ||
    pathname === "/registar" ||
    pathname.startsWith("/back-office") ||
    isBackOfficeWorkspacePath(pathname)
  );
}

export function isLegacyCasinoPath(pathname: string): boolean {
  if (pathname === "/" || isBackOfficeAppPath(pathname)) return false;
  return true;
}
