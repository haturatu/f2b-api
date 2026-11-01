import { build } from "esbuild";
await build({
  entryPoints: { api: "src/index.ts", ingest: "src/ingest.ts" },
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
});
console.log("INFO: Worker bundles built");
