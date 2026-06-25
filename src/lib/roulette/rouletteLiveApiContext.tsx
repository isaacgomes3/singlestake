import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "roulette.liveApi.enabled";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return false;
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function persist(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type RouletteLiveApiContextValue = {
  liveApiEnabled: boolean;
  setLiveApiEnabled: (enabled: boolean) => void;
  toggleLiveApi: () => void;
};

const RouletteLiveApiContext = createContext<RouletteLiveApiContextValue | null>(null);

export function RouletteLiveApiProvider({ children }: { children: ReactNode }) {
  const [liveApiEnabled, setLiveApiEnabledState] = useState<boolean>(() => readStored());

  const setLiveApiEnabled = useCallback((enabled: boolean) => {
    setLiveApiEnabledState(enabled);
    persist(enabled);
  }, []);

  const toggleLiveApi = useCallback(() => {
    setLiveApiEnabledState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ liveApiEnabled, setLiveApiEnabled, toggleLiveApi }),
    [liveApiEnabled, setLiveApiEnabled, toggleLiveApi],
  );

  return (
    <RouletteLiveApiContext.Provider value={value}>{children}</RouletteLiveApiContext.Provider>
  );
}

/** Hook usado com o Provider na mesma feature (TanStack Fast Refresh). */
// eslint-disable-next-line react-refresh/only-export-components -- par Provider + hook
export function useRouletteLiveApi(): RouletteLiveApiContextValue {
  const ctx = useContext(RouletteLiveApiContext);
  if (!ctx) {
    throw new Error("useRouletteLiveApi deve estar dentro de RouletteLiveApiProvider");
  }
  return ctx;
}
