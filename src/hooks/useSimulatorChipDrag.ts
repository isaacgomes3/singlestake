import { useCallback, useRef, useState } from "react";

import { betAreaKey, parseBetAreaKey, type RouletteBetKind } from "@/lib/roulette/rouletteBetSettlement";

const DRAG_THRESHOLD_PX = 5;

function betKeyFromElement(el: Element | null): string | null {
  let cur: Element | null = el;
  while (cur) {
    if (cur instanceof HTMLElement && cur.dataset.betKey) return cur.dataset.betKey;
    cur = cur.parentElement;
  }
  return null;
}

export function useSimulatorChipDrag(
  setBetsByKey: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  betsLocked: boolean,
  onAfterMove?: () => void,
) {
  const dragRef = useRef<{
    fromKey: string;
    pointerId: number;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragFromKey, setDragFromKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const moveChips = useCallback(
    (fromKey: string, toKey: string) => {
      if (fromKey === toKey) return;
      setBetsByKey((prev) => {
        const amt = prev[fromKey] ?? 0;
        if (amt <= 0) return prev;
        const next = { ...prev };
        next[toKey] = (next[toKey] ?? 0) + amt;
        delete next[fromKey];
        return next;
      });
      onAfterMove?.();
    },
    [setBetsByKey, onAfterMove],
  );

  const onBetPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, area: RouletteBetKind, chipAmount: number) => {
      if (betsLocked || e.shiftKey || chipAmount <= 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const fromKey = betAreaKey(area);
      dragRef.current = {
        fromKey,
        pointerId: e.pointerId,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
      };
      setDragFromKey(fromKey);
      setDragOverKey(fromKey);
    },
    [betsLocked],
  );

  const onBetPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (
      !d.moved &&
      (Math.abs(e.clientX - d.startX) > DRAG_THRESHOLD_PX || Math.abs(e.clientY - d.startY) > DRAG_THRESHOLD_PX)
    ) {
      d.moved = true;
    }
    if (d.moved) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      setDragOverKey(betKeyFromElement(under));
    }
  }, []);

  const onBetPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (d.moved) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const toKey = betKeyFromElement(under);
        if (toKey && parseBetAreaKey(toKey)) moveChips(d.fromKey, toKey);
        suppressClickRef.current = true;
      }
      dragRef.current = null;
      setDragFromKey(null);
      setDragOverKey(null);
    },
    [moveChips],
  );

  const onBetClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, onPlace: (remove: boolean) => void) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (betsLocked) return;
      onPlace(e.shiftKey);
    },
    [betsLocked],
  );

  const isDropTarget = useCallback(
    (area: RouletteBetKind) => {
      const key = betAreaKey(area);
      return dragFromKey !== null && dragOverKey === key && dragFromKey !== key;
    },
    [dragFromKey, dragOverKey],
  );

  const isDraggingFrom = useCallback(
    (area: RouletteBetKind) => dragFromKey === betAreaKey(area),
    [dragFromKey],
  );

  return {
    onBetPointerDown,
    onBetPointerMove,
    onBetPointerUp,
    onBetClick,
    isDropTarget,
    isDraggingFrom,
    dragActive: dragFromKey !== null,
  };
}
