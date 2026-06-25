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
  type BackOfficeNavItem,
} from "@/lib/back-office/navigation";
import { cn } from "@/lib/utils";

type Props = {
  mobile?: boolean;
  onNavigate?: () => void;
  onLogout?: () => void;
};

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
  onNavigate,
}: {
  mod: BackOfficeNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = mod.icon;
  return (
    <Link
      to={mod.path}
      onClick={() => onNavigate?.()}
      className={cn(
        "theme-sidebar-item flex items-center gap-2 rounded-lg py-2 pl-4 pr-3 text-[13px] font-medium",
        "ml-2 border-l-2 border-sidebar-border-fixed",
        active && "theme-sidebar-item-active",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{mod.label}</span>
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const modules = getModulesForGroup(group.id);
  const sections = getGroupSections(group.id);
  const active = isGroupActive(pathname, group);
  const Icon = group.icon;

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
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleGroupClick}
        className={cn(
          "theme-sidebar-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
          active && !expanded && "theme-sidebar-item-active",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        )}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-0.5 pb-1">
          {sections
            ? sections.map((section) => {
                const sectionModules = section.moduleIds
                  .map((id) => modules.find((m) => m.id === id))
                  .filter((m): m is BackOfficeNavItem => m != null);
                if (sectionModules.length === 0) return null;
                const showSectionLabel = sections.length > 1;
                return (
                  <div key={section.label} className="flex flex-col gap-0.5">
                    {showSectionLabel ? (
                      <p className="ml-4 mt-1 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-fg-muted">
                        {section.label}
                      </p>
                    ) : null}
                    {sectionModules.map((mod) => (
                      <ModuleLink
                        key={mod.id}
                        mod={mod}
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

  const items = backOfficeSidebarNav();

  return (
    <nav
      className={cn("flex flex-col gap-0.5", mobile ? "p-4" : "px-3 py-2")}
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
                "theme-sidebar-item flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
                active && "theme-sidebar-item-active",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{item.label}</span>
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
              "theme-sidebar-item flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
              active && "theme-sidebar-item-active",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{item.label}</span>
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
          className="theme-sidebar-item mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium"
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="truncate">Sair</span>
        </button>
      ) : null}
    </nav>
  );
}
