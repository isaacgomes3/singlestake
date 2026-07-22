import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { LiveRouletteSseBridge } from "@/components/live-roulette-sse-bridge";
import { LiveFootballBlitzSseBridge } from "@/components/live-football-blitz-sse-bridge";
import { RouletteAutomationSimSseBridge } from "@/components/roulette-automation-sim-sse-bridge";
import { StrategyGlobalSseBridge } from "@/hooks/useStrategyGlobalSnapshot";
import { CasinoCalibrationOverlay } from "@/components/casino-calibration-overlay";
import { RotatingRoomExtensionBridgeGlobal } from "@/components/rotating-room-extension-bridge-global";
import { DeferredMount } from "@/components/deferred-mount";
import { RouteSoundGate } from "@/components/route-sound-gate";
import { Toaster } from "@/components/ui/sonner";
import { useAppProfile } from "@/hooks/useAppProfile";
import { isBackOfficeWorkspacePath, isBackOfficeLiveRoulettePath } from "@/lib/back-office/routes";
import { isBackOfficeAppPath, isLegacyCasinoPath } from "@/lib/auth/guards";
import { isBackOfficeAdminPath } from "@/lib/back-office/admin-access";
import { RouletteLiveApiProvider } from "@/lib/roulette/rouletteLiveApiContext";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/theme-provider";
import { I18nProvider } from "@/lib/i18n/i18n-provider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/back-office"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o back office
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {import.meta.env.DEV && error?.message ? (
          <pre className="mt-4 max-h-40 max-w-full overflow-auto rounded-md border border-destructive/30 bg-muted/50 p-3 text-left text-xs text-destructive break-words whitespace-pre-wrap">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/back-office"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o back office
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "singlestake — Painel" },
      {
        name: "description",
        content: "Back office singlestake — rede MMN, financeiro, automação e salas rotativas.",
      },
      { name: "author", content: "singlestake" },
      { property: "og:title", content: "singlestake — Painel" },
      {
        property: "og:description",
        content: "Back office singlestake — rede MMN, financeiro, automação e salas rotativas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "singlestake — Painel" },
      {
        name: "twitter:description",
        content: "Back office singlestake — rede MMN, financeiro, automação e salas rotativas.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "icon",
        href: "/images/stake37-logo.png",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/images/stake37-logo.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/** Se o React não hidratar (cache/JS bloqueado), mostra instruções em vez de ficar preso. */
const HYDRATION_WATCHDOG_SCRIPT = `(function(){setTimeout(function(){if(window.__singlestakeHydrated)return;var el=document.querySelector(".app-back-office-bg");if(!el||!/carregar/i.test(el.textContent||""))return;el.innerHTML='<div style="max-width:28rem;margin:4rem auto;padding:1.5rem;font-family:system-ui,sans-serif;text-align:center;color:#334155"><p style="font-weight:600;margin:0 0 0.5rem">A página não iniciou</p><p style="font-size:0.875rem;color:#64748b;margin:0 0 1rem;line-height:1.5">Limpe a cache (Ctrl+Shift+R), tente janela anónima ou verifique erros na consola (F12 → Consola).</p><a href="/entrar" style="display:inline-block;padding:0.5rem 1rem;background:#2563eb;color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem">Ir para entrar</a> <button type="button" onclick="location.reload()" style="display:inline-block;margin-left:0.5rem;padding:0.5rem 1rem;border:1px solid #cbd5e1;border-radius:0.5rem;background:#fff;cursor:pointer;font-size:0.875rem">Recarregar</button></div>';},12000);})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: HYDRATION_WATCHDOG_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useAppProfile();
  const isAutomation = profile === "automation";
  const workspacePath = isBackOfficeWorkspacePath(pathname);
  const liveRouletteAdmin = isBackOfficeLiveRoulettePath(pathname);
  const adminAutomation = isBackOfficeAdminPath(pathname);
  const backOfficeApp = isBackOfficeAppPath(pathname);
  const legacyCasino = !isAutomation && isLegacyCasinoPath(pathname);
  const liveCasinoShell = backOfficeApp || legacyCasino;
  const backOfficeOverview =
    !isAutomation && backOfficeApp && (pathname === "/back-office" || pathname === "/back-office/");
  /** Motor global + automação — salas rotativas, monitor Sequências e subdomínio automação. */
  const needsGlobalAutomation =
    isAutomation || workspacePath || liveRouletteAdmin || adminAutomation;
  /** SSE roleta — mesas ao vivo (visão geral + salas + Sequências + subdomínio automação). */
  const needsRouletteStream =
    isAutomation ||
    backOfficeOverview ||
    workspacePath ||
    liveRouletteAdmin ||
    pathname.startsWith("/casino-mesa");
  /** Ponte extensão — salas + subdomínio automação. */
  const needsExtensionBridge = isAutomation || workspacePath;
  const needsFootballBlitzStream =
    backOfficeOverview ||
    pathname === "/football-blitz" ||
    pathname === "/super-trunfo" ||
    pathname === "/back-office/administracao/automacao-football-blitz" ||
    pathname.startsWith("/back-office/administracao/automacao-football-blitz/");

  const outlet = <Outlet />;
  const automationBridges = needsGlobalAutomation ? (
    <DeferredMount delayMs={backOfficeOverview ? 50 : 0}>
      <StrategyGlobalSseBridge />
      <RouletteAutomationSimSseBridge />
    </DeferredMount>
  ) : null;
  const extensionBridge = needsExtensionBridge ? (
    <DeferredMount delayMs={backOfficeOverview ? 100 : 0}>
      <RotatingRoomExtensionBridgeGlobal />
    </DeferredMount>
  ) : null;
  const rouletteStream = needsRouletteStream ? (
    <>
      <RouteSoundGate />
      <LiveRouletteSseBridge />
    </>
  ) : null;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <Toaster richColors position="top-center" />
          <CasinoCalibrationOverlay />
          {liveCasinoShell ? (
            <div className="app-back-office-bg">
              <RouletteLiveApiProvider>
                {outlet}
                {automationBridges}
                {extensionBridge}
                {rouletteStream}
                {needsFootballBlitzStream ? <LiveFootballBlitzSseBridge /> : null}
              </RouletteLiveApiProvider>
            </div>
          ) : (
            <div className="app-back-office-bg">{outlet}</div>
          )}
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
