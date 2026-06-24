const BRIDGE_TYPE = "game-odds-glow/rotating-room-extension";
const PING_TYPE = "game-odds-glow/rotating-room-extension-ping";
const PONG_TYPE = "game-odds-glow/rotating-room-extension-pong";
const ACK_TYPE = "game-odds-glow/rotating-room-extension-ack";

document.documentElement.dataset.gogExtension = "1";

function postAck(fingerprint, response) {
  window.postMessage(
    {
      type: ACK_TYPE,
      version: 1,
      fingerprint,
      response,
    },
    window.location.origin,
  );
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const data = event.data;

  if (data?.type === PING_TYPE && data.version === 1) {
    window.postMessage({ type: PONG_TYPE, version: 1 }, window.location.origin);
    return;
  }

  if (!data || data.type !== BRIDGE_TYPE || data.version !== 1) return;

  chrome.runtime.sendMessage({ kind: "bridge-from-app", payload: data }, (response) => {
    if (chrome.runtime.lastError) {
      postAck(data.fingerprint, {
        ok: false,
        error: chrome.runtime.lastError.message,
        results: [{ target: "bridge", ok: false, detail: chrome.runtime.lastError.message }],
      });
      return;
    }
    postAck(data.fingerprint, response);
  });
});
