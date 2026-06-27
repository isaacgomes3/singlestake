import { redirect } from "@tanstack/react-router";

import { isBackOfficeWorkspacePath } from "@/lib/back-office/routes";
import {
  automationWorkspaceHref,
  AUTOMATION_DEFAULT_ENTRY,
  getAutomationPublicOrigin,
  isAutomationProfile,
  isBackofficeProfile,
} from "@/lib/app-profile";

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
  if (isAutomationProfile()) {
    return (
      pathname === "/entrar" ||
      pathname === "/registar" ||
      isBackOfficeWorkspacePath(pathname)
    );
  }
  return (
    pathname === "/entrar" ||
    pathname === "/registar" ||
    pathname.startsWith("/back-office") ||
    isBackOfficeWorkspacePath(pathname)
  );
}

function isIframeWorkspaceSearch(search?: Record<string, unknown>): boolean {
  const raw = search?.iframe;
  return raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "yes";
}

function hrefWithSearch(href: string, search?: Record<string, unknown>): string {
  if (!search || Object.keys(search).length === 0) return href;
  try {
    const url = new URL(href, typeof window !== "undefined" ? window.location.origin : undefined);
    for (const [key, value] of Object.entries(search)) {
      if (value == null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url.origin === "null" || !href.startsWith("http")
      ? `${url.pathname}${url.search}${url.hash}`
      : url.toString();
  } catch {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value == null || value === "") continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (!qs) return href;
    return `${href}${href.includes("?") ? "&" : "?"}${qs}`;
  }
}

/** No back office, workspace de automação vive no subdomínio dedicado. */
export function guardAutomationWorkspaceRoute(
  pathname: string,
  search?: Record<string, unknown>,
): void {
  if (!isBackofficeProfile()) return;
  if (!isBackOfficeWorkspacePath(pathname)) return;
  /** Modo iframe — mesma origem, como antes do subdomínio. */
  if (isIframeWorkspaceSearch(search)) return;
  const origin = getAutomationPublicOrigin();
  if (!origin) return;
  const target = hrefWithSearch(automationWorkspaceHref(pathname), search);
  throw redirect({ href: target, replace: true });
}

/** No host de automação, back office não está disponível. */
export function guardBackOfficeRoute(): void {
  if (!isAutomationProfile()) return;
  const origin = getAutomationPublicOrigin();
  throw redirect({
    href: origin ? `${origin}${AUTOMATION_DEFAULT_ENTRY}` : AUTOMATION_DEFAULT_ENTRY,
    replace: true,
  });
}

export function isLegacyCasinoPath(pathname: string): boolean {
  if (pathname === "/" || isBackOfficeAppPath(pathname)) return false;
  return true;
}
