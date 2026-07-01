import { Link } from "@tanstack/react-router";
import { Crop, ExternalLink, Layers, Move, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RotatingRoomPanel } from "@/components/rotating-room-panel";
import { CasinoEmbedViewportControls } from "@/components/casino-embed-viewport-controls";
import { CasinoGameEmbedFrame } from "@/components/casino-game-embed-frame";
import { SinglestakeLogo } from "@/components/singlestake-logo";
import { useCasinoEmbedViewport } from "@/hooks/useCasinoEmbedViewport";
import { useUmFatorSession } from "@/hooks/useUmFatorSession";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
import {
  clearUserCasinoEmbedUrl,
  getCasinoEmbedUrlForTable,
  readUserCasinoEmbedUrl,
  writeUserCasinoEmbedUrl,
} from "@/lib/roulette/casinoEmbedConfig";
import {
  clampTapeteOffset,
  clearTapetePanelOffset,
  readTapetePanelOffset,
  writeTapetePanelOffset,
} from "@/lib/roulette/casinoMesaTapetePosition";
import {
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import {
  UM_FATOR_MAX_RECOVERY,
  resetUmFatorSession,
} from "@/lib/roulette/umFatorCrossingStrategy";
import { umFatorAlertLabel } from "@/lib/roulette/umFatorStrategy";
import { cn } from "@/lib/utils";

type Props = {
  tableId: number;
};

export function CasinoMesaUmFatorWorkspace({ tableId }: Props) {
  const title = lobbyTableDisplayName(tableId);
  const [embedUrl, setEmbedUrl] = useState<string | null>(() => getCasinoEmbedUrlForTable(tableId));
  const [configOpen, setConfigOpen] = useState(() => !getCasinoEmbedUrlForTable(tableId));
  const [draftUrl, setDraftUrl] = useState(() => readUserCasinoEmbedUrl(tableId) ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>(() => readLiveTableHistory(tableId));
  const { viewport, patchViewport, resetViewport } = useCasinoEmbedViewport();
  const [viewportControlsOpen, setViewportControlsOpen] = useState(false);

  const session = useUmFatorSession(tableId, history);
  const histories = useMemo(() => ({ [tableId]: history }), [tableId, history]);
  const tableIds = useMemo(() => [tableId] as const, [tableId]);
  const aproveitamento = rotatingRoomSessionAproveitamentoPct(session.sessionStats);
  const alertLine = session.umActive
    ? umFatorAlertLabel(session.umActive)
    : session.showTapeteSignal
      ? "Indicação activa"
      : "A analisar gatilhos 1 Fator…";

  useEffect(() => {
    setEmbedUrl(getCasinoEmbedUrlForTable(tableId));
    setDraftUrl(readUserCasinoEmbedUrl(tableId) ?? "");
    setConfigOpen(!getCasinoEmbedUrlForTable(tableId));
  }, [tableId]);

  useEffect(() => {
    const sync = () => setHistory(readLiveTableHistory(tableId));
    sync();
    const onLive = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteLiveTableHistoryDetail>).detail;
      if (d?.tableId === tableId) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === liveTableHistoryStorageKey(tableId) ||
        e.key === liveTableSpinTimesStorageKey(tableId) ||
        e.key === null
      ) {
        sync();
      }
    };
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    };
  }, [tableId]);

  const tapeteOffsetRef = useRef(readTapetePanelOffset(tableId));
  const [tapeteOffset, setTapeteOffset] = useState(() => tapeteOffsetRef.current);
  const tapeteDragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const o = readTapetePanelOffset(tableId);
    tapeteOffsetRef.current = o;
    setTapeteOffset(o);
  }, [tableId]);

  const resetTapetePosition = useCallback(() => {
    const z = { x: 0, y: 0 };
    tapeteOffsetRef.current = z;
    setTapeteOffset(z);
    clearTapetePanelOffset(tableId);
  }, [tableId]);

  const onTapeteHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    tapeteDragRef.current = {
      px: e.clientX,
      py: e.clientY,
      ox: tapeteOffsetRef.current.x,
      oy: tapeteOffsetRef.current.y,
    };
  }, []);

  const onTapeteHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = tapeteDragRef.current;
    if (!d) return;
    const next = clampTapeteOffset(
      { x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) },
      window.innerWidth,
      window.innerHeight,
    );
    tapeteOffsetRef.current = next;
    setTapeteOffset(next);
  }, []);

  const flushTapeteOffset = useCallback(() => {
    writeTapetePanelOffset(tableId, tapeteOffsetRef.current);
  }, [tableId]);

  const onTapeteHandlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tapeteDragRef.current) {
        tapeteDragRef.current = null;
        flushTapeteOffset();
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [flushTapeteOffset],
  );

  const persistDraft = useCallback(() => {
    setSaveError(null);
    try {
      writeUserCasinoEmbedUrl(tableId, draftUrl.trim());
      setEmbedUrl(getCasinoEmbedUrlForTable(tableId));
      setConfigOpen(false);
    } catch {
      setSaveError("Introduza um endereço http(s) válido ou deixe em branco para limpar.");
    }
  }, [draftUrl, tableId]);

  const clearStored = useCallback(() => {
    clearUserCasinoEmbedUrl(tableId);
    setDraftUrl("");
    setEmbedUrl(getCasinoEmbedUrlForTable(tableId));
    setSaveError(null);
  }, [tableId]);

  const openExternal = useCallback(() => {
    const u = embedUrl ?? draftUrl.trim();
    if (!u) return;
    try {
      const url = new URL(u);
      if (url.protocol === "http:" || url.protocol === "https:") {
        window.open(url.href, "_blank", "noopener,noreferrer");
      }
    } catch {
      /* ignore */
    }
  }, [draftUrl, embedUrl]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#060a14] text-slate-100">
      <header className="pointer-events-auto z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#0d1524]/95 px-3 py-2 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            to={BACK_OFFICE_PATHS.salaRotativa}
            className="inline-flex shrink-0 items-center rounded-lg border border-slate-700/80 bg-slate-900/60 px-2 py-2 hover:bg-slate-800/80"
          >
            <SinglestakeLogo className="h-14 w-[min(376px,92vw)] sm:h-16" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white sm:text-base">{title}</p>
            <p className="text-[10px] text-slate-500 sm:text-xs">
              Mesa {tableId} · Estratégia 1 Fator · {aproveitamento.toFixed(1)}% aproveit.
            </p>
            <p
              className={cn(
                "text-[10px] sm:text-[11px]",
                session.showTapeteSignal ? "font-semibold text-cyan-200" : "text-slate-500",
              )}
            >
              {alertLine}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setViewportControlsOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold sm:text-sm",
              viewportControlsOpen
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                : "border-slate-700/80 bg-slate-900/60 text-slate-200 hover:bg-slate-800/80",
            )}
          >
            <Crop className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            Moldura
          </button>
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold sm:text-sm",
              configOpen
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                : "border-slate-700/80 bg-slate-900/60 text-slate-200 hover:bg-slate-800/80",
            )}
          >
            <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            URL
          </button>
        </div>
      </header>

      {viewportControlsOpen ? (
        <div className="pointer-events-auto z-30 border-b border-slate-800/80 bg-slate-900/90 px-3 py-3 sm:px-4">
          <CasinoEmbedViewportControls viewport={viewport} onChange={patchViewport} onReset={resetViewport} />
        </div>
      ) : null}

      {configOpen ? (
        <div className="pointer-events-auto z-30 border-b border-slate-800/80 bg-slate-900/90 px-3 py-3 sm:px-4">
          <p className="text-xs text-slate-400 sm:text-sm">
            Cole o URL da mesa após login no operador. Use «Abrir em nova janela» se o iframe for bloqueado.
          </p>
          <textarea
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            rows={2}
            placeholder="https://…"
            className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 sm:text-sm"
          />
          {saveError ? <p className="mt-1 text-xs text-amber-400">{saveError}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={persistDraft}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 sm:text-sm"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={clearStored}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 sm:text-sm"
            >
              Limpar URL
            </button>
            {(embedUrl ?? draftUrl.trim()) ? (
              <button
                type="button"
                onClick={openExternal}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 sm:text-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Abrir em nova janela
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {embedUrl ? (
          <CasinoGameEmbedFrame src={embedUrl} title={`Casino — ${title}`} viewport={viewport} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-black px-6 text-center">
            <Layers className="h-10 w-10 text-slate-600" aria-hidden />
            <p className="max-w-md text-sm text-slate-400">
              Sem URL configurada. Abra «URL» e cole o link do jogo após login no casino.
            </p>
          </div>
        )}

        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[19] h-28 bg-gradient-to-t from-black/70 to-transparent"
          aria-hidden
        />

        <div
          className="pointer-events-auto fixed left-1/2 z-20 w-[min(100%,420px)] max-w-[calc(100vw-12px)]"
          style={{
            bottom: "8px",
            transform: `translate(calc(-50% + ${tapeteOffset.x}px), ${tapeteOffset.y}px)`,
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0d1524]/98 shadow-2xl shadow-black/60 backdrop-blur-md">
            <div
              role="toolbar"
              aria-label="Arrastar painel 1 Fator"
              onPointerDown={onTapeteHandlePointerDown}
              onPointerMove={onTapeteHandlePointerMove}
              onPointerUp={onTapeteHandlePointerUp}
              onPointerCancel={onTapeteHandlePointerUp}
              className="flex cursor-grab items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-900/90 px-2 py-1.5 active:cursor-grabbing"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Move className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" aria-hidden />
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300/90">
                  1 Fator · {title}
                </p>
              </div>
              <button
                type="button"
                onClick={resetTapetePosition}
                className="shrink-0 rounded-md border border-slate-600/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
              >
                Repor
              </button>
            </div>
            <div className="max-h-[min(52vh,520px)] overflow-y-auto p-2">
              <RotatingRoomPanel
                session={session}
                histories={histories}
                tableIds={tableIds}
                compact
                floatingChrome
                panelTitle="1 Fator"
                maxRecovery={UM_FATOR_MAX_RECOVERY}
                onReset={() => resetUmFatorSession(tableId, history)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
