import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await esbuild.build({
  entryPoints: [resolve(root, "extension/strategy-entry.ts")],
  outfile: resolve(root, "extension/um-fator-engine.js"),
  bundle: true,
  format: "iife",
  globalName: "SinglestakeUmFator",
  platform: "browser",
  target: "chrome110",
  alias: {
    "@": resolve(root, "src"),
  },
  logLevel: "info",
});

console.log("Built extension/um-fator-engine.js");
