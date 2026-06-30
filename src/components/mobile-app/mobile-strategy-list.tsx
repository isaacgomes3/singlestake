import { Link } from "@tanstack/react-router";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";

import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import { automationWorkspaceHref } from "@/lib/app-profile";
import { isStrategyGlobalEnabled } from "@/lib/roulette/strategyGlobalClient";
import { mobileLifetimeAssertivenessPct } from "@/lib/roulette/mobileSignalUi";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";
import { cn } from "@/lib/utils";

type StrategyItem = {
  id: StrategyGlobalKind | "sala2fatores" | "fibonacci";
  title: string;
  subtitle: string;
  to: string;
  external?: boolean;
  sessionPct?: number;
};

function StrategyRow({ item, pct }: { item: StrategyItem; pct: number | null }) {
  const tone = assertivenessTone(pct);
  const TrendIcon = tone === "down" ? TrendingDown : TrendingUp;

  const className =
    "flex items-center gap-3 rounded-2xl border border-neutral-800/90 bg-neutral-900/80 px-4 py-4 transition active:scale-[0.99] hover:bg-neutral-900";
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-amber-400">{item.title}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{item.subtitle}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-300">
          <TrendIcon
            className={cn(
              "h-4 w-4 shrink-0",
              tone === "up" && "text-emerald-400",
              tone === "down" && "text-rose-400",
              tone === "flat" && "text-amber-400/90",
            )}
            aria-hidden
          />
          <span>{pct != null ? `${pct.toFixed(2)}%` : "—"} de assertividade</span>
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-neutral-600" aria-hidden />
    </>
  );

  if (item.external) {
    return (
      <a href={item.to} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link to="/mobile/um1fator" className={className}>
      {inner}
    </Link>
  );
}

function assertivenessTone(pct: number | null): "up" | "down" | "flat" {
  if (pct == null) return "flat";
  if (pct >= 90) return "up";
  if (pct < 75) return "down";
  return "flat";
}

export function MobileStrategyListPage() {
  const globalSnap = useStrategyGlobalSnapshot();
  const globalOn = isStrategyGlobalEnabled() && globalSnap != null;

  const items: StrategyItem[] = [
    {
      id: "um1fator",
      title: "1 Fator",
      subtitle: "Sala rotativa · confirmação t1/t2",
      to: "/mobile/um1fator",
    },
    {
      id: "sala2fatores",
      title: "2 Fatores",
      subtitle: "Cruzamento ausente ≥18 giros",
      to: automationWorkspaceHref("/sala-rotativa-dois-fatores"),
      external: true,
    },
    {
      id: "fibonacci",
      title: "Fibonacci",
      subtitle: "Dúzias/colunas · ausência 14 giros",
      to: automationWorkspaceHref("/sala-rotativa-fibonacci"),
      external: true,
    },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Roletas ao vivo</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Escolha a estratégia</h1>
      </header>
      <ul className="space-y-3">
        {items.map((item) => {
          let pct: number | null = null;
          if (globalOn && globalSnap && item.id !== "sala2fatores" && item.id !== "fibonacci") {
            const life = globalSnap.lifetime[item.id as StrategyGlobalKind];
            pct = mobileLifetimeAssertivenessPct(life.wins, life.losses);
          }
          if (item.id === "sala2fatores" && globalOn && globalSnap) {
            const life = globalSnap.lifetime.dois2fatores;
            pct = mobileLifetimeAssertivenessPct(life.wins, life.losses);
          }
          if (pct == null && item.sessionPct != null) {
            pct = item.sessionPct;
          }
          return (
            <li key={item.id}>
              <StrategyRow item={item} pct={pct} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Export helper for session pct fallback in signal pages if needed */
export { rotatingRoomSessionAproveitamentoPct };
