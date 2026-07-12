/** Caminhos canónicos do back office — única estrutura visível ao utilizador. */
export const BACK_OFFICE_PATHS = {
  home: "/back-office",
  suporte: "/back-office/suporte",
  salaRotativa: "/sala-rotativa-um-fator",
} as const;

export type BackOfficePath = (typeof BACK_OFFICE_PATHS)[keyof typeof BACK_OFFICE_PATHS];

/** Ferramentas operacionais — salas rotativas (automação / sinal manual). */
export const BACK_OFFICE_WORKSPACE_PATHS = [
  "/sala-rotativa-um-fator",
  "/sala-rotativa-dois-fatores",
  "/sala-rotativa-fibonacci",
  "/sala-rotativa-sequencias",
  "/sala-rotativa",
] as const;

export function isBackOfficeWorkspacePath(pathname: string): boolean {
  return (
    pathname === "/sala-rotativa-um-fator" ||
    pathname === "/sala-rotativa-dois-fatores" ||
    pathname === "/sala-rotativa-fibonacci" ||
    pathname === "/sala-rotativa-sequencias" ||
    pathname.startsWith("/sala-rotativa")
  );
}
