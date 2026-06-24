/** Rota/ecrã activo — só este contexto pode emitir sons de estratégia. */
let activeRoutePath: string | null = null;

/** Bloqueio temporário (ex.: lobby noutra secção que ainda monta hooks). */
let soundSuppressed = false;

let pageVisible =
  typeof document === "undefined" ? true : document.visibilityState === "visible";

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    pageVisible = document.visibilityState === "visible";
  });
}

export function setActiveStrategySoundRoute(path: string | null): void {
  activeRoutePath = path;
}

export function setStrategySoundSuppressed(suppressed: boolean): void {
  soundSuppressed = suppressed;
}

/** Verdadeiro quando a rota actual está activa, o separador do browser está visível e não há bloqueio. */
export function canPlayStrategySound(): boolean {
  if (typeof document !== "undefined" && !pageVisible) return false;
  if (soundSuppressed) return false;
  return activeRoutePath != null && activeRoutePath.length > 0;
}
