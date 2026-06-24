import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { toggleElementFullscreen } from "@/lib/dom/toggleElementFullscreen";

export const SIMULATOR_BOARD_ZOOM_MIN = 0.75;
export const SIMULATOR_BOARD_ZOOM_MAX = 1.75;
export const SIMULATOR_BOARD_ZOOM_STEP = 0.125;

type Fit = { bw: number; bh: number; s: number };

export function useSimulatorBoardViewport() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardMeasureRef = useRef<HTMLDivElement>(null);

  const [boardZoom, setBoardZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fit, setFit] = useState<Fit>({ bw: 0, bh: 0, s: 1 });

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const recomputeFit = useCallback(() => {
    if (!isFullscreen) {
      setFit({ bw: 0, bh: 0, s: 1 });
      return;
    }
    const stage = stageRef.current;
    const board = boardMeasureRef.current;
    if (!stage || !board) return;
    const bw = board.offsetWidth;
    const bh = board.offsetHeight;
    if (bw < 1 || bh < 1) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (cw < 1 || ch < 1) return;
    const s = Math.min(cw / bw, ch / bh) * 0.92 * boardZoom;
    if (!Number.isFinite(s) || s <= 0) return;
    setFit({ bw, bh, s });
  }, [isFullscreen, boardZoom]);

  useLayoutEffect(() => {
    recomputeFit();
    if (!isFullscreen) return;
    const ro = new ResizeObserver(() => recomputeFit());
    if (stageRef.current) ro.observe(stageRef.current);
    if (boardMeasureRef.current) ro.observe(boardMeasureRef.current);
    window.addEventListener("resize", recomputeFit);
    const id = requestAnimationFrame(recomputeFit);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", recomputeFit);
    };
  }, [isFullscreen, recomputeFit]);

  const zoomIn = useCallback(() => {
    setBoardZoom((z) => Math.min(SIMULATOR_BOARD_ZOOM_MAX, +(z + SIMULATOR_BOARD_ZOOM_STEP).toFixed(3)));
  }, []);

  const zoomOut = useCallback(() => {
    setBoardZoom((z) => Math.max(SIMULATOR_BOARD_ZOOM_MIN, +(z - SIMULATOR_BOARD_ZOOM_STEP).toFixed(3)));
  }, []);

  const zoomReset = useCallback(() => setBoardZoom(1), []);

  const toggleFullscreen = useCallback(() => {
    void toggleElementFullscreen(workspaceRef.current);
  }, []);

  const fitReady = isFullscreen && fit.bw > 0 && fit.bh > 0;
  const inlineScale = isFullscreen ? 1 : boardZoom;

  return {
    workspaceRef,
    stageRef,
    boardMeasureRef,
    boardZoom,
    isFullscreen,
    fit,
    fitReady,
    inlineScale,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleFullscreen,
    canZoomIn: boardZoom < SIMULATOR_BOARD_ZOOM_MAX - 0.001,
    canZoomOut: boardZoom > SIMULATOR_BOARD_ZOOM_MIN + 0.001,
  };
}
