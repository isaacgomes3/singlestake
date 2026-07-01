import type { RotatingRoomFibonacciMachineState } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

export function fibonacciMachinePlacarStepProgressed(
  before: RotatingRoomFibonacciMachineState,
  after: RotatingRoomFibonacciMachineState,
  step: { statsChanged: boolean; flash: unknown },
): boolean {
  return (
    step.statsChanged ||
    step.flash != null ||
    before.lastEvaluatedHead !== after.lastEvaluatedHead ||
    before.armedAtHead !== after.armedAtHead ||
    before.cycleTableId !== after.cycleTableId ||
    before.cycleZone?.kind !== after.cycleZone?.kind ||
    before.cycleZone?.id !== after.cycleZone?.id ||
    before.recovery !== after.recovery ||
    before.prepareTableId !== after.prepareTableId ||
    before.prepareZone?.kind !== after.prepareZone?.kind ||
    before.prepareZone?.id !== after.prepareZone?.id ||
    before.cycleSeq !== after.cycleSeq ||
    before.awaitSwitchNoTable !== after.awaitSwitchNoTable
  );
}
