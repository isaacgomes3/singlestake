import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Headphones,
  Link2,
  Mail,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BackOfficeUserMenu } from "@/components/back-office/back-office-user-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/i18n-provider";
import type { AuthUser } from "@/lib/auth/session";
import type { UtilityPanelId } from "@/components/back-office/back-office-utility-rail";
import { cn } from "@/lib/utils";

type Props = {
  user: AuthUser;
  sidebarBoxed: boolean;
  onToggleSidebarLayout: () => void;
  onOpenUtility: (id: UtilityPanelId) => void;
  onOpenSearch: () => void;
  onLogout: () => void;
};

const MOCK_NOTIFICATIONS = [
  { id: "1", minutes: 9, key: "1" as const },
  { id: "2", minutes: 42, key: "2" as const },
  { id: "3", minutes: 120, key: "3" as const },
];

export function BackOfficeHeader({
  user,
  sidebarBoxed,
  onToggleSidebarLayout,
  onOpenUtility,
  onOpenSearch,
  onLogout,
}: Props) {
  const { t } = useI18n();
  const [searchShortcut, setSearchShortcut] = useState("⌘K");

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    setSearchShortcut(isMac ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenSearch]);

  return (
    <header className="app-top-bar sticky top-0 z-30 flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 lg:px-5">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-color bg-bg-card/80 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary sm:max-w-md lg:max-w-xl"
      >
        <Search className="size-4 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{t("layout.search")}</span>
        <kbd className="ml-auto hidden rounded-md border border-border-color bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary sm:inline">
          {searchShortcut}
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-9 text-text-secondary hover:text-text-primary sm:inline-flex"
              aria-label={t("layout.layoutMenu")}
            >
              <Sparkles className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{t("layout.layoutMenu")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={onToggleSidebarLayout}>
              <div>
                <p className="font-medium">{t("layout.boxedMenu")}</p>
                <p className="text-xs text-muted-foreground">{t("layout.boxedMenuDesc")}</p>
              </div>
              {sidebarBoxed ? <CheckCheck className="ml-auto size-4 text-primary" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleSidebarLayout}>
              <div>
                <p className="font-medium">{t("layout.edgeMenu")}</p>
                <p className="text-xs text-muted-foreground">{t("layout.edgeMenuDesc")}</p>
              </div>
              {!sidebarBoxed ? <CheckCheck className="ml-auto size-4 text-primary" /> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LocaleSwitcher compact className="hidden sm:inline-flex" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-9 text-text-secondary hover:text-text-primary"
              aria-label={t("layout.notifications")}
            >
              <Bell className="size-4" aria-hidden />
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
              <p className="text-sm font-semibold">{t("layout.notifications")}</p>
              <button type="button" className="inline-flex items-center gap-1 text-xs text-primary">
                <CheckCheck className="size-3.5" aria-hidden />
                {t("common.markAllRead")}
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {MOCK_NOTIFICATIONS.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border-color/60 bg-bg-card/50 p-3 text-sm"
                >
                  <p className="font-medium text-text-primary">
                    {t(`notifications.title${item.key}`)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {t(`notifications.body${item.key}`)}
                  </p>
                  <p className="mt-2 text-[10px] text-text-secondary">
                    {t("notifications.ago", { minutes: item.minutes })}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-border-color p-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-primary"
                onClick={() => onOpenUtility("notifications")}
              >
                {t("common.viewAll")}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden size-9 text-text-secondary hover:text-text-primary md:inline-flex"
          aria-label={t("layout.messages")}
          onClick={() => onOpenUtility("messages")}
        >
          <Mail className="size-4" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden size-9 text-text-secondary hover:text-text-primary lg:inline-flex"
          aria-label={t("layout.support")}
          asChild
        >
          <Link to="/back-office/suporte">
            <Headphones className="size-4" aria-hidden />
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden size-9 text-text-secondary hover:text-text-primary xl:inline-flex"
          aria-label={t("layout.affiliate")}
          onClick={() => onOpenUtility("affiliate")}
        >
          <Link2 className="size-4" aria-hidden />
        </Button>

        <BackOfficeUserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
