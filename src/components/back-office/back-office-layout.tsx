import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Link2, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BackOfficeSidebarNav } from "@/components/back-office/back-office-sidebar-nav";
import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { SinglestakeLogo } from "@/components/singlestake-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiFetchMe, apiLogout } from "@/lib/auth/api";
import {
  clearSession,
  getSession,
  goToLogin,
  setSession as persistSession,
  type AuthSession,
} from "@/lib/auth/session";

const SESSION_CHECK_TIMEOUT_MS = 12_000;

export function BackOfficeLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checking, setChecking] = useState(() => getSession() == null);
  const [session, setSessionState] = useState<AuthSession | null>(() => getSession());
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getSession();

    void (async () => {
      setSessionError(null);

      const timeout = new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), SESSION_CHECK_TIMEOUT_MS);
      });

      const user = await Promise.race([apiFetchMe(), timeout]);
      if (cancelled) return;

      if (!user) {
        if (cached) {
          setSessionError(
            "Não foi possível validar a sessão. Verifique a ligação ou tente entrar novamente.",
          );
          setChecking(false);
          return;
        }
        clearSession();
        goToLogin(pathname);
        return;
      }

      persistSession(user);
      setSessionState({ user, issuedAt: Date.now() });
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-sm text-text-secondary">
        A verificar sessão…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary px-4 text-center">
        <p className="text-sm text-text-secondary">
          {sessionError ?? "Sessão expirada. Entre novamente para continuar."}
        </p>
        <button
          type="button"
          onClick={() => goToLogin(pathname)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Ir para o login
        </button>
      </div>
    );
  }

  const handleLogout = async () => {
    await apiLogout();
    clearSession();
    goToLogin();
  };

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary">
      <aside className="theme-sidebar relative hidden w-[260px] shrink-0 flex-col border-r lg:flex">
        <div className="border-b border-sidebar-border-fixed px-3 py-4">
          <Link to="/back-office" className="block">
            <SinglestakeLogo variant="stacked" className="mx-auto h-[88px] w-full max-w-[220px]" />
          </Link>
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-fg-muted">
            singlestake
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <BackOfficeSidebarNav onLogout={() => void handleLogout()} />
        </div>
        <div className="space-y-3 border-t border-sidebar-border-fixed p-3">
          <div className="rounded-lg border border-sidebar-border-fixed bg-sidebar-bg/50 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-sidebar-fg-muted">
              <Link2 className="size-3" aria-hidden />
              Link de afiliação
            </p>
            <div className="mt-2">
              <ReferralLinkField
                referralCode={session.user.referralCode}
                referralLink={session.user.referralLink}
                showCode={false}
                compact
                inputClassName="text-xs"
              />
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="theme-overlay flex-1"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="theme-sidebar flex w-[min(100%,280px)] flex-col shadow-theme">
            <div className="flex items-center justify-between border-b border-sidebar-border-fixed p-4">
              <span className="text-sm font-bold text-sidebar-fg">Back office</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar"
                className="theme-sidebar-item rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BackOfficeSidebarNav
                mobile
                onNavigate={() => setMobileOpen(false)}
                onLogout={() => void handleLogout()}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-top-bar sticky top-0 z-30 flex items-center gap-2 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[10rem] truncate text-xs font-semibold text-text-primary">
                {session.user.name}
              </p>
              <p className="max-w-[10rem] truncate text-[10px] text-text-secondary">
                {session.user.email}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>
        {sessionError ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
            {sessionError}
          </div>
        ) : null}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
