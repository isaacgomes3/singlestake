import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { BackOfficeModulePage } from "@/components/back-office/back-office-module-page";
import {
  getBackOfficeGroup,
  type BackOfficeGroupId,
  type BackOfficeModuleId,
} from "@/lib/back-office/navigation";

export const Route = createFileRoute("/back-office/$groupId/$moduleId")({
  beforeLoad: ({ params }) => {
    if (params.moduleId === "residual") {
      throw redirect({ to: "/back-office/rede/bonus-equipe" });
    }
    const group = getBackOfficeGroup(params.groupId);
    if (!group) throw notFound();
    if (!group.moduleIds.includes(params.moduleId as BackOfficeModuleId)) {
      throw notFound();
    }
  },
  head: ({ params }) => {
    const group = getBackOfficeGroup(params.groupId);
    const mod = group?.moduleIds.find((id) => id === params.moduleId);
    return {
      meta: [{ title: `${mod ?? params.moduleId} — ${group?.label ?? "Back office"}` }],
    };
  },
  component: BackOfficeGroupModuleRoute,
});

function BackOfficeGroupModuleRoute() {
  const { moduleId } = Route.useParams();
  return <BackOfficeModulePage moduleId={moduleId as BackOfficeModuleId} />;
}
