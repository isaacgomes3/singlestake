import { useEffect, useState } from "react";

/**
 * Valor estável por **hora civil local** (legado — o placar já não recorta por hora).
 */
export function usePlacarHourClock(): number {
  const [hourBucket, setHourBucket] = useState(() => Math.floor(Date.now() / 3_600_000));
  useEffect(() => {
    const id = window.setInterval(() => {
      const b = Math.floor(Date.now() / 3_600_000);
      setHourBucket((prev) => (prev !== b ? b : prev));
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);
  return hourBucket;
}
