/** PM2 — produção: `pm2 start deploy/ecosystem.config.cjs` */
const path = require("node:path");

const root = path.join(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "singlestake",
      script: ".output/server/index.mjs",
      cwd: root,
      node_args: "--import ./deploy/node-preload.mjs --import dotenv/config",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "127.0.0.1",
        // Fallback se .env não tiver estas chaves (evita crash bufferutil no ws)
        WS_NO_BUFFER_UTIL: "1",
        WS_NO_UTF_8_VALIDATE: "1",
        ROULETTE_HUB_IDLE_SHUTDOWN_MS: "-1",
      },
      max_memory_restart: "768M",
      autorestart: true,
      max_restarts: 15,
      min_uptime: 5000,
      listen_timeout: 15000,
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
    },
  ],
};
