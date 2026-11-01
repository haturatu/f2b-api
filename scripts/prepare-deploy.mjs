import { chmod, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, process.env.DEPLOY_OUTPUT ?? ".deploy");
const compatibilityDate = "2026-10-31";

function fail(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}

function object(value, name) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail(name + " must be an object");
  return value;
}

function text(value, name, pattern) {
  if (typeof value !== "string" || !value || (pattern && !pattern.test(value)))
    fail(name + " is missing or invalid");
  return value;
}

const raw = process.env.F2B_DEPLOY_CONFIG;
if (!raw) fail("F2B_DEPLOY_CONFIG is required");
let config;
try {
  config = object(JSON.parse(raw), "F2B_DEPLOY_CONFIG");
} catch (error) {
  fail("F2B_DEPLOY_CONFIG is not valid JSON: " + error.message);
}

const account = text(config.account_id, "account_id", /^[0-9a-f]{32}$/i);
const databaseName = text(
  config.database_name,
  "database_name",
  /^[a-z0-9][a-z0-9-]{0,62}$/,
);
const databaseId = text(
  config.database_id,
  "database_id",
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);
const workers = object(config.workers, "workers");
const api = object(workers.api, "workers.api");
const ingest = object(workers.ingest, "workers.ingest");
const apiName = text(api.name, "workers.api.name", /^[a-z0-9][a-z0-9-]{0,62}$/);
const hostname =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const siteHostname = text(api.hostname, "workers.api.hostname", hostname);
const apiHostname =
  config.api_hostname == null
    ? undefined
    : text(config.api_hostname, "api_hostname", hostname);
const ingestName = text(
  ingest.name,
  "workers.ingest.name",
  /^[a-z0-9][a-z0-9-]{0,62}$/,
);
const rateLimit = object(config.rate_limit, "rate_limit");
const namespaceId = text(rateLimit.namespace_id, "rate_limit.namespace_id");
const limit = Number(rateLimit.limit);
const period = Number(rateLimit.period);
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000)
  fail("rate_limit.limit must be a positive integer");
if (period !== 10 && period !== 60) fail("rate_limit.period must be 10 or 60");
const staleSeconds = String(config.stale_seconds ?? "");
if (!/^[1-9][0-9]*$/.test(staleSeconds))
  fail("stale_seconds must be a positive integer");

const scopes = object(config.source_scopes, "source_scopes");
if (!Object.keys(scopes).length) fail("source_scopes must not be empty");
for (const [audience, value] of Object.entries(scopes)) {
  if (!audience || audience.length > 128)
    fail("source_scopes contains an invalid Access audience");
  const scope = object(value, "source_scopes." + audience);
  text(scope.source, "source_scopes.source", /^[a-z0-9][a-z0-9_-]{0,63}$/);
  if (
    !Array.isArray(scope.jails) ||
    !scope.jails.length ||
    !scope.jails.every(
      (jail) =>
        typeof jail === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(jail),
    )
  )
    fail("source_scopes." + audience + ".jails must be a non-empty list");
}

const base = {
  $schema: "../node_modules/wrangler/config-schema.json",
  compatibility_date: compatibilityDate,
  workers_dev: false,
  preview_urls: false,
  d1_databases: [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: databaseId,
      migrations_dir: "../migrations",
    },
  ],
};
const apiConfig = {
  ...base,
  name: apiName,
  main: "../dist/api.js",
  ...(apiHostname
    ? { vars: { API_HOST: apiHostname, SITE_HOST: siteHostname } }
    : {}),
  ratelimits: [
    {
      name: "READ_LIMITER",
      namespace_id: namespaceId,
      simple: { limit, period },
    },
  ],
};
const ingestConfig = {
  ...base,
  name: ingestName,
  main: "../dist/ingest.js",
  vars: { STALE_SECONDS: staleSeconds },
};
const secrets = { SOURCE_SCOPES: JSON.stringify(scopes) };

await mkdir(output, { recursive: true, mode: 0o700 });
await writeFile(
  resolve(output, "api.json"),
  JSON.stringify(apiConfig, null, 2) + "\n",
);
await writeFile(
  resolve(output, "ingest.json"),
  JSON.stringify(ingestConfig, null, 2) + "\n",
);
const secretsPath = resolve(output, "ingest-secrets.json");
await writeFile(secretsPath, JSON.stringify(secrets) + "\n");
await chmod(secretsPath, 0o600);
await writeFile(resolve(output, "database-name"), databaseName + "\n");
await writeFile(resolve(output, "account-id"), account + "\n");

console.log(
  "INFO: prepared Wrangler configuration for " + apiName + " and " + ingestName,
);
