import { CheckCheck, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { BackOfficeUserMenu } from "@/components/back-office/back-office-user-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/i18n-provider";
import type { AuthUser } from "@/lib/auth/session";

type Props = {
  user: AuthUser;
  sidebarBoxed: boolean;
  onToggleSidebarLayout: () => void;
  onOpenSearch: () => void;
  onLogout: () => void;
};

export function BackOfficeHeader({
  user,
  sidebarBoxed,
  onToggleSidebarLayout,
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

        <BackOfficeUserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
