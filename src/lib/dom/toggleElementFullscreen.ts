/**
 * Entra em tela cheia no elemento ou sai se já estiver em tela cheia nesse elemento.
 * O utilizador pode sair com ESC ou voltar a clicar no ícone.
 */
export async function toggleElementFullscreen(element: HTMLElement | null): Promise<void> {
  if (!element || typeof document === "undefined") return;
  try {
    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen();
  } catch {
    // Política do browser, iframe sem allowfullscreen, ou API indisponível.
  }
}
