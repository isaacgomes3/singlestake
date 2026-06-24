import type { UmFatorMachineState } from "@/lib/roulette/rotatingRoomUmFatorStrategy";

export function umFatorMachinePlacarStepProgressed(
  before: UmFatorMachineState,
  after: UmFatorMachineState,
  step: { statsChanged: boolean; flash: unknown },
): boolean {
  return (
    step.statsChanged ||
    step.flash != null ||
    before.lastEvaluatedHead !== after.lastEvaluatedHead ||
    before.lastActiveTableId !== after.lastActiveTableId ||
    before.lastActive !== after.lastActive ||
    before.focusLockTableId !== after.focusLockTableId ||
    before.recovery !== after.recovery
  );
}
