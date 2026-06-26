/** Mensagens entre a página stake37 e a extensão (content-bridge). */
export const EXT_CALIBRATION_CLICK = "gog-ext/calibration-click";
export const EXT_CALIBRATION_CLICK_RESPONSE = "gog-ext/calibration-click-response";
export const EXT_ARM_CALIBRATION = "singlestake-arm-calibration";
export const EXT_DISARM_CALIBRATION = "singlestake-disarm-calibration";
export const EXT_CALIBRATION_RESULT = "singlestake-calibration-result";

export type CalibrationArmDetail = {
  betKey: string;
  label: string;
};

export type CalibrationCoord = {
  x: number;
  y: number;
  surface: "embed-iframe" | "viewport";
};

export function postCalibrationClick(
  betKey: string,
  label: string,
  coord: CalibrationCoord,
): string {
  const requestId = crypto.randomUUID();
  window.postMessage(
    {
      type: EXT_CALIBRATION_CLICK,
      requestId,
      betKey,
      label,
      coord,
      frameHref: window.location.href,
      isTop: true,
    },
    window.location.origin,
  );
  return requestId;
}

export function findCasinoEmbedRect(): DOMRect | null {
  const shell = document.querySelector(".rotating-room-iframe-shell");
  const iframe =
    shell?.querySelector("iframe") ??
    [...document.querySelectorAll("iframe")].find((el) => /casino/i.test(el.title || ""));
  const el = iframe ?? shell;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 60 || r.height < 40) return null;
  return r;
}
