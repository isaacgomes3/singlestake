import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import {
  backOfficeSidebarNav,
  getGroupSections,
  getModulesForGroup,
  isGroupActive,
  type BackOfficeGroup,
  type BackOfficeGroupId,
  type BackOfficeModuleId,
  type BackOfficeNavItem,
} from "@/lib/back-office/navigation";
import { getSession } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/back-office/admin-access";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { navGroupLabel, navModuleLabel, navSectionLabel } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Props = {
  mobile?: boolean;
  onNavigate?: () => void;
  onLogout?: () => void;
};

/** Módulos recentes — borda laranja + badge NOVO (referência DinhuTech). */
const NOVO_MODULE_IDS = new Set<BackOfficeModuleId>([
  "automacao-football-blitz",
  "automacao-football-studio",
  "automacao-sequencias",
]);

function activeGroupIdFromPath(pathname: string): BackOfficeGroupId | null {
  for (const entry of backOfficeSidebarNav()) {
    if (entry.kind === "group" && isGroupActive(pathname, entry.item)) {
      return entry.item.id;
    }
  }
  return null;
}

function ModuleLink({
  mod,
  active,
  label,
  onNavigate,
}: {
  mod: BackOfficeNavItem;
  active: boolean;
  label: string;
  onNavigate?: () => void;
}) {
  const Icon = mod.icon;
  const isNovo = NOVO_MODULE_IDS.has(mod.id);
  return (
    <Link
      to={mod.path}
      onClick={() => onNavigate?.()}
      className={cn(
        "theme-sidebar-item flex items-center gap-2 rounded-full py-2 pl-3 pr-2 text-[11px]",
        "ml-1",
        active && "theme-sidebar-item-active",
        !active && isNovo && "theme-sidebar-item-novo",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isNovo && !active ? (
        <span className="shrink-0 rounded-full bg-[var(--brand-orange,#ff6b00)] px-1.5 py-0.5 text-[8px] font-black tracking-wide text-black">
          NOVO
        </span>
      ) : null}
    </Link>
  );
}

function GroupNav({
  group,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: BackOfficeGroup;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { messages } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const modules = getModulesForGroup(group.id);
  const sections = getGroupSections(group.id);
  const active = isGroupActive(pathname, group);
  const Icon = group.icon;
  const groupLabel = navGroupLabel(messages, group.id);

  const handleGroupClick = () => {
    if (!expanded) {
      onToggle();
      const first = modules[0];
      if (first && pathname !== first.path) {
        void navigate({ to: first.path });
      }
    } else {
      onToggle();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="theme-sidebar-section px-3 pt-3 pb-1">{groupLabel}</p>
      <button
        type="button"
        onClick={handleGroupClick}
        className={cn(
          "theme-sidebar-item flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-[12px]",
          active && !expanded && "theme-sidebar-item-active",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{groupLabel}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        )}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-1 pb-1">
          {sections
            ? sections.map((section) => {
                const sectionModules = section.moduleIds
                  .map((id) => modules.find((m) => m.id === id))
                  .filter((m): m is BackOfficeNavItem => m != null);
                if (sectionModules.length === 0) return null;
                const showSectionLabel = sections.length > 1;
                return (
                  <div key={section.key} className="flex flex-col gap-1">
                    {showSectionLabel ? (
                      <p className="theme-sidebar-section ml-2 mt-1 px-2">
                        {navSectionLabel(messages, section.key)}
                      </p>
                    ) : null}
                    {sectionModules.map((mod) => (
                      <ModuleLink
                        key={mod.id}
                        mod={mod}
                        label={navModuleLabel(messages, mod.id)}
                        active={pathname === mod.path}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                );
              })
            : modules.map((mod) => (
                <ModuleLink
                  key={mod.id}
                  mod={mod}
                  label={navModuleLabel(messages, mod.id)}
                  active={pathname === mod.path}
                  onNavigate={onNavigate}
                />
              ))}
        </div>
      ) : null}
    </div>
  );
}

export function BackOfficeSidebarNav({ mobile, onNavigate, onLogout }: Props) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [expandedGroups, setExpandedGroups] = useState<Set<BackOfficeGroupId>>(() => {
    const active = activeGroupIdFromPath(pathname);
    return active ? new Set([active]) : new Set();
  });

  useEffect(() => {
    const active = activeGroupIdFromPath(pathname);
    if (active) {
      setExpandedGroups((prev) => {
        if (prev.has(active)) return prev;
        const next = new Set(prev);
        next.add(active);
        return next;
      });
    }
  }, [pathname]);

  const toggleGroup = (groupId: BackOfficeGroupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const isAdmin = isAdminUser(getSession()?.user);
  const items = backOfficeSidebarNav().filter(
    (entry) => entry.kind !== "group" || entry.item.id !== "administracao" || isAdmin,
  );

  return (
    <nav
      className={cn("flex flex-col gap-1", mobile ? "p-4" : "px-2 py-2")}
      aria-label="Back office"
    >
      {items.map((entry) => {
        if (entry.kind === "overview") {
          const { item } = entry;
          const Icon = item.icon;
          const active = pathname === "/back-office";
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => onNavigate?.()}
              className={cn(
                "theme-sidebar-item flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[12px]",
                active && "theme-sidebar-item-active",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{t("nav.overview")}</span>
            </Link>
          );
        }

        if (entry.kind === "group") {
          const { item: group } = entry;
          return (
            <GroupNav
              key={group.id}
              group={group}
              expanded={expandedGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              onNavigate={onNavigate}
            />
          );
        }

        const { item } = entry;
        const Icon = item.icon;
        const active = pathname === item.path;
        return (
          <Link
            key={item.id}
            to={item.path}
            onClick={() => onNavigate?.()}
            className={cn(
              "theme-sidebar-item flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[12px]",
              active && "theme-sidebar-item-active",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{t("nav.suporte")}</span>
          </Link>
        );
      })}
      {onLogout ? (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className="theme-sidebar-item mt-2 flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-[12px]"
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="truncate">{t("common.logout")}</span>
        </button>
      ) : null}
    </nav>
  );
}
