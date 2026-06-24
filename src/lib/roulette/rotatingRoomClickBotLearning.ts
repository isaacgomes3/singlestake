import { doisFatoresFactorLabel, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";

/** Alvos clicáveis só no painel da nossa app (não no iframe do casino). */
export type RotatingRoomClickBotTarget = "prepare-open" | "factor-1" | "factor-2";

export const ROTATING_ROOM_CLICK_BOT_TARGET_SELECTOR: Record<RotatingRoomClickBotTarget, string> = {
  "prepare-open": '[data-click-bot="prepare-open"]',
  "factor-1": '[data-click-bot="factor-1"]',
  "factor-2": '[data-click-bot="factor-2"]',
};

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
  sessionMode: RotatingRoomSessionMode;
  showTapeteSignal: boolean;
  prepareTableId: number | null;
  currentTableId: number | null;
  activeCrossing: DoisFatoresActive | null;
};

/** Plano de acções com base no estado actual da estratégia (só UI nossa). */
export function planRotatingRoomClickBotActions(
  session: RotatingRoomClickBotSessionSlice,
): RotatingRoomClickBotAction[] {
  const isPrepare =
    session.sessionMode === "prepare" ||
    (session.prepareTableId != null && !session.showTapeteSignal);

  if (isPrepare && session.prepareTableId != null) {
    const mesa = lobbyTableDisplayName(session.prepareTableId);
    return [
      {
        kind: "click",
        target: "prepare-open",
        label: mesa,
        reason: "Fase POSICIONAR — abrir a mesa indicada no painel",
      },
    ];
  }

  if (session.showTapeteSignal && session.activeCrossing) {
    const { factor1, factor2 } = session.activeCrossing;
    const mesa =
      session.currentTableId != null ? lobbyTableDisplayName(session.currentTableId) : "mesa";
    return [
      {
        kind: "click",
        target: "factor-1",
        label: doisFatoresFactorLabel(factor1),
        reason: `JOGANDO em ${mesa} — factor 1 (simulação)`,
      },
      {
        kind: "click",
        target: "factor-2",
        label: doisFatoresFactorLabel(factor2),
        reason: `JOGANDO em ${mesa} — factor 2 (simulação)`,
      },
    ];
  }

  if (session.sessionMode === "awaiting_queue") {
    return [{ kind: "wait", reason: "Aguardar próxima mesa (recuperação)" }];
  }

  return [{ kind: "wait", reason: "Sem sinal — aguardar cruzamento na sala rotativa" }];
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
