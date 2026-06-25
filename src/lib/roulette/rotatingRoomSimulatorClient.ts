import type {
  RotatingRoomSimulatorIndication,
  RotatingRoomSimulatorStreamMessage,
} from "@/lib/roulette/rotatingRoomSimulatorTypes";

export const ROTATING_ROOM_SIMULATOR_CHANGED_EVENT = "rotating-room-simulator-changed";

let indication: RotatingRoomSimulatorIndication | null = null;
let connected = false;

export function getRotatingRoomSimulatorIndication(): RotatingRoomSimulatorIndication | null {
  return indication;
}

export function isRotatingRoomSimulatorConnected(): boolean {
  return connected;
}

export function applyRotatingRoomSimulatorStreamMessage(
  msg: RotatingRoomSimulatorStreamMessage,
): void {
  if (msg.type === "sync") {
    indication = msg.indication;
    connected = true;
  } else {
    indication = msg.indication;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_SIMULATOR_CHANGED_EVENT));
  }
}

export function clearRotatingRoomSimulatorClientState(): void {
  indication = null;
  connected = false;
}

export async function bootstrapRotatingRoomSimulatorIndication(): Promise<boolean> {
  try {
    const res = await fetch("/api/roulette/rotating-room");
    if (!res.ok) return false;
    const body = (await res.json()) as RotatingRoomSimulatorIndication;
    applyRotatingRoomSimulatorStreamMessage({ type: "sync", indication: body });
    return true;
  } catch {
    return false;
  }
}
