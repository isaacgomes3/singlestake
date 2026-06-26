import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  EXT_ARM_CALIBRATION,
  EXT_CALIBRATION_CLICK_RESPONSE,
  EXT_CALIBRATION_RESULT,
  EXT_DISARM_CALIBRATION,
  findCasinoEmbedRect,
  EXT_CALIBRATION_CLICK,
  type CalibrationArmDetail,
} from "@/lib/roulette/extensionCalibration";

type CalibSession = CalibrationArmDetail & { requestId?: string };

/**
 * Overlay de calibração na própria página stake37 (visível sobre o iframe do casino).
 * Activado pela extensão via postMessage «singlestake-arm-calibration».
 */
export function CasinoCalibrationOverlay() {
  const [session, setSession] = useState<CalibSession | null>(null);
  const [banner, setBanner] = useState<{ text: string; ok: boolean } | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [saving, setSaving] = useState(false);

  const updateRect = useCallback(() => {
    setRect(findCasinoEmbedRect());
  }, []);

  useEffect(() => {
    if (!session) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [session, updateRect]);

  useEffect(() => {
    if (!session) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setSession(null);
        setBanner(null);
        setSaving(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === EXT_ARM_CALIBRATION && data.betKey) {
        setSaving(false);
        setBanner(null);
        setSession({
          betKey: String(data.betKey),
          label: String(data.label || data.betKey),
        });
        return;
      }

      if (data.type === EXT_DISARM_CALIBRATION) {
        setSession(null);
        setBanner(null);
        setSaving(false);
        return;
      }

      if (data.type === EXT_CALIBRATION_RESULT && session) {
        const ok = data.result?.ok === true;
        setBanner({
          text: ok
            ? `✓ ${session.label} gravado`
            : `⚠ ${data.result?.detail || "Erro ao gravar"}`,
          ok,
        });
        setSaving(false);
        window.setTimeout(() => {
          setSession(null);
          setBanner(null);
        }, ok ? 2200 : 4000);
        return;
      }

      if (
        data.type === EXT_CALIBRATION_CLICK_RESPONSE &&
        session?.requestId &&
        data.requestId === session.requestId
      ) {
        const ok = data.response?.ok === true;
        setBanner({
          text: ok
            ? `✓ ${session.label} gravado`
            : `⚠ ${data.response?.detail || "Erro ao gravar"}`,
          ok,
        });
        setSaving(false);
        window.setTimeout(() => {
          setSession(null);
          setBanner(null);
        }, ok ? 2200 : 4000);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session]);

  if (!session) return null;

  const captureRect =
    rect ??
    ({
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      right: window.innerWidth,
      bottom: window.innerHeight,
    } as DOMRect);

  const onCapture = (e: React.PointerEvent) => {
    if (saving) return;
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    setBanner({ text: `⏳ A gravar ${session.label}…`, ok: true });

    const coord = rect
      ? {
          x: (e.clientX - captureRect.left) / captureRect.width,
          y: (e.clientY - captureRect.top) / captureRect.height,
          surface: "embed-iframe" as const,
        }
      : {
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight,
          surface: "viewport" as const,
        };

    const requestId = crypto.randomUUID();
    setSession((s) => (s ? { ...s, requestId } : s));

    window.postMessage(
      {
        type: EXT_CALIBRATION_CLICK,
        requestId,
        betKey: session.betKey,
        label: session.label,
        coord,
        frameHref: window.location.href,
        isTop: true,
      },
      window.location.origin,
    );
  };

  const overlay = (
    <>
      <div
        role="presentation"
        className="cursor-crosshair border-[3px] border-blue-500/80 bg-blue-600/40 touch-none"
        style={{
          position: "fixed",
          left: Math.max(0, captureRect.left),
          top: Math.max(0, captureRect.top),
          width: Math.max(1, captureRect.width),
          height: Math.max(1, captureRect.height),
          zIndex: 2147483646,
        }}
        onPointerDown={onCapture}
      />
      <div
        className="pointer-events-none fixed left-1/2 top-4 z-[2147483647] max-w-[min(440px,94vw)] -translate-x-1/2 rounded-xl border-2 border-blue-500/90 bg-[rgba(7,16,32,0.97)] px-4 py-3 text-center text-sm font-bold text-blue-100 shadow-2xl"
        style={{
          borderColor: banner ? (banner.ok ? "rgba(34,197,94,0.85)" : "rgba(251,191,36,0.85)") : undefined,
        }}
      >
        {banner ? (
          banner.text
        ) : (
          <>
            📍 Clique em <strong>{session.label}</strong> no tapete
            <br />
            <span className="text-[11px] font-medium opacity-90">
              Área azul = casino · ESC cancela
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        className="fixed right-4 top-4 z-[2147483647] rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
        onClick={() => {
          setSession(null);
          setBanner(null);
        }}
      >
        Cancelar
      </button>
    </>
  );

  return createPortal(overlay, document.body);
}
