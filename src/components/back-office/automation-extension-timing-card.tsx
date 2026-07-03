import { useMemo } from "react";

import { EXTENSION_PRE_BET_WAIT_SEC } from "@/lib/roulette/liveTableBettingWindow";
import {
  ROTATING_ROOM_CLICK_STAGGER_BASE_MS,
  ROTATING_ROOM_CROSSING_BET_DELAY_MS,
  ROTATING_ROOM_CROSSING_FACTOR_CLICK_STAGGER_MS,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

type Tone = "green" | "blue" | "teal" | "slate";

function toneClasses(tone: Tone) {
  switch (tone) {
    case "green":
      return "bg-kpi-green shadow-[0_4px_16px_rgba(52,168,83,0.32)]";
    case "blue":
      return "bg-kpi-blue shadow-[0_4px_16px_rgba(51,122,183,0.32)]";
    case "teal":
      return "bg-kpi-teal shadow-[0_4px_16px_rgba(31,182,143,0.32)]";
    default:
      return "bg-kpi-slate shadow-md";
  }
}

function TimingMiniButton({
  tone,
  label,
  value,
}: {
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[54px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-kpi-foreground",
        toneClasses(tone),
      )}
    >
      <span className="text-base font-bold tabular-nums leading-none sm:text-lg">{value}</span>
      <span className="mt-1 text-[8px] font-semibold uppercase leading-tight tracking-wide opacity-90">
        {label}
      </span>
    </div>
  );
}

export function AutomationExtensionTimingCard() {
  const { t } = useI18n();

  const items = useMemo(
    () =>
      [
        {
          tone: "teal" as const,
          label: t("overview.timingCard.hold2f"),
          value: `${ROTATING_ROOM_CROSSING_BET_DELAY_MS / 1000} s`,
        },
        {
          tone: "green" as const,
          label: t("overview.timingCard.stagger2f"),
          value: `${ROTATING_ROOM_CROSSING_FACTOR_CLICK_STAGGER_MS} ms`,
        },
        {
          tone: "blue" as const,
          label: t("overview.timingCard.stagger3f"),
          value: `${ROTATING_ROOM_CLICK_STAGGER_BASE_MS} ms`,
        },
        {
          tone: "slate" as const,
          label: t("overview.timingCard.preBet3f"),
          value: `${EXTENSION_PRE_BET_WAIT_SEC} s`,
        },
      ] as const,
    [t],
  );

  return (
    <div
      className="flex min-h-[120px] flex-col justify-center gap-2 rounded-2xl border border-border-color/60 bg-bg-card/40 p-2.5"
      aria-label={t("overview.timingCard.title")}
    >
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        {t("overview.timingCard.title")}
      </p>
      <div className="grid flex-1 grid-cols-2 gap-2">
        {items.map((item) => (
          <TimingMiniButton
            key={item.label}
            tone={item.tone}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>
    </div>
  );
}
