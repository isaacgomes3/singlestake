import type { BackOfficeGroupId, BackOfficeModuleId } from "@/lib/back-office/navigation";

export const BACK_OFFICE_ADMIN_GROUP_ID: BackOfficeGroupId = "administracao";

export const BACK_OFFICE_ADMIN_ONLY_MODULE_IDS = new Set<BackOfficeModuleId>([
  "automacao-config",
  "automacao-estatisticas",
  "painel-financeiro",
  "gestao-clientes",
  "admin",
  "auditoria",
]);

export function isAdminUser(user?: { role: string } | null): boolean {
  return user?.role === "admin";
}

export function isBackOfficeAdminModule(moduleId: string): boolean {
  return BACK_OFFICE_ADMIN_ONLY_MODULE_IDS.has(moduleId as BackOfficeModuleId);
}

export function isBackOfficeAdminGroup(groupId: string): boolean {
  return groupId === BACK_OFFICE_ADMIN_GROUP_ID;
}

export function isBackOfficeAdminPath(pathname: string): boolean {
  return pathname === "/back-office/administracao" || pathname.startsWith("/back-office/administracao/");
}
