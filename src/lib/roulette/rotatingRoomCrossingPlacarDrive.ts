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
    before.awaitSwitchNoTable !== after.awaitSwitchNoTable
  );
}
