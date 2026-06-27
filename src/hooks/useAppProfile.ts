import { useMemo } from "react";

import { resolveAppProfile, type AppProfile } from "@/lib/app-profile";

export function useAppProfile(): AppProfile {
  return useMemo(() => resolveAppProfile(), []);
}
