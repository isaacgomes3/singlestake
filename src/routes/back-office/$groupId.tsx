import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { BackOfficeGroupShell } from "@/components/back-office/back-office-group-shell";
import { requireAdminRole } from "@/lib/auth/admin-gate";
import {
  BACK_OFFICE_GROUP_IDS,
  getBackOfficeGroup,
  getBackOfficeModule,
  getGroupForModule,
  type BackOfficeGroupId,
  type BackOfficeModuleId,
} from "@/lib/back-office/navigation";
import { isBackOfficeAdminGroup } from "@/lib/back-office/admin-access";

export const Route = createFileRoute("/back-office/$groupId")({
  beforeLoad: async ({ params }) => {
    if (params.groupId === "relatorios") {
      throw redirect({ to: "/back-office" });
    }
    if (isBackOfficeAdminGroup(params.groupId)) {
      await requireAdminRole();
    }
    const { groupId } = params;

    if (BACK_OFFICE_GROUP_IDS.has(groupId as BackOfficeGroupId)) {
      return;
    }

    const legacyModule = getBackOfficeModule(groupId);
    if (legacyModule && legacyModule.id !== "visao-geral") {
      const group = getGroupForModule(legacyModule.id as BackOfficeModuleId);
      if (group) {
        throw redirect({
          to: "/back-office/$groupId/$moduleId",
          params: { groupId: group.id, moduleId: legacyModule.id },
        });
      }
    }

    throw notFound();
  },
  component: BackOfficeGroupLayout,
});

function BackOfficeGroupLayout() {
  const { groupId } = Route.useParams();
  return <BackOfficeGroupShell groupId={groupId as BackOfficeGroupId} />;
}
