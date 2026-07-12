/** Relay: sobe calibração na cadeia de iframes até ao top. */
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.gogExtCalib !== 1 || ev.data.kind !== "calibration-click") return;
  if (window === window.top) return;
  try {
    window.parent.postMessage(ev.data, "*");
  } catch {
    /* ignore */
  }
});

// Também reencaminha ACKs para baixo (filho que enviou).
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.gogExtCalibAck !== 1) return;
  if (window === window.top) return;
  try {
    // Propagação já vem do top via source; nada a fazer no meio.
  } catch {
    /* ignore */
  }
});
