import { Outlet, useRouterState } from "@tanstack/react-router";

import {
  getBackOfficeGroup,
  getBackOfficeModule,
  type BackOfficeGroupId,
} from "@/lib/back-office/navigation";

type Props = {
  groupId: BackOfficeGroupId;
};

export function BackOfficeGroupShell({ groupId }: Props) {
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
          {group.label}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary sm:text-3xl">
          {currentModule?.label ?? group.label}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          {currentModule?.description ?? group.description}
        </p>
      </div>

      <Outlet />
    </div>
  );
}
