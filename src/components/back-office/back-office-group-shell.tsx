import { Outlet, useRouterState } from "@tanstack/react-router";

import {
  getBackOfficeGroup,
  getBackOfficeModule,
  type BackOfficeGroupId,
} from "@/lib/back-office/navigation";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { navGroupDescription, navGroupLabel, navModuleDescription, navModuleLabel } from "@/lib/i18n/messages";

type Props = {
  groupId: BackOfficeGroupId;
};

export function BackOfficeGroupShell({ groupId }: Props) {
  const { messages } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const group = getBackOfficeGroup(groupId);

  if (!group) return null;

  const moduleSegment = pathname.split("/").pop();
  const currentModule =
    moduleSegment && moduleSegment !== groupId
      ? getBackOfficeModule(moduleSegment)
      : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
          {navGroupLabel(messages, group.id)}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary sm:text-3xl">
          {currentModule ? navModuleLabel(messages, currentModule.id) : navGroupLabel(messages, group.id)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          {currentModule
            ? navModuleDescription(messages, currentModule.id)
            : navGroupDescription(messages, group.id)}
        </p>
      </div>

      <Outlet />
    </div>
  );
}
