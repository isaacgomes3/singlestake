import { detectSmartMoveConvergence } from "@/lib/smartMove/pattern";
import { defaultSmartMovePersisted, type SmartMovePersisted } from "@/lib/smartMove/persistence";

export type SmartMovePendingBet = {
  targets: number[];
  label: string;
};

export type SmartMoveSessionComputed = {
  persisted: SmartMovePersisted;
  currentGale: number;
  pendingBet: SmartMovePendingBet | null;
};

/**
 * Reconstrói placar, gale e aposta pendente **só a partir do histórico** espelho (newest-first),
 * no mesmo critério que o processamento incremental ao adicionar giros.
 */
export function computeSmartMoveSessionFromHistory(
  historyNewestFirst: readonly number[],
): SmartMoveSessionComputed {
  const persisted: SmartMovePersisted = { ...defaultSmartMovePersisted() };
  let currentGale = 0;
  let pendingBet: SmartMovePendingBet | null = null;

  const L = historyNewestFirst.length;
  for (let i = L - 1; i >= 0; i--) {
    const spin = historyNewestFirst[i]!;
    if (pendingBet) {
      const win = pendingBet.targets.includes(spin);
      if (win) {
        const ncw = persisted.currentConsecutiveWins + 1;
        persisted.winsAllTime += 1;
        persisted.currentConsecutiveWins = ncw;
        persisted.maxConsecutiveWins = Math.max(persisted.maxConsecutiveWins, ncw);
        persisted.currentConsecutiveLosses = 0;
        currentGale = 0;
      } else {
        const ncl = persisted.currentConsecutiveLosses + 1;
        persisted.lossesAllTime += 1;
        persisted.currentConsecutiveWins = 0;
        persisted.currentConsecutiveLosses = ncl;
        persisted.maxConsecutiveLosses = Math.max(persisted.maxConsecutiveLosses, ncl);
        currentGale = Math.min(4, currentGale + 1);
        persisted.maxGaleEver = Math.max(persisted.maxGaleEver, currentGale);
      }
      pendingBet = null;
    }
    const partial = historyNewestFirst.slice(i);
    const alert = detectSmartMoveConvergence(partial);
    pendingBet = alert
      ? { targets: [...alert.targetNumbers], label: alert.label }
      : null;
  }

  return { persisted, currentGale, pendingBet };
}
