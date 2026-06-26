import { createContext, useContext, type ReactNode } from "react";

type RouletteLiveApiContextValue = {
  /** API ao vivo permanece sempre ligada — sem toggle na UI. */
  liveApiEnabled: true;
};

const LIVE_API_ALWAYS_ON: RouletteLiveApiContextValue = { liveApiEnabled: true };

const RouletteLiveApiContext = createContext<RouletteLiveApiContextValue>(LIVE_API_ALWAYS_ON);

export function RouletteLiveApiProvider({ children }: { children: ReactNode }) {
  return (
    <RouletteLiveApiContext.Provider value={LIVE_API_ALWAYS_ON}>
      {children}
    </RouletteLiveApiContext.Provider>
  );
}

/** Hook usado com o Provider na mesma feature (TanStack Fast Refresh). */
// eslint-disable-next-line react-refresh/only-export-components -- par Provider + hook
export function useRouletteLiveApi(): RouletteLiveApiContextValue {
  return useContext(RouletteLiveApiContext);
}
