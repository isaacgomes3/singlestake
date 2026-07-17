import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { BackOfficeModulePage } from "@/components/back-office/back-office-module-page";
import { requireAdminRole } from "@/lib/auth/admin-gate";
import {
  getBackOfficeGroup,
  type BackOfficeGroupId,
  type BackOfficeModuleId,
} from "@/lib/back-office/navigation";
import { isBackOfficeAdminGroup, isBackOfficeAdminModule } from "@/lib/back-office/admin-access";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

const SUBSCRIPTION_GATED_MODULES = new Set<BackOfficeModuleId>([]);

export const Route = createFileRoute("/back-office/$groupId/$moduleId")({
  beforeLoad: async ({ params }) => {
    if (params.groupId === "operacoes" || params.moduleId === "casino-ao-vivo") {
      throw redirect({ to: "/back-office" });
    }
    if (params.moduleId === "operacoes") {
      throw redirect({ to: "/back-office" });
    }
    if (params.moduleId === "relatorios-rede") {
      throw redirect({ to: "/back-office" });
    }
    if (params.moduleId === "residual") {
      throw redirect({ to: "/back-office/rede/bonus-equipe" });
    }
    if (params.moduleId === "extrato" || params.moduleId === "automacao-global") {
      throw redirect({ to: "/back-office" });
    }
    if (params.moduleId === "central-qualificacao") {
      throw redirect({ to: "/back-office/rede/bonus-equipe" });
    }
    const group = getBackOfficeGroup(params.groupId);
    if (!group) throw notFound();
    if (!group.moduleIds.includes(params.moduleId as BackOfficeModuleId)) {
      throw notFound();
    }
    if (isBackOfficeAdminGroup(params.groupId) || isBackOfficeAdminModule(params.moduleId)) {
      await requireAdminRole();
    }
    if (SUBSCRIPTION_GATED_MODULES.has(params.moduleId as BackOfficeModuleId)) {
      await requireActiveSubscription();
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
