import { Link } from "@tanstack/react-router";
import {
  Bell,
  Headphones,
  Link2,
  Mail,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export type UtilityPanelId =
  | "notifications"
  | "messages"
  | "affiliate"
  | "support"
  | null;

type RailItem = {
  id: Exclude<UtilityPanelId, null>;
  icon: typeof Bell;
  labelKey: string;
  badge?: number;
};

const RAIL_ITEMS: RailItem[] = [
  { id: "notifications", icon: Bell, labelKey: "layout.notifications", badge: 3 },
  { id: "messages", icon: Mail, labelKey: "layout.messages", badge: 2 },
  { id: "affiliate", icon: Link2, labelKey: "layout.affiliate" },
  { id: "support", icon: Headphones, labelKey: "layout.support" },
];

type Props = {
  activePanel: UtilityPanelId;
  onSelectPanel: (id: UtilityPanelId) => void;
  referralCode: string;
  referralLink?: string;
};

export function BackOfficeUtilityRail({
  activePanel,
  onSelectPanel,
  referralCode,
  referralLink,
}: Props) {
  const { t } = useI18n();

  const toggle = (id: Exclude<UtilityPanelId, null>) => {
    onSelectPanel(activePanel === id ? null : id);
  };

  return (
    <>
      {activePanel ? (
        <button
          type="button"
          className="utility-panel-backdrop fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] lg:left-[var(--app-sidebar-width,0px)]"
          aria-label={t("common.close")}
          onClick={() => onSelectPanel(null)}
        />
      ) : null}

      {activePanel ? (
        <aside className="utility-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border-color bg-bg-card shadow-2xl sm:max-w-[380px] lg:right-14 lg:w-[min(calc(100vw-3.5rem),380px)]">
          <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
              {activePanel === "notifications"
                ? t("layout.notifications")
                : activePanel === "messages"
                  ? t("utility.messagesTitle")
                  : activePanel === "affiliate"
                    ? t("utility.affiliateTitle")
                    : t("utility.supportTitle")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onSelectPanel(null)}
              aria-label={t("common.close")}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activePanel === "notifications" ? (
              <div className="space-y-3">
                {[1, 2, 3].map((key) => (
                  <div key={key} className="theme-card rounded-xl p-3">
                    <p className="text-sm font-semibold">{t(`notifications.title${key}`)}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {t(`notifications.body${key}`)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {activePanel === "messages" ? (
              <div className="theme-card flex min-h-[200px] flex-col items-center justify-center rounded-xl p-6 text-center">
                <MessageSquare className="mb-3 size-8 text-text-secondary" aria-hidden />
                <p className="text-sm text-text-secondary">{t("utility.messagesEmpty")}</p>
              </div>
            ) : null}

            {activePanel === "affiliate" ? (
              <div className="space-y-3">
                <ReferralLinkField
                  referralCode={referralCode}
                  referralLink={referralLink}
                  showCode
                />
              </div>
            ) : null}

            {activePanel === "support" ? (
              <div className="space-y-4">
                <Button asChild className="w-full">
                  <Link to="/back-office/suporte">{t("layout.support")}</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      <nav
        className="utility-rail fixed inset-y-0 right-0 z-30 hidden w-14 flex-col items-center border-l border-border-color bg-bg-card py-3 lg:flex"
        aria-label="Quick actions"
      >
        <div className="flex flex-1 flex-col items-center gap-2">
          {RAIL_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePanel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary",
                )}
                aria-label={t(item.labelKey)}
                aria-pressed={active}
              >
                <Icon className="size-[18px]" aria-hidden />
                {item.badge ? (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-auto flex size-10 items-center justify-center rounded-xl text-text-secondary hover:bg-bg-card-hover hover:text-primary"
          aria-label="AI"
        >
          <Sparkles className="size-[18px]" aria-hidden />
        </button>
      </nav>
    </>
  );
}
