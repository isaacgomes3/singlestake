import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Crop, Move, Settings2, ClipboardCopy, Coins } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";

import { RouletteBetSimulator } from "@/components/roulette-bet-simulator";
import { CasinoEmbedViewportControls } from "@/components/casino-embed-viewport-controls";
import { CasinoGameEmbedFrame } from "@/components/casino-game-embed-frame";
import { StreetStrategyTable } from "@/components/street-strategy-table";
import { SinglestakeLogo } from "@/components/singlestake-logo";
import { useCasinoEmbedViewport } from "@/hooks/useCasinoEmbedViewport";
import { useStreetStrategySpinOutcomeFlash } from "@/hooks/useStreetStrategySpinOutcomeFlash";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import { cn } from "@/lib/utils";
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
import { lobbyTableDisplayName, resolveRuas9ViewTableId } from "@/lib/roulette/lobbyTables";
import { ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  buildCasinoMesaRuas9BridgePayload,
  CASINO_MESA_IFRAME_PARENT_STORAGE_KEY,
  clearUserCasinoMesaIframeParentOrigin,
  isPageEmbeddedInIframe,
  readUserCasinoMesaIframeParentOrigin,
  resolveCasinoMesaParentPostTargetOrigin,
  writeUserCasinoMesaIframeParentOrigin,
} from "@/lib/roulette/casinoMesaIframeBridge";
import { formatRuas9BetInstructionText } from "@/lib/roulette/ruas9BetInstructionText";
import { ruas9PctAutoCriticalBundle } from "@/lib/roulette/ruas9PctAutoCritical";
import { simulateStreetStrategy } from "@/lib/roulette/streetStrategy";

export const Route = createFileRoute("/casino-mesa")({
  beforeLoad: ({ search }) => {
    guardAutomationWorkspaceRoute("/casino-mesa", search);
    requireAuth("/casino-mesa");
  },
  validateSearch: (search: Record<string, unknown>): { mesa?: number; parentOrigin?: string } => {
    const out: { mesa?: number; parentOrigin?: string } = {};
    const raw = search.mesa;
    if (raw !== undefined && raw !== null && raw !== "") {
      const n = typeof raw === "number" ? raw : Number(String(raw));
      if (Number.isInteger(n) && n > 0) out.mesa = n;
    }
    const po = search.parentOrigin;
    if (typeof po === "string" && po.trim()) out.parentOrigin = po.trim();
    return out;
  },
  head: () => ({
    meta: [
      { title: "Casino + ferramentas — Roleta" },
      {
        name: "description",
        content: "Mesa do casino num iframe com tapete e URL configurável.",
      },
    ],
  }),
  component: CasinoMesaPage,
});

function CasinoMesaPage() {
  const { mesa, parentOrigin: parentOriginSearch } = Route.useSearch();
  const viewTableId = resolveRuas9ViewTableId(mesa);
  const title = lobbyTableDisplayName(viewTableId);

  const [embedUrl, setEmbedUrl] = useState<string | null>(() => getCasinoEmbedUrlForTable(viewTableId));
  const [configOpen, setConfigOpen] = useState(() => !getCasinoEmbedUrlForTable(viewTableId));
  const [draftUrl, setDraftUrl] = useState(() => readUserCasinoEmbedUrl(viewTableId) ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [parentOriginSaveError, setParentOriginSaveError] = useState<string | null>(null);
  const [storedParentOrigin, setStoredParentOrigin] = useState<string | null>(() =>
    readUserCasinoMesaIframeParentOrigin(),
  );
  const [draftParentOrigin, setDraftParentOrigin] = useState(
    () => readUserCasinoMesaIframeParentOrigin() ?? "",
  );

  const [history, setHistory] = useState<number[]>(() => readLiveTableHistory(viewTableId));
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const { viewport, patchViewport, resetViewport } = useCasinoEmbedViewport();
  const [viewportControlsOpen, setViewportControlsOpen] = useState(false);

  useEffect(() => {
    setEmbedUrl(getCasinoEmbedUrlForTable(viewTableId));
    setDraftUrl(readUserCasinoEmbedUrl(viewTableId) ?? "");
    setConfigOpen(!getCasinoEmbedUrlForTable(viewTableId));
  }, [viewTableId]);

  useEffect(() => {
    const sync = () => setHistory(readLiveTableHistory(viewTableId));
    sync();
    const onLive = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteLiveTableHistoryDetail>).detail;
      if (d?.tableId === viewTableId) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === liveTableHistoryStorageKey(viewTableId) ||
        e.key === liveTableSpinTimesStorageKey(viewTableId) ||
        e.key === null
      )
        sync();
    };
    const onConfig = () => sync();
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, onConfig);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, onConfig);
    };
  }, [viewTableId]);

  useEffect(() => {
    const onBridgeStorage = (e: StorageEvent) => {
      if (e.key !== CASINO_MESA_IFRAME_PARENT_STORAGE_KEY && e.key !== null) return;
      setStoredParentOrigin(readUserCasinoMesaIframeParentOrigin());
      setDraftParentOrigin((d) => (d.trim() ? d : readUserCasinoMesaIframeParentOrigin() ?? ""));
    };
    window.addEventListener("storage", onBridgeStorage);
    return () => window.removeEventListener("storage", onBridgeStorage);
  }, []);

  /** Placar Ruas 9% acumulado — sem reset por hora civil. */
  const historyPlacar = history;

  const ruas9Auto = useMemo(
    () => ruas9PctAutoCriticalBundle(historyPlacar, `ruas9-mesa-${viewTableId}`),
    [historyPlacar, viewTableId],
  );

  const analysis = useMemo(
    () => simulateStreetStrategy(historyPlacar, ruas9Auto.opts),
    [historyPlacar, ruas9Auto.opts],
  );
  const { active } = analysis;

  useStrategyIndicationActivatedSound(active);

  const iframeBridgeTargetOrigin = useMemo(
    () =>
      resolveCasinoMesaParentPostTargetOrigin({
        searchParentOrigin: parentOriginSearch,
        storedParentOrigin,
      }),
    [parentOriginSearch, storedParentOrigin],
  );
  const iframeBridgePayload = useMemo(
    () => buildCasinoMesaRuas9BridgePayload(viewTableId, active, history),
    [viewTableId, active, history],
  );

  useEffect(() => {
    if (!iframeBridgeTargetOrigin) return;
    if (!isPageEmbeddedInIframe()) return;
    window.parent.postMessage(iframeBridgePayload, iframeBridgeTargetOrigin);
  }, [iframeBridgeTargetOrigin, iframeBridgePayload]);
  const spinFlash = useStreetStrategySpinOutcomeFlash(historyPlacar, ruas9Auto.opts, viewTableId);
  const resultPinNumber =
    spinFlash?.resultNumber ?? (history.length > 0 ? history[0]! : null);

  const tapeteOffsetRef = useRef(readTapetePanelOffset(viewTableId));
  const [tapeteOffset, setTapeteOffset] = useState(() => tapeteOffsetRef.current);
  const tapeteDragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const o = readTapetePanelOffset(viewTableId);
    tapeteOffsetRef.current = o;
    setTapeteOffset(o);
  }, [viewTableId]);

  const resetTapetePosition = useCallback(() => {
    const z = { x: 0, y: 0 };
    tapeteOffsetRef.current = z;
    setTapeteOffset(z);
    clearTapetePanelOffset(viewTableId);
  }, [viewTableId]);

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
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const next = clampTapeteOffset(
      {
        x: d.ox + (e.clientX - d.px),
        y: d.oy + (e.clientY - d.py),
      },
      vw,
      vh,
    );
    tapeteOffsetRef.current = next;
    setTapeteOffset(next);
  }, []);

  const flushTapeteOffset = useCallback(() => {
    writeTapetePanelOffset(viewTableId, tapeteOffsetRef.current);
  }, [viewTableId]);

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

  const onTapeteHandleLostCapture = useCallback(() => {
    if (tapeteDragRef.current) {
      tapeteDragRef.current = null;
      flushTapeteOffset();
    }
  }, [flushTapeteOffset]);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current);
    };
  }, []);

  const copyBetInstructions = useCallback(async () => {
    if (!active) return;
    const text = formatRuas9BetInstructionText(active);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Copiado.");
    } catch {
      setCopyFeedback("Não foi possível copiar (permissões do navegador ou contexto inseguro).");
    }
    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current);
    copyFeedbackTimerRef.current = window.setTimeout(() => setCopyFeedback(null), 4200);
  }, [active]);

  const persistDraft = useCallback(() => {
    setSaveError(null);
    try {
      writeUserCasinoEmbedUrl(viewTableId, draftUrl.trim());
      setEmbedUrl(getCasinoEmbedUrlForTable(viewTableId));
      setConfigOpen(false);
    } catch {
      setSaveError("Introduza um endereço http(s) válido ou deixe em branco para limpar.");
    }
  }, [draftUrl, viewTableId]);

  const clearStored = useCallback(() => {
    clearUserCasinoEmbedUrl(viewTableId);
    setDraftUrl("");
    setEmbedUrl(getCasinoEmbedUrlForTable(viewTableId));
    setSaveError(null);
  }, [viewTableId]);

  const persistParentOriginDraft = useCallback(() => {
    setParentOriginSaveError(null);
    try {
      writeUserCasinoMesaIframeParentOrigin(draftParentOrigin);
      setStoredParentOrigin(readUserCasinoMesaIframeParentOrigin());
    } catch (err) {
      setParentOriginSaveError(err instanceof Error ? err.message : "Origem inválida.");
    }
  }, [draftParentOrigin]);

  const clearStoredParentOrigin = useCallback(() => {
    clearUserCasinoMesaIframeParentOrigin();
    setDraftParentOrigin("");
    setStoredParentOrigin(null);
    setParentOriginSaveError(null);
  }, []);

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
            to={BACK_OFFICE_PATHS.casinoAoVivo}
            className="inline-flex shrink-0 items-center rounded-lg border border-slate-700/80 bg-slate-900/60 px-2 py-2 hover:bg-slate-800/80"
          >
            <SinglestakeLogo className="h-14 w-[min(376px,92vw)] sm:h-16" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white sm:text-base">{title}</p>
            <p className="text-[10px] text-slate-500 sm:text-xs">Mesa {viewTableId} · login no casino dentro do iframe</p>
            <p className="text-[10px] text-cyan-200/85 sm:text-[11px]">
              Ruas 9% · gatilho automático (últ. 20 giros):{" "}
              <span className="font-semibold text-cyan-50">{ruas9Auto.criticalLabel}</span>
            </p>
            {iframeBridgeTargetOrigin && isPageEmbeddedInIframe() ? (
              <p className="text-[10px] font-medium text-emerald-400/95 sm:text-xs">
                Bridge postMessage → {iframeBridgeTargetOrigin}
              </p>
            ) : iframeBridgeTargetOrigin && !isPageEmbeddedInIframe() ? (
              <p className="text-[10px] text-amber-400/90 sm:text-xs">
                Origem da shell guardada — abra esta página dentro de um iframe na shell para enviar postMessage.
              </p>
            ) : null}
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
          <button
            type="button"
            onClick={() => setSimulatorOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-600/40 bg-amber-500/10 px-2 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 sm:text-sm"
          >
            <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            Simulador
          </button>
        </div>
      </header>

      {viewportControlsOpen ? (
        <div className="pointer-events-auto z-30 border-b border-slate-800/80 bg-slate-900/90 px-3 py-3 sm:px-4">
          <CasinoEmbedViewportControls
            viewport={viewport}
            onChange={patchViewport}
            onReset={resetViewport}
          />
        </div>
      ) : null}

      {configOpen ? (
        <div className="pointer-events-auto z-30 border-b border-slate-800/80 bg-slate-900/90 px-3 py-3 sm:px-4">
          <p className="text-xs text-slate-400 sm:text-sm">
            Depois de iniciar sessão no site do operador, copie o endereço da página do jogo (URL completa) e cole
            abaixo. Muitos casinos <span className="font-semibold text-slate-300">bloqueiam iframe</span> noutros
            domínios; nesse caso use «Abrir em nova janela» e mantenha esta página ao lado para o histórico.
          </p>
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            URL da mesa (guardada neste dispositivo)
          </label>
          <textarea
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            rows={2}
            placeholder="https://…"
            className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 sm:text-sm"
          />
          {saveError ? <p className="mt-1 text-xs text-amber-400">{saveError}</p> : null}
          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Shell que embute esta página — origem para postMessage (opcional)
          </label>
          <p className="mt-1 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
            <span className="font-semibold text-slate-400">Não</span> é a URL do Pragmatic acima. Use o endereço do{" "}
            <span className="text-slate-300">site pai</span> onde coloca{" "}
            <code className="rounded bg-slate-800 px-1 text-slate-400">&lt;iframe src=…/casino-mesa…&gt;</code> (ex.{" "}
            <code className="text-slate-400">https://meu-site.com</code>). Guardado neste dispositivo.
          </p>
          <input
            type="url"
            value={draftParentOrigin}
            onChange={(e) => setDraftParentOrigin(e.target.value)}
            placeholder="https://sua-shell.com"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 sm:text-sm"
            autoComplete="off"
          />
          {parentOriginSaveError ? (
            <p className="mt-1 text-xs text-amber-400">{parentOriginSaveError}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={persistParentOriginDraft}
              className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/45 sm:text-sm"
            >
              Guardar origem da shell
            </button>
            <button
              type="button"
              onClick={clearStoredParentOrigin}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 sm:text-sm"
            >
              Limpar origem guardada
            </button>
          </div>
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
              Limpar URL guardada
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
          <p className="mt-2 text-[10px] text-slate-600 sm:text-[11px]">
            Opcional no build: variável{" "}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">VITE_CASINO_TABLE_EMBED_URLS</code>{" "}
            (JSON por id de mesa).
          </p>
          <p className="mt-2 text-[10px] text-slate-500 sm:text-[11px]">
            <span className="font-semibold text-slate-400">Prioridade:</span> parâmetro URL{" "}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">parentOrigin=</code>, depois valor
            guardado nesta secção, depois{" "}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">VITE_CASINO_MESA_PARENT_ORIGIN</code> no
            build. Documentação: <code className="text-slate-400">docs/casino-mesa-iframe-bridge.md</code>.
          </p>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {embedUrl ? (
          <CasinoGameEmbedFrame src={embedUrl} title={`Casino — ${title}`} viewport={viewport} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-black px-6 text-center">
            <p className="max-w-md text-sm text-slate-400">
              Sem URL configurada para esta mesa. Abra «URL» acima e cole o link do jogo após fazer login no casino.
            </p>
          </div>
        )}

        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[19] h-24 bg-gradient-to-t from-black/60 to-transparent sm:h-28"
          aria-hidden
        />

        <div
          className="pointer-events-auto fixed left-1/2 z-20 max-h-[min(52vh,520px)] w-[min(100%,920px)] max-w-[calc(100vw-10px)] overflow-hidden rounded-xl border border-slate-700/80 bg-[#0d1524]/96 shadow-2xl shadow-black/50 backdrop-blur-md"
          style={{
            bottom: "6px",
            transform: `translate(calc(-50% + ${tapeteOffset.x}px), ${tapeteOffset.y}px)`,
          }}
        >
          <div
            role="toolbar"
            aria-label="Controlo do painel do tapete"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 bg-slate-900/90 px-2 py-1.5 sm:px-3"
          >
            <div
              aria-label="Arrastar para reposicionar o tapete"
              onPointerDown={onTapeteHandlePointerDown}
              onPointerMove={onTapeteHandlePointerMove}
              onPointerUp={onTapeteHandlePointerUp}
              onPointerCancel={onTapeteHandlePointerUp}
              onLostPointerCapture={onTapeteHandleLostCapture}
              className="flex min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-2 rounded-md py-0.5 active:cursor-grabbing"
            >
              <Move className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-[10px]">
                Tapete · arrastar para alinhar
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                disabled={!active}
                title={active ? "Copiar resumo da aposta" : "Indisponível sem indicação ativa"}
                onClick={() => void copyBetInstructions()}
                className="inline-flex items-center gap-1 rounded-md border border-cyan-700/50 bg-cyan-950/50 px-2 py-1 text-[10px] font-semibold text-cyan-100/95 hover:bg-cyan-900/55 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[11px]"
              >
                <ClipboardCopy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Copiar aposta
              </button>
              <button
                type="button"
                onClick={resetTapetePosition}
                className="rounded-md border border-slate-600/80 bg-slate-800/90 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-700/90 sm:text-[11px]"
              >
                Repor posição
              </button>
            </div>
          </div>
          {copyFeedback ? (
            <p
              role="status"
              className="border-b border-slate-800/70 bg-slate-900/70 px-2 py-1.5 text-center text-[10px] leading-snug text-emerald-200/95 sm:text-[11px]"
            >
              {copyFeedback}
            </p>
          ) : null}
          <div className="max-h-[min(48vh,480px)] overflow-y-auto overflow-x-hidden px-2 py-2 sm:px-3 sm:py-2.5">
            {history.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">Sem giros ainda.</p>
            ) : (
              <div
                className={cn(
                  "relative w-full overflow-x-auto rounded-lg border-2 bg-[#060a14]/85 p-1 sm:p-1.5",
                  active
                    ? "border-cyan-400/55 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                    : "border-slate-700/70",
                )}
              >
                <StreetStrategyTable
                  active={active}
                  awaitSpinHistory={historyPlacar}
                  resultPinNumber={resultPinNumber}
                  spinFlash={spinFlash}
                />
                {!active ? (
                  <p className="mt-1.5 text-center text-[10px] text-amber-200/85 sm:text-[11px]">
                    Sem indicação ativa.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <RouletteBetSimulator
        tableId={viewTableId}
        history={history}
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
      />
    </div>
  );
}
