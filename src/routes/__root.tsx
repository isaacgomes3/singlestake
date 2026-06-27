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
import { Live24dSpinSseBridge } from "@/components/live-24d-spin-sse-bridge";
import { LiveFootballBlitzSseBridge } from "@/components/live-football-blitz-sse-bridge";
import { LiveRouletteSseBridge } from "@/components/live-roulette-sse-bridge";
import { RouletteRotatingRoomSseBridge } from "@/components/roulette-rotating-room-sse-bridge";
import { RouletteAutomationSimSseBridge } from "@/components/roulette-automation-sim-sse-bridge";
import { StrategyGlobalSseBridge } from "@/hooks/useStrategyGlobalSnapshot";
import { RotatingRoomExtensionBridgeGlobal } from "@/components/rotating-room-extension-bridge-global";
import { RouteSoundGate } from "@/components/route-sound-gate";
import { Toaster } from "@/components/ui/sonner";
import { useAppProfile } from "@/hooks/useAppProfile";
import { isBackOfficeWorkspacePath } from "@/lib/back-office/routes";
import { isBackOfficeAppPath, isLegacyCasinoPath } from "@/lib/auth/guards";
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
        content: "Back office singlestake — rede MMN, financeiro, casino ao vivo e operações.",
      },
      { name: "author", content: "singlestake" },
      { property: "og:title", content: "singlestake — Painel" },
      {
        property: "og:description",
        content: "Back office singlestake — rede MMN, financeiro, casino ao vivo e operações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "singlestake — Painel" },
      {
        name: "twitter:description",
        content: "Back office singlestake — rede MMN, financeiro, casino ao vivo e operações.",
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

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
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
  const backOfficeApp = isBackOfficeAppPath(pathname);
  const legacyCasino = !isAutomation && isLegacyCasinoPath(pathname);
  const liveCasinoShell = backOfficeApp || legacyCasino;
  /** Simulador + strategy global — só no host de automação. */
  const needsGlobalAutomation = isAutomation;
  const needsCasinoStreams = isAutomation
    ? workspacePath || pathname === "/casino-mesa"
    : backOfficeApp &&
      (pathname === "/back-office" ||
        pathname === "/back-office/" ||
        pathname.startsWith("/back-office/operacoes"));
  const needsExtensionBridge = isAutomation && workspacePath;

  const outlet = <Outlet />;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <Toaster richColors position="top-center" />
          {liveCasinoShell ? (
            <div className="app-back-office-bg">
              <RouletteLiveApiProvider>
                {needsGlobalAutomation ? (
                  <>
                    <StrategyGlobalSseBridge />
                    <RouletteAutomationSimSseBridge />
                  </>
                ) : null}
                {needsCasinoStreams ? (
                  <>
                    <RouteSoundGate />
                    <LiveRouletteSseBridge />
                    <RouletteRotatingRoomSseBridge />
                    <Live24dSpinSseBridge />
                    <LiveFootballBlitzSseBridge />
                    {needsExtensionBridge ? <RotatingRoomExtensionBridgeGlobal /> : null}
                  </>
                ) : null}
                {outlet}
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
