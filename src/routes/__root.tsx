import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Live24dSpinSseBridge } from "@/components/live-24d-spin-sse-bridge";
import { LiveFootballBlitzSseBridge } from "@/components/live-football-blitz-sse-bridge";
import { LiveRouletteSseBridge } from "@/components/live-roulette-sse-bridge";
import { StrategyGlobalSseBridge } from "@/hooks/useStrategyGlobalSnapshot";
import { RouteSoundGate } from "@/components/route-sound-gate";
import { Toaster } from "@/components/ui/sonner";
import { RouletteLiveApiProvider } from "@/lib/roulette/rouletteLiveApiContext";

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
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o lobby
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
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o lobby
          </a>
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
      { title: "Roletas ao vivo — Poupex Play" },
      {
        name: "description",
        content:
          "Lobby com mesas de roleta ao vivo, estratégias 1 Fator e 2 Fatores, sala rotativa e sinais em tempo real.",
      },
      { name: "author", content: "Poupex Play" },
      { property: "og:title", content: "Roletas ao vivo — Poupex Play" },
      {
        property: "og:description",
        content:
          "Lobby com mesas de roleta ao vivo, estratégias 1 Fator e 2 Fatores, sala rotativa e sinais em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Roletas ao vivo — Poupex Play" },
      {
        name: "twitter:description",
        content:
          "Lobby com mesas de roleta ao vivo, estratégias 1 Fator e 2 Fatores, sala rotativa e sinais em tempo real.",
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
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
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

  return (
    <QueryClientProvider client={queryClient}>
      <RouletteLiveApiProvider>
        <RouteSoundGate />
        <Toaster richColors position="top-center" />
        <LiveRouletteSseBridge />
        <StrategyGlobalSseBridge />
        <Live24dSpinSseBridge />
        <LiveFootballBlitzSseBridge />
        <div className="app-roulette-bg">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </div>
      </RouletteLiveApiProvider>
    </QueryClientProvider>
  );
}
