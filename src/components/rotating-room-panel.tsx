import { Link } from "@tanstack/react-router";
import { ChevronUp, ExternalLink, RotateCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { RouletteStatCard, type RouletteStatCardSize } from "@/components/roulette-stat-card";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomRotativaSession } from "@/hooks/useRotatingRoomRotativaSession";
import { rotativaTriggerKindLabel } from "@/lib/roulette/rotatingRoomRotativaMerge";
import type { RotatingRoomPlusSession } from "@/hooks/useRotatingRoomPlusSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useDgaTableImages } from "@/hooks/useDgaTableImages";
import type { UmFatorSession } from "@/hooks/useUmFatorSession";
import { ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS } from "@/lib/roulette/rotatingRoomCrossingSession";
import { ROTATING_ROOM_CROSSING_SWITCH_WITHOUT_PATTERN_SPINS } from "@/lib/roulette/doisFatoresPatternCrossing";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { doisFatoresFactorButtonClass, doisFatoresFactorLabel, type DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import {
  lobbyTableCardFallbackBg,
  lobbyTableCardPhotoStyle,
  lobbyTableCardPhotoUrl,
  rotatingRoomLobbyWaitPhotoStyle,
} from "@/lib/roulette/lobbyTableCardAssets";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { isExternalHref } from "@/lib/app-profile";
import {
  isRotatingRoomLobbyWait,
  rotatingRoomLobbyFocusTableId,
  rotatingRoomLobbyHasSignal,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import {
  rotatingRoomCasinoMesaSearch,
  rotatingRoomTableOpenTarget,
} from "@/lib/roulette/rotatingRoomTableOpen";
import { colorOf } from "@/lib/roulette/streetStrategy";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import {
  readRotatingRoomStatsVisible,
  prepareRotatingRoomIframeSession,
  writeRotatingRoomStatsVisible,
} from "@/lib/roulette/rotatingRoomViewPrefs";
import { cn } from "@/lib/utils";

export type RotatingRoomPanelSession =
  | RotatingRoomCrossingSession
  | RotatingRoomPlusSession
  | RotatingRoomUmFatorSession
  | RotatingRoomRotativaSession
  | UmFatorSession;

function isSingleFactorSession(session: RotatingRoomPanelSession): boolean {
  return "singleFactorMode" in session && session.singleFactorMode === true;
}

function isCrossingTableAnchored(session: RotatingRoomPanelSession): boolean {
  return "tableAnchored" in session && session.tableAnchored === true;
}

function crossingPrepareHeading(
  session: RotatingRoomPanelSession,
  hasPreparePattern: boolean,
): string {
  if (isSingleFactorSession(session)) return "Posicione-se";
  if (isCrossingTableAnchored(session)) {
    return hasPreparePattern ? "Gatilho na mesa fixa" : "Mesa fixa — aguardando gatilho";
  }
  return "Posicione-se";
}

function crossingPrepareHint(session: RotatingRoomPanelSession, hasPreparePattern: boolean): string {
  if (isSingleFactorSession(session)) return "Toque na roleta para abrir a mesa indicada";
  if (isCrossingTableAnchored(session)) {
    if (hasPreparePattern) {
      return "Posicione-se nesta roleta — recuperações também ficam aqui";
    }
    return `Só troca de roleta com zero ou ${ROTATING_ROOM_CROSSING_SWITCH_WITHOUT_PATTERN_SPINS} rodadas sem novo gatilho`;
  }
  return "Toque na roleta para abrir a mesa indicada";
}

type PanelProps = {
  session: RotatingRoomPanelSession;
  histories: Record<number, readonly number[]>;
  tableIds: readonly number[];
  compact?: boolean;
  floatingChrome?: boolean;
  /** Só botões de sinal / estado de espera (modo celular). */
  signalOnly?: boolean;
  panelTitle?: string;
  maxRecovery: number;
  onReset: () => void;
  onCorrectLastLoss?: () => void;
  onOpenTable?: (tableId: number) => void;
};

function spinBadgeClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/55 bg-emerald-600/90 text-white";
  if (c === "Vermelho") return "border-red-400/40 bg-red-600/85 text-white";
  return "border-slate-600/80 bg-slate-900 text-slate-100";
}

function RecentFive({ numbers }: { numbers: readonly number[] }) {
  const slots = Array.from({ length: 5 }, (_, i) => numbers[i]);
  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {slots.map((n, i) => (
        <div
          key={i}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold tabular-nums sm:h-12 sm:w-12 sm:text-base",
            n === undefined
              ? "border-slate-800/60 bg-slate-950/50 text-slate-700"
              : spinBadgeClass(n),
            i === 0 && n !== undefined && "ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[#060a14]",
          )}
        >
          {n ?? "·"}
        </div>
      ))}
    </div>
  );
}

function FactorAscendButton({
  factor,
  delayMs,
  mesaUrl,
  botTarget,
  dense = false,
}: {
  factor: DoisFatoresFactor;
  delayMs: number;
  mesaUrl: string | null;
  botTarget: "factor-1" | "factor-2";
  dense?: boolean;
}) {
  const label = doisFatoresFactorLabel(factor);
  const shell = (
    <span
      translate="no"
      className={cn(
        "notranslate flex w-full flex-1 flex-col items-center justify-center rounded-2xl border px-3 py-6 text-center text-base font-black uppercase leading-tight tracking-normal",
        dense
          ? "min-h-[5.25rem] text-sm sm:min-h-[5.75rem] sm:text-base"
          : "min-h-[7.5rem] sm:min-h-[9rem] sm:px-4 sm:text-xl",
        "motion-safe:animate-[rotatingRoomFactorAscend_2.4s_ease-in-out_infinite]",
        doisFatoresFactorButtonClass(factor),
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );

  if (mesaUrl) {
    return (
      <a
        href={mesaUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-click-bot={botTarget}
        className="click-bot-target flex w-full flex-1 outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        {shell}
      </a>
    );
  }

  return (
    <button type="button" data-click-bot={botTarget} className="click-bot-target flex w-full flex-1">
      {shell}
    </button>
  );
}

const INDICATION_SHELL_DENSE = "min-h-[5.25rem] sm:min-h-[5.75rem]";
const INDICATION_SHELL_DEFAULT = "min-h-[7.5rem] sm:min-h-[9rem]";

function RoundFlashOverlay({
  flash,
  recovery,
  dense = false,
}: {
  flash: NonNullable<RotatingRoomPanelSession["roundFlash"]>;
  recovery: number;
  dense?: boolean;
}) {
  const kind = flash.kind;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl border-2",
        dense ? INDICATION_SHELL_DENSE : INDICATION_SHELL_DEFAULT,
        kind === "win" && "border-emerald-400/60 bg-emerald-950/92",
        kind === "loss" && "border-rose-400/60 bg-rose-950/92",
        kind === "recovery" && "border-amber-400/60 bg-amber-950/90",
      )}
    >
      <p
        className={cn(
          "font-black tabular-nums leading-none",
          dense ? "text-4xl sm:text-5xl" : "text-6xl sm:text-7xl",
          kind === "win" && "text-emerald-300 motion-safe:animate-[rotatingRoomFlashWin_0.65s_ease-out]",
          kind === "loss" && "text-rose-300 motion-safe:animate-[rotatingRoomFlashLoss_0.55s_ease-in-out]",
          kind === "recovery" &&
            "text-amber-200 motion-safe:animate-[rotatingRoomFlashRecovery_0.9s_ease-in-out_infinite]",
        )}
      >
        {flash.resultNumber}
      </p>
      {kind === "recovery" ? (
        <p
          className={cn(
            "font-black tabular-nums text-amber-300/95 motion-safe:animate-pulse",
            dense ? "mt-1 text-base" : "mt-2 text-2xl",
          )}
        >
          {recovery}
        </p>
      ) : null}
    </div>
  );
}

function IndicationFactorRow({
  singleFactor,
  factor1,
  factor2,
  mesaUrl,
  dense = false,
  roundFlash,
  recovery,
}: {
  singleFactor: boolean;
  factor1?: DoisFatoresFactor;
  factor2?: DoisFatoresFactor;
  mesaUrl: string | null;
  dense?: boolean;
  roundFlash?: RotatingRoomPanelSession["roundFlash"];
  recovery: number;
}) {
  const slotShell = cn("relative flex w-full flex-1");

  if (roundFlash) {
    return (
      <div className="flex w-full justify-center">
        <div className={slotShell}>
          <RoundFlashOverlay flash={roundFlash} recovery={recovery} dense={dense} />
        </div>
      </div>
    );
  }

  if (singleFactor && factor1) {
    return (
      <div className="flex w-full justify-center">
        <div className={slotShell}>
          <FactorAscendButton
            factor={factor1}
            delayMs={0}
            mesaUrl={mesaUrl}
            botTarget="factor-1"
            dense={dense}
          />
          {roundFlash ? (
            <RoundFlashOverlay flash={roundFlash} recovery={recovery} dense={dense} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex w-full",
        singleFactor ? "justify-center" : "flex-col gap-2.5 sm:flex-row sm:gap-3",
      )}
    >
      {factor1 ? (
        <div className={slotShell}>
          <FactorAscendButton
            factor={factor1}
            delayMs={0}
            mesaUrl={mesaUrl}
            botTarget="factor-1"
            dense={dense}
          />
        </div>
      ) : null}
      {!singleFactor && factor2 ? (
        <div className={slotShell}>
          <FactorAscendButton
            factor={factor2}
            delayMs={400}
            mesaUrl={mesaUrl}
            botTarget="factor-2"
            dense={dense}
          />
        </div>
      ) : null}
      {roundFlash ? (
        <RoundFlashOverlay flash={roundFlash} recovery={recovery} dense={dense} />
      ) : null}
    </div>
  );
}

/** Quadro «aguarde no lobby» — imagem Stake 37 e texto no centro-inferior. */
function RotatingRoomLobbyWaitFrame({
  className,
  aspectClassName = "aspect-[16/10]",
  embedded = false,
}: {
  className?: string;
  aspectClassName?: string;
  embedded?: boolean;
}) {
  return (
    <div className={cn("relative w-full shrink-0 overflow-hidden", aspectClassName, className)}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={rotatingRoomLobbyWaitPhotoStyle()}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/20" aria-hidden />
      <div className="absolute inset-x-0 bottom-[10%] flex justify-center px-3 sm:bottom-[11%]">
        <p
          className={cn(
            "text-xs font-semibold lowercase tracking-wide sm:text-sm",
            embedded
              ? "text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
              : "text-white/95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]",
          )}
        >
          aguardando...
        </p>
      </div>
    </div>
  );
}

function PrepareTableCard({
  tableId,
  primary,
  onOpenTable,
}: {
  tableId: number;
  primary: boolean;
  onOpenTable?: (tableId: number) => void;
}) {
  const label = lobbyTableDisplayName(tableId);
  const photo = lobbyTableCardPhotoUrl(tableId);
  const photoStyle = lobbyTableCardPhotoStyle(tableId);
  const target = rotatingRoomTableOpenTarget(tableId);
  const embedUrl = getCasinoEmbedUrlForTable(tableId);

  const handleClick = () => {
    onOpenTable?.(tableId);
  };

  const cardBody = (
    <>
      <div
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden",
          !photo && "bg-[#0a101c]",
        )}
        style={photo ? undefined : { background: lobbyTableCardFallbackBg() }}
      >
        {photoStyle ? (
          <div className="h-full w-full bg-cover bg-no-repeat" style={photoStyle} aria-hidden />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <p className="absolute bottom-2 left-0 right-0 px-2 text-center text-sm font-black text-white sm:text-base">
          {label}
        </p>
      </div>
      <p className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">
        {primary ? "Clique para abrir esta roleta" : "Abrir roleta"}
      </p>
    </>
  );

  if (onOpenTable) {
    return (
      <button
        type="button"
        data-click-bot="prepare-open"
        onClick={handleClick}
        className={cn(
          "click-bot-target w-full overflow-hidden rounded-2xl border text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
          primary
            ? "border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
            : "border-amber-500/35",
        )}
      >
        {cardBody}
      </button>
    );
  }

  if (target.kind === "app") {
    return (
      <Link
        to="/casino-mesa"
        search={rotatingRoomCasinoMesaSearch(tableId)}
        data-click-bot="prepare-open"
        className={cn(
          "click-bot-target block w-full overflow-hidden rounded-2xl border transition hover:brightness-110",
          primary
            ? "border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
            : "border-amber-500/35",
        )}
      >
        {cardBody}
      </Link>
    );
  }

  return (
    <a
      href={embedUrl ?? target.href}
      target="_blank"
      rel="noopener noreferrer"
      data-click-bot="prepare-open"
      className={cn(
        "click-bot-target block w-full overflow-hidden rounded-2xl border transition hover:brightness-110",
        primary
          ? "border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
          : "border-amber-500/35",
      )}
    >
      {cardBody}
    </a>
  );
}

function RotatingRoomStage({
  session,
  histories,
  tableIds,
  onOpenTable,
  compact,
  signalOnly = false,
  indicationOnly = false,
}: {
  session: RotatingRoomPanelSession;
  histories: Record<number, readonly number[]>;
  tableIds: readonly number[];
  onOpenTable?: (tableId: number) => void;
  compact?: boolean;
  signalOnly?: boolean;
  /** Modo iframe: só botões de indicação, sem textos de espera. */
  indicationOnly?: boolean;
}) {
  const isPrepare =
    !isSingleFactorSession(session) &&
    (session.sessionMode === "prepare" ||
      (session.prepareTableId != null && !session.showTapeteSignal));
  const hasRoundFlash = session.roundFlash != null;
  const postResultHoldActive =
    "postResultHoldActive" in session &&
    session.postResultHoldActive === true;
  const hasLiveIndication =
    session.showTapeteSignal && session.activeCrossing != null;
  const isActive =
    hasLiveIndication ||
    hasRoundFlash ||
    (!indicationOnly && postResultHoldActive);
  const isAwaitingNextTable =
    isSingleFactorSession(session) &&
    session.currentRecovery > 0 &&
    !session.showTapeteSignal &&
    !hasRoundFlash &&
    !postResultHoldActive;

  const focusTableId = isActive
    ? session.currentTableId ??
      session.roundFlash?.tableId ??
      ("postResultHoldTableId" in session ? session.postResultHoldTableId : null) ??
      null
    : isPrepare
      ? session.prepareTableId
      : null;

  const focusLabel = focusTableId != null ? lobbyTableDisplayName(focusTableId) : null;
  const mesaUrl = focusTableId != null ? getCasinoEmbedUrlForTable(focusTableId) : null;
  const recent = focusTableId != null ? (histories[focusTableId] ?? []).slice(0, 5) : [];
  const hasAnyHistory = tableIds.some((id) => (histories[id]?.length ?? 0) > 0);
  const maxBucketGap =
    "crossingScan" in session
      ? session.crossingScan.reduce((best, row) => Math.max(best, row.bucketGap ?? 0), 0)
      : 0;
  const singleFactor = isSingleFactorSession(session);
  const hasPreparePattern = !singleFactor && Boolean(session.prepareCategory);
  const prepareHeading = crossingPrepareHeading(session, hasPreparePattern);
  const prepareHint = crossingPrepareHint(session, hasPreparePattern);
  const isCrossingAwaitingNewTable =
    !singleFactor &&
    session.sessionMode === "awaiting_queue" &&
    session.currentRecovery > 0;

  if (signalOnly && isPrepare && focusTableId != null && focusLabel) {
    if (indicationOnly) {
      return (
        <button
          type="button"
          onClick={() => onOpenTable?.(focusTableId)}
          className="w-full rounded-xl border border-amber-400/50 bg-amber-950/40 px-4 py-3 text-base font-bold text-amber-100"
        >
          {focusLabel}
        </button>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-amber-500/45 bg-bg-card px-4 py-5 text-center">
        <ChevronUp className="mx-auto h-5 w-5 text-amber-400/80 motion-safe:animate-bounce" aria-hidden />
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-amber-300/90">{prepareHeading}</p>
        <button
          type="button"
          onClick={() => onOpenTable?.(focusTableId)}
          className="mt-3 w-full rounded-xl border border-amber-400/50 bg-amber-950/40 px-4 py-3 text-base font-bold text-amber-100"
        >
          {focusLabel}
        </button>
      </div>
    );
  }

  if (isPrepare && focusTableId != null && focusLabel) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border-2 border-amber-400/55 bg-bg-card px-4 py-5 text-center shadow-[0_0_40px_rgba(251,191,36,0.12)] sm:px-5 sm:py-6",
          compact ? "rounded-2xl" : "",
        )}
      >
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300/90">{prepareHeading}</p>
        <p className="mt-1 text-xs text-amber-200/70">{prepareHint}</p>
        {session.currentRecovery > 0 ? (
          <p className="mt-1 text-xs font-bold tabular-nums text-amber-300/80">
            Recuperação {session.currentRecovery}
          </p>
        ) : null}

        <div className="mt-4">
          <PrepareTableCard tableId={focusTableId} primary onOpenTable={onOpenTable} />
        </div>

        <p className="mt-3 text-lg font-bold text-amber-100/90 sm:text-xl">{focusLabel}</p>
      </div>
    );
  }

  if (isActive && (focusLabel || hasRoundFlash)) {
    const crossing = session.activeCrossing;
    const factor1 = hasRoundFlash ? undefined : crossing?.factor1;
    const factor2 = hasRoundFlash ? undefined : crossing?.factor2;

    if (signalOnly) {
      if (indicationOnly) {
        if (!hasRoundFlash && !hasLiveIndication) return null;
        return (
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 bg-bg-secondary px-3 py-3",
              session.roundFlash
                ? session.roundFlash.kind === "win"
                  ? "border-emerald-400/60"
                  : session.roundFlash.kind === "recovery"
                    ? "border-amber-400/60"
                    : "border-rose-400/60"
                : "border-emerald-400/55 street-indication-pulse-cyan",
            )}
          >
            <IndicationFactorRow
              singleFactor={singleFactor}
              factor1={factor1}
              factor2={factor2}
              mesaUrl={mesaUrl}
              dense
              roundFlash={session.roundFlash}
              recovery={session.currentRecovery}
            />
          </div>
        );
      }
      return (
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border-2 bg-bg-secondary px-3 py-4",
            session.roundFlash
              ? session.roundFlash.kind === "win"
                ? "border-emerald-400/60"
                : session.roundFlash.kind === "recovery"
                  ? "border-amber-400/60"
                  : "border-rose-400/60"
              : "border-emerald-400/55 street-indication-pulse-cyan",
          )}
        >
          {focusTableId != null ? (
            <button
              type="button"
              onClick={() => onOpenTable?.(focusTableId)}
              className="mb-3 w-full rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm font-bold text-text-primary"
            >
              {focusLabel}
            </button>
          ) : null}
          <IndicationFactorRow
            singleFactor={singleFactor}
            factor1={factor1}
            factor2={factor2}
            mesaUrl={mesaUrl}
            dense
            roundFlash={session.roundFlash}
            recovery={session.currentRecovery}
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border-2 bg-bg-secondary px-5 py-8 sm:px-8",
          compact ? "rounded-2xl px-4 py-5 sm:px-5" : "mx-auto max-w-2xl",
          session.roundFlash
            ? session.roundFlash.kind === "win"
              ? "border-emerald-400/60"
              : session.roundFlash.kind === "recovery"
                ? "border-amber-400/60"
                : "border-rose-400/60"
            : "border-emerald-400/55 street-indication-pulse-cyan",
        )}
      >
        {focusTableId != null ? (
          <button
            type="button"
            onClick={() => onOpenTable?.(focusTableId)}
            className="mb-4 w-full overflow-hidden rounded-xl border border-cyan-500/35 text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <div className="relative aspect-[16/7] w-full overflow-hidden">
              {lobbyTableCardPhotoStyle(focusTableId) ? (
                <div
                  className="h-full w-full bg-cover bg-no-repeat"
                  style={lobbyTableCardPhotoStyle(focusTableId)!}
                  aria-hidden
                />
              ) : (
                <div className="h-full w-full" style={{ background: lobbyTableCardFallbackBg() }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <p className="absolute bottom-2 left-3 text-lg font-black text-white">{focusLabel}</p>
            </div>
          </button>
        ) : (
          <p className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">{focusLabel}</p>
        )}

        {mesaUrl ? (
          <a
            href={mesaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-4 top-4 z-10 rounded-lg border border-cyan-500/40 p-2 text-cyan-200/90 hover:bg-cyan-500/10"
            aria-label={focusLabel}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        <div className={cn(focusTableId != null ? "" : "mt-6")}>
          <RecentFive numbers={recent} />
        </div>

        <div className="mt-6">
          <IndicationFactorRow
            singleFactor={singleFactor}
            factor1={factor1}
            factor2={factor2}
            mesaUrl={mesaUrl}
            roundFlash={session.roundFlash}
            recovery={session.currentRecovery}
          />
        </div>
      </div>
    );
  }

  const lobbyWaitIdle = isRotatingRoomLobbyWait(session) && !isAwaitingNextTable;

  const waitingTitle = isAwaitingNextTable || isCrossingAwaitingNewTable
    ? "Aguarde próxima mesa"
    : hasAnyHistory
      ? "Aguardando próxima entrada"
      : "Sem giros ao vivo";

  if (signalOnly) {
    if (indicationOnly) {
      if (lobbyWaitIdle) {
        return (
          <RotatingRoomLobbyWaitFrame
            aspectClassName="min-h-[9rem]"
            className="rounded-2xl border border-border-color"
            embedded
          />
        );
      }
      return null;
    }

    if (lobbyWaitIdle) {
      return (
        <RotatingRoomLobbyWaitFrame
          aspectClassName="min-h-[9rem]"
          className="rounded-2xl border border-border-color"
          embedded
        />
      );
    }

    return (
      <div className="flex min-h-[9rem] flex-col items-center justify-center rounded-2xl border border-border-color bg-bg-card px-5 py-8 text-center">
        <ChevronUp
          className="h-5 w-5 text-text-secondary motion-safe:animate-bounce"
          aria-hidden
        />
        <p className="mt-3 text-base font-semibold tracking-wide text-text-primary">{waitingTitle}</p>
        {isAwaitingNextTable || isCrossingAwaitingNewTable ? (
          <p className="mt-1.5 text-sm font-bold tabular-nums text-amber-300/90">
            Recuperação {session.currentRecovery}
          </p>
        ) : !hasAnyHistory ? null : !singleFactor && maxBucketGap > 0 && maxBucketGap < ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS ? (
          <p className="mt-2 text-xs tabular-nums text-slate-500">
            Ausência máx.: {maxBucketGap} giros
          </p>
        ) : null}
      </div>
    );
  }

  if (indicationOnly) return null;

  if (lobbyWaitIdle) {
    return (
      <RotatingRoomLobbyWaitFrame
        className={cn(
          "rounded-3xl border border-border-color",
          compact ? "rounded-2xl" : "mx-auto max-w-lg",
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-border-color bg-bg-card/80 px-6 py-16 text-center",
        compact ? "rounded-2xl py-10" : "mx-auto max-w-lg",
      )}
    >
      {isAwaitingNextTable || isCrossingAwaitingNewTable ? (
        <>
          <p className="text-lg font-semibold tracking-wide text-amber-300/90 sm:text-xl">
            Aguarde próxima mesa
          </p>
          <p className="mt-2 text-sm font-bold tabular-nums text-amber-200/80">
            Recuperação {session.currentRecovery}
          </p>
          {!singleFactor ? (
            <p className="mt-2 text-xs text-amber-200/60">
              Procurando roleta com novo padrão (zero ou {ROTATING_ROOM_CROSSING_SWITCH_WITHOUT_PATTERN_SPINS} giros sem gatilho)
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-lg font-semibold tracking-wide text-slate-400 sm:text-xl">
            {hasAnyHistory
              ? singleFactor
                ? "A analisar gatilhos…"
                : "A analisar cruzamentos…"
              : "Sem giros ao vivo"}
          </p>
          {!hasAnyHistory ? null : !singleFactor && maxBucketGap > 0 && maxBucketGap < ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS ? (
            <p className="mt-2 text-sm tabular-nums text-slate-500">
              Maior ausência: {maxBucketGap} giros · sinal com{" "}
              {ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}+
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function RotatingRoomPanel({
  session,
  histories,
  tableIds,
  compact = false,
  floatingChrome = false,
  signalOnly = false,
  panelTitle = "Sala Rotativa",
  maxRecovery,
  onReset,
  onCorrectLastLoss,
  onOpenTable,
}: PanelProps) {
  useDgaTableImages();
  const aproveitamento = rotatingRoomSessionAproveitamentoPct(session.sessionStats);
  const [statsVisible, setStatsVisible] = useState(() =>
    floatingChrome ? true : readRotatingRoomStatsVisible(),
  );
  const showStats = !signalOnly && (floatingChrome || statsVisible);

  useEffect(() => {
    if (!floatingChrome || signalOnly) return;
    if (!readRotatingRoomStatsVisible()) {
      writeRotatingRoomStatsVisible(true);
      setStatsVisible(true);
    }
  }, [floatingChrome, signalOnly]);

  if (signalOnly) {
    return (
      <div className="notranslate" translate="no">
        <RotatingRoomStage
          session={session}
          histories={histories}
          tableIds={tableIds}
          onOpenTable={onOpenTable}
          compact
          signalOnly
          indicationOnly={floatingChrome}
        />
      </div>
    );
  }

  const cardSize: RouletteStatCardSize = "sm";
  const gridClass = "grid-cols-4 gap-1";

  const toggleStats = () => {
    setStatsVisible((prev) => {
      const next = !prev;
      writeRotatingRoomStatsVisible(next);
      return next;
    });
  };

  return (
    <div className={compact ? "space-y-3 p-3 notranslate" : "mt-6 space-y-6 notranslate"} translate="no">
      {!floatingChrome ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white sm:text-2xl">{panelTitle}</h1>
            {"rotativaTrigger" in session ? (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-950/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200/90">
                {rotativaTriggerKindLabel(session.rotativaTrigger)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleStats}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              {statsVisible ? "Ocultar contadores" : "Mostrar contadores"}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Zerar
            </button>
            {session.sessionStats.losses > 0 && onCorrectLastLoss ? (
              <button
                type="button"
                onClick={onCorrectLastLoss}
                className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-xs font-semibold text-emerald-300/90 hover:bg-emerald-950/40"
                title="Remove 1 derrota e soma 1 vitória (ex.: erro por travamento)"
              >
                Derrota → Vitória
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{panelTitle}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {session.sessionStats.losses > 0 && onCorrectLastLoss ? (
              <button
                type="button"
                onClick={onCorrectLastLoss}
                className="rounded-md border border-emerald-700/50 px-2 py-1 text-[10px] font-semibold text-emerald-300/90 hover:bg-emerald-950/40"
                title="Remove 1 derrota e soma 1 vitória"
              >
                L→W
              </button>
            ) : null}
          </div>
        </div>
      )}

      {showStats ? (
        <section className="overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div className={cn("grid", gridClass)}>
            <RouletteStatCard
              label="Vitórias"
              value={session.sessionStats.wins}
              tone="green"
              variant="lobby"
              size={cardSize}
            />
            <RouletteStatCard
              label="Derrotas"
              value={session.sessionStats.losses}
              tone="red"
              variant="lobby"
              size={cardSize}
            />
            <RouletteStatCard
              label="Rec."
              value={session.currentRecovery}
              tone={session.currentRecovery > 0 ? "amber" : undefined}
              variant="lobby"
              size={cardSize}
            />
            <RouletteStatCard
              label="Aprov."
              value={`${aproveitamento.toFixed(0)}%`}
              tone="green"
              variant="lobby"
              size={cardSize}
            />
          </div>
        </section>
      ) : null}

      <RotatingRoomStage
        session={session}
        histories={histories}
        tableIds={tableIds}
        onOpenTable={onOpenTable}
        compact={compact || floatingChrome}
        indicationOnly={floatingChrome}
      />
    </div>
  );
}

type LobbyCardProps = {
  session: RotatingRoomPanelSession;
  salaRoute?: string;
  salaLabel?: string;
  /** Badge fixo (ex.: «2 Fatores») no cartão do lobby. */
  strategyBadge?: string;
  /** Integrado num painel (ex.: automação) — sem overlay flutuante. */
  embedded?: boolean;
  /** Ao clicar, abre a sala com modo iframe activo. */
  openInIframe?: boolean;
  className?: string;
};

function SalaRouteLink({
  salaRoute,
  iframeSearch,
  className,
  ariaLabel,
  children,
  onNavigate,
}: {
  salaRoute: string;
  iframeSearch?: { iframe?: string };
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
  onNavigate?: () => void;
}) {
  if (isExternalHref(salaRoute)) {
    let href = salaRoute;
    if (iframeSearch) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(iframeSearch)) {
        if (value == null || value === "") continue;
        params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) href = `${href}${href.includes("?") ? "&" : "?"}${qs}`;
    }
    return (
      <a
        href={href}
        className={className}
        aria-label={ariaLabel}
        target={iframeSearch ? undefined : "_blank"}
        rel={iframeSearch ? undefined : "noopener noreferrer"}
        onClick={onNavigate}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      to={salaRoute}
      search={iframeSearch}
      className={className}
      aria-label={ariaLabel}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

/** Cartão compacto no lobby — sala rotativa. */
export function RotatingRoomLobbyCard({
  session,
  salaRoute = "/sala-rotativa-um-fator",
  salaLabel = "Sala Rotativa",
  strategyBadge,
  embedded = false,
  openInIframe = false,
  className,
}: LobbyCardProps) {
  const focusTableId = rotatingRoomLobbyFocusTableId(session);
  const focusLabel = focusTableId != null ? lobbyTableDisplayName(focusTableId) : null;
  const isPrepare = session.sessionMode === "prepare" && !session.showTapeteSignal;
  const isActive = session.showTapeteSignal;
  const hasSignal = rotatingRoomLobbyHasSignal(session);
  const roundStatus = session.showTapeteSignal
    ? `Gale ${session.currentRecovery}`
    : session.sessionMode === "prepare"
      ? "Posicione-se"
      : "Aguardando";
  const photo = focusTableId != null ? lobbyTableCardPhotoUrl(focusTableId) : null;
  const photoStyle = focusTableId != null ? lobbyTableCardPhotoStyle(focusTableId) : null;

  const borderShell = hasSignal
    ? isActive
      ? embedded
        ? "border-success/55 ring-2 ring-success/30"
        : "border-emerald-400/55 ring-2 ring-emerald-400/35"
      : embedded
        ? "border-warning/55 ring-2 ring-warning/25"
        : "border-amber-400/55 ring-2 ring-amber-400/30"
    : embedded
      ? "border-border-color ring-1 ring-border-color/80"
      : "border-cyan-500/45 ring-1 ring-cyan-400/15";

  const cardClickable = !embedded || openInIframe;
  const iframeSearch = openInIframe ? { iframe: true as const } : undefined;

  return (
    <div
      className={cn(
        "relative block h-full min-h-0 rounded-2xl outline-none",
        cardClickable &&
          "cursor-pointer transition hover:opacity-[0.98] focus-within:ring-2 focus-within:ring-info/50 focus-within:ring-offset-2 focus-within:ring-offset-bg-primary",
        !embedded &&
          "focus-within:ring-cyan-400 focus-within:ring-offset-[#060a14]",
        className,
      )}
    >
      {cardClickable ? (
        <SalaRouteLink
          salaRoute={salaRoute}
          iframeSearch={iframeSearch}
          className="absolute inset-0 z-[1] rounded-2xl"
          ariaLabel={openInIframe ? `${salaLabel} — abrir roleta no iframe` : salaLabel}
          onNavigate={() => {
            if (openInIframe) prepareRotatingRoomIframeSession();
          }}
        />
      ) : null}
      <article
        className={cn(
          "relative z-[2] flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border",
          embedded
            ? "bg-bg-card shadow-theme"
            : "pointer-events-none bg-[#0d1524] shadow-xl",
          cardClickable && "pointer-events-none",
          !cardClickable && embedded && "pointer-events-none",
          borderShell,
        )}
      >
        {!embedded ? (
          <div
            className={cn(
              "relative z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 border-b px-1.5 py-1 sm:gap-x-1.5 sm:px-2 sm:py-1.5 min-h-[2.25rem] sm:min-h-[2.5rem]",
              "border-cyan-950/40 bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-cyan-950/80",
            )}
          >
            <div className="flex min-w-0 items-center justify-start">
              <RotateCw className="h-3 w-3 shrink-0 text-cyan-400 sm:h-3.5 sm:w-3.5" aria-hidden />
            </div>
            <div className="flex min-w-0 max-w-full flex-col items-center justify-center px-1 text-center">
              <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-cyan-300/95 sm:text-[8px]">
                {salaLabel}
              </p>
              {strategyBadge ? (
                <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-wide text-amber-300/90 sm:text-[8px]">
                  {strategyBadge}
                </p>
              ) : "rotativaTrigger" in session ? (
                <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-wide text-amber-300/90 sm:text-[8px]">
                  {rotativaTriggerKindLabel(session.rotativaTrigger)}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-0 items-center justify-end">
              {session.showTapeteSignal || session.sessionMode === "prepare" ? (
                <span className="inline-flex shrink-0 items-center rounded-md border border-cyan-600/50 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold tabular-nums text-cyan-200 sm:text-[8px]">
                  {roundStatus}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {focusLabel ? (
          <div
            className={cn(
              "relative flex w-full shrink-0 items-center justify-center overflow-hidden",
              embedded ? "aspect-[16/9] min-h-[7rem]" : "aspect-[16/10]",
            )}
            style={photo ? undefined : { background: lobbyTableCardFallbackBg() }}
          >
            {photoStyle ? (
              <div className="absolute inset-0 bg-cover bg-no-repeat" style={photoStyle} aria-hidden />
            ) : null}
            {photoStyle ? <div className="absolute inset-0 bg-black/30" aria-hidden /> : null}
            <div className="relative px-3 text-center">
              {isPrepare ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90 sm:text-xs">
                  Posicione-se
                </p>
              ) : null}
              <p
                className={cn(
                  "font-bold sm:text-base",
                  isPrepare ? "mt-1 text-sm text-amber-100" : isActive ? "text-sm text-emerald-200" : "text-sm text-slate-300",
                )}
              >
                {focusLabel}
              </p>
            </div>
          </div>
        ) : (
          <RotatingRoomLobbyWaitFrame
            embedded={embedded}
            aspectClassName={embedded ? "aspect-[16/9] min-h-[7rem]" : "aspect-[16/10]"}
          />
        )}

        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 border-t px-2 py-2",
            embedded ? "border-border-color bg-bg-secondary/50" : "justify-center border-slate-800/90",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              embedded ? "text-text-secondary" : "text-slate-500",
            )}
          >
            {roundStatus}
          </p>
          {embedded && openInIframe ? (
            <SalaRouteLink
              salaRoute={salaRoute}
              iframeSearch={iframeSearch}
              className="relative z-[3] pointer-events-auto text-[10px] font-bold uppercase tracking-wide text-info hover:underline"
              onNavigate={() => prepareRotatingRoomIframeSession()}
            >
              Abrir iframe
            </SalaRouteLink>
          ) : embedded ? (
            <SalaRouteLink
              salaRoute={salaRoute}
              className="relative z-[3] pointer-events-auto text-[10px] font-bold uppercase tracking-wide text-info hover:underline"
            >
              Abrir sala
            </SalaRouteLink>
          ) : null}
        </div>
      </article>
    </div>
  );
}
