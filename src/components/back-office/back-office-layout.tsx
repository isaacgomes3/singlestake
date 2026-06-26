import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Link2, Menu, X } from "lucide-react";
import { useLayoutEffect, useState } from "react";

import { BackOfficeHeader } from "@/components/back-office/back-office-header";
import { BackOfficeSearchCommand } from "@/components/back-office/back-office-search-command";
import { BackOfficeSidebarNav } from "@/components/back-office/back-office-sidebar-nav";
import {
  BackOfficeUtilityRail,
  type UtilityPanelId,
} from "@/components/back-office/back-office-utility-rail";
import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { SinglestakeLogo } from "@/components/singlestake-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { apiFetchMe, apiLogout } from "@/lib/auth/api";
import {
  clearSession,
  getSession,
  goToLogin,
  setSession as persistSession,
  type AuthSession,
} from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const SIDEBAR_LAYOUT_KEY = "singlestake-sidebar-boxed";

function readSidebarBoxed(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SIDEBAR_LAYOUT_KEY);
  if (stored === "false") return false;
  return true;
}

export function BackOfficeLayout() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [booted, setBooted] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sidebarBoxed, setSidebarBoxed] = useState(true);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanelId>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useLayoutEffect(() => {
    setSidebarBoxed(readSidebarBoxed());
  }, []);

  useLayoutEffect(() => {
    const cached = getSession();
    setSessionState(cached);
    setBooted(true);

    if (!cached) {
      goToLogin(pathname);
      return;
    }

    void apiFetchMe().then((user) => {
      if (user) {
        persistSession(user);
        setSessionState({ user, issuedAt: Date.now() });
        setSessionError(null);
        return;
      }
      setSessionError(t("common.sessionExpired"));
    });
  }, [pathname, t]);

  const toggleSidebarLayout = () => {
    setSidebarBoxed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_LAYOUT_KEY, String(next));
      return next;
    });
  };

  if (!booted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-sm text-text-secondary">
        {t("common.loading")}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary px-4 text-center">
        <p className="text-sm text-text-secondary">
          {sessionError ?? t("common.redirectingLogin")}
        </p>
        <button
          type="button"
          onClick={() => goToLogin(pathname)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          {t("common.goToLogin")}
        </button>
      </div>
    );
  }

  const handleLogout = async () => {
    await apiLogout();
    clearSession();
    goToLogin();
  };

  const sidebarInner = (
    <>
      <div className="border-b border-sidebar-border-fixed px-3 py-4">
        <Link to="/back-office" className="block">
          <SinglestakeLogo variant="stacked" className="mx-auto h-[80px] w-full max-w-[200px]" />
        </Link>
        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-fg-muted">
          STAKE37
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <BackOfficeSidebarNav onLogout={() => void handleLogout()} />
      </div>
      <div className="hidden border-t border-sidebar-border-fixed p-3 xl:block">
        <div className="rounded-lg border border-sidebar-border-fixed bg-sidebar-bg/50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-sidebar-fg-muted">
            <Link2 className="size-3" aria-hidden />
            {t("common.affiliateLink")}
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
    </>
  );

  return (
    <div
      className={cn(
        "app-shell flex min-h-screen bg-bg-primary text-text-primary",
        sidebarBoxed ? "app-shell--boxed" : "app-shell--edge",
        utilityPanel ? "app-shell--panel-open" : null,
      )}
      style={{ "--app-sidebar-width": sidebarBoxed ? "292px" : "260px" } as React.CSSProperties}
    >
      <aside
        className={cn(
          "relative hidden shrink-0 lg:flex",
          sidebarBoxed ? "w-[292px] p-3" : "w-[260px]",
        )}
      >
        <div
          className={cn(
            "theme-sidebar flex h-full min-h-0 w-full flex-col border-sidebar-border-fixed",
            sidebarBoxed ? "rounded-2xl border shadow-lg" : "border-r",
          )}
        >
          {sidebarInner}
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="theme-overlay flex-1"
            aria-label={t("common.closeMenu")}
            onClick={() => setMobileOpen(false)}
          />
          <div className="theme-sidebar flex w-[min(100%,300px)] flex-col shadow-theme">
            <div className="flex items-center justify-between border-b border-sidebar-border-fixed p-4">
              <span className="text-sm font-bold text-sidebar-fg">{t("common.backOffice")}</span>
              <div className="flex items-center gap-1">
                <LocaleSwitcher compact />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={t("common.close")}
                  className="theme-sidebar-item rounded-lg p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
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

      <div className="flex min-w-0 flex-1 flex-col lg:pr-14">
        <div className="flex items-center gap-2 border-b border-border-color px-3 py-2 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            onClick={() => setMobileOpen(true)}
            aria-label={t("common.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
          <LocaleSwitcher compact />
        </div>

        <BackOfficeHeader
          user={session.user}
          sidebarBoxed={sidebarBoxed}
          onToggleSidebarLayout={toggleSidebarLayout}
          onOpenUtility={setUtilityPanel}
          onOpenSearch={() => setSearchOpen(true)}
          onLogout={() => void handleLogout()}
        />

        {sessionError ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
            {sessionError}
          </div>
        ) : null}

        <main
          className={cn(
            "flex-1 overflow-x-hidden p-4 transition-[padding] sm:p-6 lg:p-8",
            utilityPanel ? "lg:pr-[calc(2rem+380px)]" : null,
          )}
        >
          <Outlet />
        </main>
      </div>

      <BackOfficeUtilityRail
        activePanel={utilityPanel}
        onSelectPanel={setUtilityPanel}
        referralCode={session.user.referralCode}
        referralLink={session.user.referralLink}
      />

      <BackOfficeSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
