import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  LogOut,
  Monitor,
  Moon,
  Percent,
  Settings,
  Store,
  Sun,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { isAdminUser } from "@/lib/back-office/admin-access";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";

type Props = {
  user: AuthUser;
  onLogout: () => void;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function BackOfficeUserMenu({ user, onLogout }: Props) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const isAdmin = isAdminUser(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
        <span className="relative">
          <Avatar className="size-9 border border-border-color">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-bg-primary bg-emerald-500" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-3 gap-1 p-2">
          {(
            [
              ["light", Sun, t("layout.themeLight")],
              ["dark", Moon, t("layout.themeDark")],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-medium transition-colors",
                theme === mode
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border-color text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="flex flex-col items-center gap-1 rounded-lg border border-border-color px-2 py-2 text-[10px] font-medium text-muted-foreground"
            aria-label={t("layout.themeSystem")}
            disabled
          >
            <Monitor className="size-4 opacity-50" aria-hidden />
            {t("layout.themeSystem")}
          </button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/back-office" className="cursor-pointer">
            <Store className="mr-2 size-4" aria-hidden />
            {t("layout.yourStore")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {}}>
          <Percent className="mr-2 size-4" aria-hidden />
          {t("layout.affiliateProgram")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {}}>
          <BookOpen className="mr-2 size-4" aria-hidden />
          {t("layout.documentation")}
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/back-office/administracao/admin" className="cursor-pointer">
              <Settings className="mr-2 size-4" aria-hidden />
              {t("layout.settings")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" aria-hidden />
          {t("common.logout")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          <User className="mr-2 size-4" aria-hidden />
          {user.role === "admin" ? t("layout.roleAdmin") : t("layout.roleUser")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
