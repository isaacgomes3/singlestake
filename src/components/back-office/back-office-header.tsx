import { CheckCheck, Sparkles } from "lucide-react";

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
  onLogout: () => void;
};

export function BackOfficeHeader({
  user,
  sidebarBoxed,
  onToggleSidebarLayout,
  onLogout,
}: Props) {
  const { t } = useI18n();

  return (
    <header className="app-top-bar sticky top-0 z-30 flex flex-wrap items-center justify-end gap-2 px-3 py-2.5 sm:px-4 lg:px-5">
      <div className="flex items-center gap-1 sm:gap-1.5">
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
