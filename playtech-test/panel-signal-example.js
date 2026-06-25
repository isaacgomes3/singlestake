/**
 * Exemplo — o painel Playtech envia sinal para a extensão (modo demo ou real).
 * Colar/adaptar no teu painel quando a estratégia Um Fator disparar entrada.
 */
function enviarSinalExtensao({
  betKey,
  label,
  mesaUrl,
  signalId,
  mode = "demo",
}) {
  if (typeof window.__singlestakeExtension?.sendSignal === "function") {
    return window.__singlestakeExtension.sendSignal({
      betKey,
      label,
      mesaUrl,
      signalId,
      mode,
      reason: `Um Fator · ${label} · ${mode}`,
    });
  }

  window.postMessage(
    {
      type: "singlestake/playtech-signal",
      version: 1,
      betKey,
      label,
      mesaUrl,
      signalId,
      mode,
    },
    window.location.origin,
  );
}

// Exemplo:
// enviarSinalExtensao({
//   betKey: "even",
//   label: "Par",
//   mesaUrl: "https://br4.bet.br/play/playtech/roleta-brasileira",
//   signalId: "brasileira:19:Par:0",
//   mode: "demo",
// });
