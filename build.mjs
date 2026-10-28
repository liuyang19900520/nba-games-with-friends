import { build } from "esbuild";
const common = { bundle: true, platform: "node", target: "node22", format: "esm", outExtension: { ".js": ".mjs" }, external: ["pg-native"],
  banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" } };
await build({ ...common, entryPoints: { index: "api/lambda.ts" }, outdir: "dist/api" });
try { await build({ ...common, entryPoints: { index: "sync/lambda.ts" }, outdir: "dist/sync" }); } catch { console.warn("sync bundle skipped (nba-sync not ready)"); }
console.log("built dist/api/index.mjs (+ dist/sync)");
