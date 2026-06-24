/** PM2 — arrancar em produção: `pm2 start deploy/ecosystem.config.cjs` */
module.exports = {
  apps: [
    {
      name: "roleta-poupexplay",
      script: ".output/server/index.mjs",
      cwd: __dirname + "/..",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "127.0.0.1",
      },
      max_memory_restart: "512M",
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
