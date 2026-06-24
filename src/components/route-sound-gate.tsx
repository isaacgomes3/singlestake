import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { setActiveStrategySoundRoute } from "@/lib/sound/strategySoundGate";

/** Regista a rota aberta como única fonte de sons de estratégia. */
export function RouteSoundGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setActiveStrategySoundRoute(pathname);
    return () => setActiveStrategySoundRoute(null);
  }, [pathname]);

  return null;
}
