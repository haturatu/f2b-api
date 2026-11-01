import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "site/public");
await rm(output, { recursive: true, force: true });
const result = spawnSync(
  process.env.HUGO_BIN ?? "hugo",
  ["--source", "site", "--minify", "--gc"],
  {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  },
);
if (result.error || result.status !== 0) {
  console.error("ERROR: Hugo site build failed; install Hugo extended and Go.");
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(1);
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
const assets = {};
for (const file of (
  await readdir(output, { recursive: true, withFileTypes: true })
)
  .filter((entry) => entry.isFile())
  .sort((a, b) =>
    (a.parentPath + a.name).localeCompare(b.parentPath + b.name),
  )) {
  const path = resolve(file.parentPath, file.name);
  const extension = extname(path);
  if (!types[extension])
    throw new Error(`Unsupported public asset type: ${extension}`);
  const data = await readFile(path);
  const binary = [".png", ".ico"].includes(extension);
  assets["/" + path.slice(output.length + 1).replaceAll("\\", "/")] = {
    body: data.toString(binary ? "base64" : "utf8"),
    type: types[extension],
    binary,
    etag: '"' + createHash("sha256").update(data).digest("hex") + '"',
  };
}
await mkdir(resolve(root, "site/generated"), { recursive: true });
await writeFile(
  resolve(root, "site/generated/assets.json"),
  JSON.stringify(assets),
);
console.log(
  `INFO: ${Object.keys(assets).length} Hugo assets prepared for the existing Worker`,
);
