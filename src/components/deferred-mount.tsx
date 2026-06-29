import { useEffect, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Atrasa montagem para não bloquear hidratação do shell (back office). */
  delayMs?: number;
};

export function DeferredMount({ children, delayMs = 0 }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (delayMs <= 0) {
      const id = window.requestAnimationFrame(() => setReady(true));
      return () => window.cancelAnimationFrame(id);
    }
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return ready ? children : null;
}
