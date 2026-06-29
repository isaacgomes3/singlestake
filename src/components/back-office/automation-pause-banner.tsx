import { useEffect, useState } from "react";
import { PauseCircle } from "lucide-react";

import type { GlobalAutomationConfigDto } from "@/lib/back-office/automation-config";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

type Props = {
  config: GlobalAutomationConfigDto | null;
  className?: string;
};

export function AutomationPauseBanner({ config, className }: Props) {
  const { t } = useI18n();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!config?.resumeAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [config?.resumeAt]);

  if (!config?.blocksNewEntries || !config.displayPauseReason) return null;

  const resumeIn =
    config.resumeAt != null ? formatCountdown(config.resumeAt - Date.now()) : null;

  const titleKey =
    config.displayPauseReason === "manual"
      ? "overview.automation.pauseManualTitle"
      : config.displayPauseReason === "stop-win"
        ? "overview.automation.pauseStopWinTitle"
        : "overview.automation.pauseStopLossTitle";

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3",
        className,
      )}
      role="status"
    >
      <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-warning">{t(titleKey)}</p>
        {resumeIn ? (
          <p className="mt-1 text-xs text-text-secondary">
            {t("overview.automation.pauseResumeIn", { time: resumeIn })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
