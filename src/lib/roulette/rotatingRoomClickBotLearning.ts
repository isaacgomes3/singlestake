import { doisFatoresFactorLabel, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import {
  isRotatingRoomCrossingPrepareIndication,
  isCrossingOppositeAbsenceWinPersistHold,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";

/** Alvos clicáveis no painel da app ou na mesa Pragmatic (via extensão). */
export type RotatingRoomClickBotTarget =
  | "prepare-open"
  | "factor-1"
  | "factor-2"
  | "repeat-bet";

export const ROTATING_ROOM_CLICK_BOT_TARGET_SELECTOR: Record<RotatingRoomClickBotTarget, string> = {
  "prepare-open": '[data-click-bot="prepare-open"]',
  "factor-1": '[data-click-bot="factor-1"]',
  "factor-2": '[data-click-bot="factor-2"]',
  "repeat-bet": '[data-click-bot="repeat-bet"]',
};

/** Empate (R0) — 1 clique em Repetir na mesma roleta. */
export const CROSSING_REPEAT_CLICKS_ON_DRAW = 1;
/** @deprecated Recuperação (gale) usa factor-1/factor-2 — repetir/dobrar só após 1.ª aposta na mesa. */
export const CROSSING_REPEAT_CLICKS_ON_GALE = 2;

export function crossingRepeatBetClickCount(
  holdReason?: "draw" | "loss" | null,
): number {
  if (holdReason === "draw") return CROSSING_REPEAT_CLICKS_ON_DRAW;
  return CROSSING_REPEAT_CLICKS_ON_GALE;
}

function buildCrossingFactorBetActions(
  session: RotatingRoomClickBotSessionSlice,
  reasonSuffix = "",
): RotatingRoomClickBotAction[] {
  const active = session.activeCrossing;
  if (!active || session.currentTableId == null) {
    return [{ kind: "wait", reason: "Sem indicação activa para aposta nos factores" }];
  }
  const { factor1, factor2 } = active;
  const mesa = lobbyTableDisplayName(session.currentTableId);
  const suffix = reasonSuffix ? ` ${reasonSuffix}` : "";
  const actions: RotatingRoomClickBotAction[] = [
    {
      kind: "click",
      target: "prepare-open",
      label: mesa,
      reason: `Abrir ${mesa} no operador`,
    },
    {
      kind: "click",
      target: "factor-1",
      label: doisFatoresFactorLabel(factor1),
      reason: session.singleFactorMode
        ? `JOGANDO em ${mesa} — aposta 1 Fator${suffix}`
        : `JOGANDO em ${mesa} — factor 1${suffix}`,
    },
  ];
  if (!session.singleFactorMode && factor2) {
    actions.push({
      kind: "click",
      target: "factor-2",
      label: doisFatoresFactorLabel(factor2),
      reason: `JOGANDO em ${mesa} — factor 2${suffix}`,
    });
  }
  return actions;
}

export const ROTATING_ROOM_INDICATION_PANEL_ID = "rotating-room-indication-panel";

export type RotatingRoomClickBotAction =
  | { kind: "wait"; reason: string }
  | {
      kind: "click";
      target: RotatingRoomClickBotTarget;
      label: string;
      reason: string;
    };

export type RotatingRoomClickBotSessionSlice = {
  sessionMode: RotatingRoomSessionMode | "scanning" | "active";
  showTapeteSignal: boolean;
  prepareTableId: number | null;
  currentTableId: number | null;
  activeCrossing: DoisFatoresActive | null;
  /** Sala rotativa 1 Fator — só aposta no factor de alerta (factor-1). */
  singleFactorMode?: boolean;
  /** Chave por rodada — permite re-aposta após empate (2F). */
  betAttemptKey?: string | null;
  rotativaTrigger?: "umFator" | "crossing" | "fibonacci" | "repeticao" | "rotacao";
  /** Evita repetir aposta no mesmo sinal (extensão). */
  signalId?: string | null;
  /** Nível de recuperação (gale) — define valor da ficha na extensão. */
  currentRecovery?: number;
  /** Sem mesa em foco — extensão mantém poker aberto (como o iframe do lobby). */
  lobbyWait?: boolean;
  /** Pós-ciclo — bloqueia nova indicação até lobby carregar + cooldown. */
  lobbyCooldownActive?: boolean;
  lobbyCooldownUntilMs?: number | null;
  postResultHoldActive?: boolean;
  postResultHoldUntilMs?: number | null;
  postResultHoldTableId?: number | null;
  /** 2 Fatores — mesa fixa ancorada (pós-vitória). */
  tableAnchored?: boolean;
  prepareCategory?: string | null;
  /** Empate (R0) → 1× repetir; recuperação (gale) → fichas nos factores. */
  postResultHoldReason?: "draw" | "loss" | null;
  cycleSpinsWithoutWin?: number;
  cycleOppositeAbsence?: boolean;
};

/** Plano de acções com base no estado da estratégia (Um Fator ou 2 fatores). */
export function planRotatingRoomClickBotActions(
  session: RotatingRoomClickBotSessionSlice,
): RotatingRoomClickBotAction[] {
  const isPrepare =
    !session.showTapeteSignal &&
    !session.postResultHoldActive &&
    (session.rotativaTrigger === "crossing"
      ? isRotatingRoomCrossingPrepareIndication({
          showTapeteSignal: session.showTapeteSignal,
          postResultHoldActive: session.postResultHoldActive,
          prepareTableId: session.prepareTableId,
          prepareCategory: session.prepareCategory,
          sessionMode: session.sessionMode,
          tableAnchored: session.tableAnchored,
        })
      : session.sessionMode === "prepare" || session.prepareTableId != null);

  if (isPrepare && session.prepareTableId != null) {
    const mesa = lobbyTableDisplayName(session.prepareTableId);
    const anchored = "tableAnchored" in session && session.tableAnchored === true;
    return [
      {
        kind: "click",
        target: "prepare-open",
        label: mesa,
        reason: anchored
          ? "Mesa fixa — aguardar gatilho ou posicionar nesta roleta"
          : "Fase POSICIONAR — abrir a mesa indicada",
      },
    ];
  }

  if (session.postResultHoldActive) {
    const recovery = session.currentRecovery ?? 0;
    const attempt = session.cycleSpinsWithoutWin ?? 0;
    const isCrossingContinuation =
      session.rotativaTrigger === "crossing" &&
      session.singleFactorMode !== true &&
      session.activeCrossing != null &&
      session.currentTableId != null &&
      (recovery > 0 ||
        attempt > 0 ||
        isCrossingOppositeAbsenceWinPersistHold({
          cycleOppositeAbsence: session.cycleOppositeAbsence,
          postResultHoldReason: session.postResultHoldReason,
          currentRecovery: recovery,
        }));
    if (isCrossingContinuation) {
      const recovery = session.currentRecovery ?? 0;
      if (recovery > 0) {
        return buildCrossingFactorBetActions(session, `· gale ${recovery}`);
      }

      const mesa = lobbyTableDisplayName(session.currentTableId!);
      const repeatClicks = crossingRepeatBetClickCount(session.postResultHoldReason);
      const repeatLabel = "Repetir";
      return [
        {
          kind: "click",
          target: "prepare-open",
          label: mesa,
          reason: `Abrir ${mesa} no operador`,
        },
        ...Array.from({ length: repeatClicks }, (_, index) => ({
          kind: "click" as const,
          target: "repeat-bet" as const,
          label: repeatLabel,
          reason: `JOGANDO em ${mesa} — repetir aposta empate (${index + 1}/${repeatClicks})`,
        })),
      ];
    }
    return [{ kind: "wait", reason: "Resultado — aguardar antes de voltar ao lobby" }];
  }

  if (session.lobbyCooldownActive && !session.showTapeteSignal) {
    return [{ kind: "wait", reason: "Pós-resultado — aguardar próxima indicação" }];
  }

  if (session.showTapeteSignal && session.activeCrossing && !session.lobbyCooldownActive) {
    const recovery = session.currentRecovery ?? 0;
    const suffix = recovery > 0 ? `· gale ${recovery}` : "";
    return buildCrossingFactorBetActions(session, suffix);
  }

  if (session.sessionMode === "awaiting_queue") {
    return [{ kind: "wait", reason: "Aguardar próxima mesa (recuperação)" }];
  }

  if (session.lobbyWait) {
    return [{ kind: "wait", reason: "Sem mesa em foco — aguardar indicação na sala" }];
  }

  return [{ kind: "wait", reason: "Sem sinal — aguardar indicação na sala rotativa" }];
}

export function rotatingRoomClickBotSessionFingerprint(
  session: RotatingRoomClickBotSessionSlice,
): string {
  const f = session.activeCrossing;
  return [
    session.sessionMode,
    session.showTapeteSignal ? 1 : 0,
    session.prepareTableId ?? "",
    session.currentTableId ?? "",
    session.signalId ?? "",
    session.betAttemptKey ?? "",
    session.rotativaTrigger ?? "",
    session.currentRecovery ?? 0,
    session.singleFactorMode ? 1 : 0,
    session.lobbyWait ? 1 : 0,
    session.lobbyCooldownActive ? 1 : 0,
    session.postResultHoldActive ? 1 : 0,
    session.postResultHoldUntilMs ?? "",
    f ? `${f.factor1.kind}:${f.factor1.value}|${f.factor2.kind}:${f.factor2.value}` : "",
  ].join("|");
}

/** Executa clique DOM no alvo (dentro de `root` se fornecido). */
export function executeRotatingRoomClickBotTarget(
  target: RotatingRoomClickBotTarget,
  root: ParentNode = document,
): { ok: boolean; detail: string } {
  const selector = ROTATING_ROOM_CLICK_BOT_TARGET_SELECTOR[target];
  const el = root.querySelector(selector);
  if (!el) {
    return { ok: false, detail: `Elemento não encontrado: ${selector}` };
  }

  const clickable =
    el instanceof HTMLButtonElement ||
    el instanceof HTMLAnchorElement ||
    el instanceof HTMLInputElement
      ? el
      : (el.querySelector("button, a[href]") as HTMLElement | null);

  if (!clickable) {
    return { ok: false, detail: "Alvo visível mas sem botão/link clicável" };
  }

  clickable.classList.add("click-bot-learning-flash");
  window.setTimeout(() => clickable.classList.remove("click-bot-learning-flash"), 700);
  clickable.click();
  return { ok: true, detail: `Clique em «${clickable.textContent?.trim().slice(0, 40) ?? target}»` };
}
