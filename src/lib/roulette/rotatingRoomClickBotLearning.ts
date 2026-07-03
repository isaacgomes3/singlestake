import { doisFatoresFactorLabel, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomCrossingStrategy";
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

/** 2F ausência de cruzamento — cliques no botão Repetir/Dobrar após gale ou empate. */
export function crossingRepeatBetClickCount(
  recovery: number,
  holdReason?: "draw" | "loss" | null,
): number {
  if (holdReason === "draw") return 1;
  if (holdReason === "loss") return Math.max(1, recovery + 1);
  return Math.max(1, recovery + 1);
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
  /** Empate → 1× repetir; derrota → recovery+1× dobrar. */
  postResultHoldReason?: "draw" | "loss" | null;
  cycleSpinsWithoutWin?: number;
};

/** Plano de acções com base no estado da estratégia (Um Fator ou 2 fatores). */
export function planRotatingRoomClickBotActions(
  session: RotatingRoomClickBotSessionSlice,
): RotatingRoomClickBotAction[] {
  const isPrepare =
    session.sessionMode === "prepare" ||
    (session.prepareTableId != null && !session.showTapeteSignal);

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
      (recovery > 0 || attempt > 0);
    if (isCrossingContinuation) {
      const mesa = lobbyTableDisplayName(session.currentTableId!);
      const repeatClicks = crossingRepeatBetClickCount(recovery, session.postResultHoldReason);
      const repeatLabel =
        session.postResultHoldReason === "draw" ? "Repetir" : "Repetir/Dobrar";
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
          reason:
            session.postResultHoldReason === "draw"
              ? `JOGANDO em ${mesa} — repetir aposta empate (${index + 1}/${repeatClicks})`
              : `JOGANDO em ${mesa} — dobrar aposta gale (${index + 1}/${repeatClicks})`,
        })),
      ];
    }
    return [{ kind: "wait", reason: "Resultado — aguardar antes de voltar ao lobby" }];
  }

  if (session.lobbyCooldownActive && !session.showTapeteSignal) {
    return [{ kind: "wait", reason: "Pós-resultado — aguardar próxima indicação" }];
  }

  if (session.showTapeteSignal && session.activeCrossing && !session.lobbyCooldownActive) {
    const { factor1, factor2 } = session.activeCrossing;
    const mesa =
      session.currentTableId != null ? lobbyTableDisplayName(session.currentTableId) : "mesa";
    const actions: RotatingRoomClickBotAction[] = [];
    if (session.currentTableId != null) {
      actions.push({
        kind: "click",
        target: "prepare-open",
        label: mesa,
        reason: `Abrir ${mesa} no operador`,
      });
    }
    actions.push({
      kind: "click",
      target: "factor-1",
      label: doisFatoresFactorLabel(factor1),
      reason: session.singleFactorMode
        ? `JOGANDO em ${mesa} — aposta 1 Fator`
        : `JOGANDO em ${mesa} — factor 1`,
    });
    if (!session.singleFactorMode && factor2) {
      actions.push({
        kind: "click",
        target: "factor-2",
        label: doisFatoresFactorLabel(factor2),
        reason: `JOGANDO em ${mesa} — factor 2`,
      });
    }
    return actions;
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
