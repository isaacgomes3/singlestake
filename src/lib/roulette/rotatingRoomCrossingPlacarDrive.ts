import type { RotatingRoomCrossingMachineState } from "@/lib/roulette/rotatingRoomCrossingStrategy";

export function crossingMachinePlacarStepProgressed(
  before: RotatingRoomCrossingMachineState,
  after: RotatingRoomCrossingMachineState,
  step: { statsChanged: boolean; flash: unknown },
): boolean {
  return (
    step.statsChanged ||
    step.flash != null ||
    before.lastEvaluatedHead !== after.lastEvaluatedHead ||
    before.armedAtHead !== after.armedAtHead ||
    before.prepareFingerprint !== after.prepareFingerprint ||
    before.prepareTableId !== after.prepareTableId ||
    before.cycleTableId !== after.cycleTableId ||
    before.cycleActive !== after.cycleActive ||
    before.recovery !== after.recovery ||
    before.cycleSpinsWithoutWin !== after.cycleSpinsWithoutWin ||
    before.cycleSeq !== after.cycleSeq ||
    before.cycleFingerprint !== after.cycleFingerprint ||
    before.postResultHoldUntilMs !== after.postResultHoldUntilMs ||
    before.postResultHoldTableId !== after.postResultHoldTableId ||
    before.awaitSwitchNoTable !== after.awaitSwitchNoTable
  );
}
