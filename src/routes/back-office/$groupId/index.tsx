import { createFileRoute, redirect } from "@tanstack/react-router";

import { getBackOfficeGroup } from "@/lib/back-office/navigation";

export const Route = createFileRoute("/back-office/$groupId/")({
  beforeLoad: ({ params }) => {
    const group = getBackOfficeGroup(params.groupId);
    if (!group) return;

    throw redirect({
      to: "/back-office/$groupId/$moduleId",
      params: { groupId: params.groupId, moduleId: group.moduleIds[0] },
    });
  },
  component: () => null,
});
