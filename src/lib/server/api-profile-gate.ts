import { isAutomationProfile } from "@/lib/app-profile";

const AUTOMATION_BLOCKED_PREFIXES = ["/api/back-office"];

const BACKOFFICE_BLOCKED_PREFIXES = [
  "/api/roulette/strategy-global",
  "/api/roulette/automation-sim",
  "/api/roulette/rotating-room",
  "/api/cron/daily-automation",
];

/** Bloqueia APIs cruzadas entre perfis — isolamento back office ↔ automação. */
export function apiProfileGateMessage(pathname: string): string | null {
  const automation = isAutomationProfile();

  if (automation) {
    for (const prefix of AUTOMATION_BLOCKED_PREFIXES) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return "API do back office indisponível no ambiente de automação.";
      }
    }
    return null;
  }

  for (const prefix of BACKOFFICE_BLOCKED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return "API de automação indisponível no back office — use o subdomínio de automação.";
    }
  }
  return null;
}
