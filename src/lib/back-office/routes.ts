/** Caminhos canónicos do back office — única estrutura visível ao utilizador. */
export const BACK_OFFICE_PATHS = {
  home: "/back-office",
  suporte: "/back-office/suporte",
  casinoAoVivo: "/back-office/operacoes/casino-ao-vivo",
} as const;

export type BackOfficePath = (typeof BACK_OFFICE_PATHS)[keyof typeof BACK_OFFICE_PATHS];

/** Ferramentas operacionais abertas a partir do back office (sem menu legado). */
export const BACK_OFFICE_WORKSPACE_PATHS = [
  "/sala-rotativa-um-fator",
  "/sala-rotativa-dois-fatores",
  "/sala-rotativa-fibonacci",
  "/sala-rotativa",
  "/casino-mesa",
  "/football-blitz",
  "/super-trunfo",
] as const;

export function isBackOfficeWorkspacePath(pathname: string): boolean {
  return (
    pathname === "/casino-mesa" ||
    pathname === "/football-blitz" ||
    pathname === "/super-trunfo" ||
    pathname === "/sala-rotativa-um-fator" ||
    pathname === "/sala-rotativa-dois-fatores" ||
    pathname === "/sala-rotativa-fibonacci" ||
    pathname.startsWith("/sala-rotativa")
  );
}
