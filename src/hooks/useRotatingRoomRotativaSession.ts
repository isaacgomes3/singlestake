import { useMemo } from "react";

import {
  useRotatingRoomCrossingSession,
  type RotatingRoomCrossingSession,
} from "@/hooks/useRotatingRoomCrossingSession";
import {
  useRotatingRoomUmFatorSession,
  type RotatingRoomUmFatorSession,
} from "@/hooks/useRotatingRoomUmFatorSession";
import {
  mergeRotatingRoomRotativaSession,
  type RotatingRoomRotativaSession,
} from "@/lib/roulette/rotatingRoomRotativaMerge";
import { isAnyCrossingGatilhoEnabled } from "@/lib/roulette/umFatorTriggerEnable";

type Options = {
  observeOnly?: boolean;
  preferLocalSession?: boolean;
};

export type { RotatingRoomRotativaSession };

export function useRotatingRoomRotativaSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomRotativaSession {
  const umFator = useRotatingRoomUmFatorSession(tableIds, histories, {
    observeOnly: options.observeOnly,
    preferLocalSession: options.preferLocalSession,
  });
  const crossingEnabled = isAnyCrossingGatilhoEnabled();
  const crossing = useRotatingRoomCrossingSession(tableIds, histories, {
    observeOnly: options.observeOnly,
    enabled: crossingEnabled,
  });

  return useMemo(
    () =>
      mergeRotatingRoomRotativaSession(umFator, crossing, {
        crossingEnabled,
      }),
    [umFator, crossing, crossingEnabled],
  );
}

export function isRotativaCrossingSession(
  session: RotatingRoomRotativaSession,
): session is RotatingRoomCrossingSession & { rotativaTrigger: "crossing" } {
  return session.rotativaTrigger === "crossing";
}

export function isRotativaUmFatorSession(
  session: RotatingRoomRotativaSession,
): session is RotatingRoomUmFatorSession & { rotativaTrigger: "umFator" } {
  return session.rotativaTrigger === "umFator";
}
