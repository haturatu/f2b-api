import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/prepare-deploy.mjs");
const config = {
  account_id: "f3cd3d044c5e24de81291a737f1afc41",
  database_name: "f2b-api",
  database_id: "00000000-0000-4000-8000-000000000000",
  workers: { api: { name: "f2b-api" }, ingest: { name: "f2b-ingest" } },
  source_scopes: {
    ["a".repeat(64)]: { source: "freebsd", jails: ["sshd", "postfix"] },
  },
  stale_seconds: "172800",
  rate_limit: { namespace_id: "1001", limit: 120, period: 60 },
};
const outputs: string[] = [];

async function generate(value: unknown): Promise<string> {
  const output = await mkdtemp(join(tmpdir(), "f2b-deploy-"));
  outputs.push(output);
  execFileSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      F2B_DEPLOY_CONFIG: JSON.stringify(value),
      DEPLOY_OUTPUT: output,
    },
    stdio: "pipe",
  });
  return output;
}

afterAll(async () => {
  await Promise.all(
    outputs.map((output) => rm(output, { recursive: true, force: true })),
  );
});

describe("deployment configuration", () => {
  it("generates both Wrangler configurations and the ingestion secret", async () => {
    const output = await generate(config);
    const api = JSON.parse(await readFile(join(output, "api.json"), "utf8"));
    const ingest = JSON.parse(
      await readFile(join(output, "ingest.json"), "utf8"),
    );
    const secrets = JSON.parse(
      await readFile(join(output, "ingest-secrets.json"), "utf8"),
    );

    expect(api.name).toBe("f2b-api");
    expect(api.main).toBe("../dist/api.js");
    expect(api.workers_dev).toBe(false);
    expect(api.d1_databases[0]).toMatchObject({
      binding: "DB",
      database_id: config.database_id,
    });
    expect(api.ratelimits).toEqual([
      {
        name: "READ_LIMITER",
        namespace_id: "1001",
        simple: { limit: 120, period: 60 },
      },
    ]);
    expect(ingest.name).toBe("f2b-ingest");
    expect(ingest.vars).toEqual({ STALE_SECONDS: "172800" });
    expect(JSON.parse(secrets.SOURCE_SCOPES)).toEqual(config.source_scopes);
    expect((await readFile(join(output, "database-name"), "utf8")).trim()).toBe(
      "f2b-api",
    );
  });

  it("rejects incomplete deployment configuration", async () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, F2B_DEPLOY_CONFIG: JSON.stringify({}) },
      stdio: "pipe",
    });
    expect(result.status).not.toBe(0);
  });

  it("rejects access scopes without jails", async () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        F2B_DEPLOY_CONFIG: JSON.stringify({
          ...config,
          source_scopes: { ["a".repeat(64)]: { source: "freebsd", jails: [] } },
        }),
      },
      stdio: "pipe",
    });
    expect(result.status).not.toBe(0);
  });
});
