import { applyBridgeHistory, setFootballStudioBridgeStatus, setFootballStudioChannel } from "./hub";

const DEFAULTS = {
  bridgeBase: "https://bridge.brbet.partners",
  channel: "evolution.football-studio",
  apiKey: "",
  pollMs: 2000,
};

function resolveConfig() {
  return {
    bridgeBase: (
      process.env.BRBET_BRIDGE_BASE ||
      process.env.FOOTBALL_STUDIO_BRIDGE_BASE ||
      DEFAULTS.bridgeBase
    ).replace(/\/$/, ""),
    channel:
      process.env.BRBET_FS_CHANNEL ||
      process.env.FOOTBALL_STUDIO_CHANNEL ||
      DEFAULTS.channel,
    apiKey: (
      process.env.BRBET_API_KEY ||
      process.env.FOOTBALL_STUDIO_BRIDGE_API_KEY ||
      // Mesma key das extensões Obs (já no repo) — sobrescreve em produção.
      "8ef08be73b6b4c4ccc56c8ac408084fc6c58f3f315e6fe5ebc8261bda9dbb7e5"
    ).trim(),
    pollMs: Math.max(
      1500,
      Number(process.env.FOOTBALL_STUDIO_BRIDGE_POLL_MS) || DEFAULTS.pollMs,
    ),
  };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function pollOnce() {
  const config = resolveConfig();
  setFootballStudioChannel(config.channel);
  if (!config.apiKey) {
    setFootballStudioBridgeStatus(
      "no-key",
      "Define BRBET_API_KEY (ou FOOTBALL_STUDIO_BRIDGE_API_KEY) no .env",
    );
    return;
  }
  const url = `${config.bridgeBase}/api/games/${encodeURIComponent(config.channel)}/status`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-api-key": config.apiKey,
      },
    });
    if (!response.ok) throw new Error(`Bridge HTTP ${response.status}`);
    const payload = (await response.json()) as {
      history?: unknown[];
      lastResult?: unknown;
      updatedAt?: string;
    };
    const history = Array.isArray(payload.history)
      ? payload.history
      : payload.lastResult
        ? [payload.lastResult]
        : [];
    applyBridgeHistory(history, payload.updatedAt ?? new Date().toISOString());
  } catch (error) {
    setFootballStudioBridgeStatus(
      "error",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function startFootballStudioBridgePoller(): void {
  if (running) return;
  running = true;
  const config = resolveConfig();
  console.log(
    `[Football Studio] bridge poller · canal ${config.channel} · ${config.pollMs}ms`,
  );
  void pollOnce();
  timer = setInterval(() => {
    void pollOnce();
  }, config.pollMs);
}

export function stopFootballStudioBridgePoller(): void {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
