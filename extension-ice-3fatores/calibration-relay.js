/** Relay opcional — reencaminha calibração para o frame pai quando o runtime falha. */
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.gogExtCalib !== 1 || ev.data.kind !== "calibration-click") return;
  if (window === window.top) return;
  try {
    window.parent.postMessage(ev.data, "*");
  } catch {
    /* ignore */
  }
});
