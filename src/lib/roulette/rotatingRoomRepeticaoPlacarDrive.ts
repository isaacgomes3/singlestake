import type { RotatingRoomRepeticaoMachineState } from "@/lib/roulette/rotatingRoomRepeticaoStrategy";

export function repeticaoMachinePlacarStepProgressed(
  before: RotatingRoomRepeticaoMachineState,
  after: RotatingRoomRepeticaoMachineState,
  step: { statsChanged: boolean; flash: unknown },
): boolean {
  return (
    step.statsChanged ||
    step.flash != null ||
    before.lastEvaluatedHead !== after.lastEvaluatedHead ||
    before.armedAtHead !== after.armedAtHead ||
    before.cycleTableId !== after.cycleTableId ||
    before.cycleZoneKind !== after.cycleZoneKind ||
    before.cycleZone?.id !== after.cycleZone?.id ||
    before.recovery !== after.recovery ||
    before.prepareTableId !== after.prepareTableId ||
    before.prepareZoneKind !== after.prepareZoneKind ||
    before.cycleSeq !== after.cycleSeq ||
    before.awaitSwitchNoTable !== after.awaitSwitchNoTable
  );
}
