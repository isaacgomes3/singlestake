import { useEffect, useState } from "react";

/** Incrementa quando o separador volta a ficar visível — força recuperação do placar. */
export function useStrategySessionVisibilityEpoch(): number {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setEpoch((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return epoch;
}
