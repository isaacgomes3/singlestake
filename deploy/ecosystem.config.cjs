/** PM2 — produção: `pm2 start deploy/ecosystem.config.cjs` */
const path = require("node:path");

const root = path.join(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "singlestake",
      script: ".output/server/index.mjs",
      cwd: root,
      node_args: "--import dotenv/config",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "127.0.0.1",
      },
      max_memory_restart: "768M",
      listen_timeout: 15000,
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
    },
  ],
};
