import { useEffect, useState } from "react";

import { LIVE_SSE_STATUS_EVENT, type LiveSseStatusDetail } from "@/lib/roulette/liveSseEvents";

export function useLiveSseStatus(): LiveSseStatusDetail {
  const [detail, setDetail] = useState<LiveSseStatusDetail>({
    status: "idle",
    message: null,
  });

  useEffect(() => {
    const on = (ev: Event) => {
      const d = (ev as CustomEvent<LiveSseStatusDetail>).detail;
      if (d) setDetail(d);
    };
    window.addEventListener(LIVE_SSE_STATUS_EVENT, on);
    return () => window.removeEventListener(LIVE_SSE_STATUS_EVENT, on);
  }, []);

  return detail;
}
