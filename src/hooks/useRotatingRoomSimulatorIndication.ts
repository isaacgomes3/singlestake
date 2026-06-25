import { useEffect, useState } from "react";

import {
  ROTATING_ROOM_SIMULATOR_CHANGED_EVENT,
  bootstrapRotatingRoomSimulatorIndication,
  getRotatingRoomSimulatorIndication,
  isRotatingRoomSimulatorConnected,
} from "@/lib/roulette/rotatingRoomSimulatorClient";
import type { RotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorTypes";
import { useRouletteLiveApi } from "@/lib/roulette/rouletteLiveApiContext";

export function useRotatingRoomSimulatorIndication(): {
  indication: RotatingRoomSimulatorIndication | null;
  connected: boolean;
} {
  const { liveApiEnabled } = useRouletteLiveApi();
  const [indication, setIndication] = useState<RotatingRoomSimulatorIndication | null>(() =>
    getRotatingRoomSimulatorIndication(),
  );
  const [connected, setConnected] = useState(() => isRotatingRoomSimulatorConnected());

  useEffect(() => {
    const sync = () => {
      setIndication(getRotatingRoomSimulatorIndication());
      setConnected(isRotatingRoomSimulatorConnected());
    };
    window.addEventListener(ROTATING_ROOM_SIMULATOR_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ROTATING_ROOM_SIMULATOR_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!liveApiEnabled) {
      setConnected(false);
      return;
    }
    void bootstrapRotatingRoomSimulatorIndication();
  }, [liveApiEnabled]);

  return { indication, connected };
}
