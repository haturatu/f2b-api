import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
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
const compressed = gzipSync(await readFile("dist/api.js")).length;
if (compressed > 2800000) {
  console.error(
    "ERROR: API and static site bundle exceeds the free-plan size budget",
  );
  process.exit(1);
}
console.log("INFO: Worker bundles built");
