import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
import ingest, { ingestSnapshot } from "../src/ingest";
import api from "../src/index";
import { normalizeIP } from "../src/validation";
import type { Env, Snapshot } from "../src/types";
let mf: Miniflare, env: Env;
const context = { waitUntil: () => {} } as ExecutionContext;
const auth = { access: { aud: "test-app-audience" } };
const now = () => Math.floor(Date.now() / 1000) - 100;
function snapshot(ips = ["1.1.1.1"], time = now()): Snapshot {
  return {
    schema_version: 1,
    source: "test",
    jail: "sshd",
    observed_at: new Date(time * 1000).toISOString(),
    currently_banned: ips.length,
    total_banned: 20,
    ips: ips.map((ip) => ({
      ip,
      country: "AU",
      asn: 13335,
      organization: "Test",
      network: null,
    })),
  };
}
function request(body: unknown) {
  return new Request("https://ingest.example.com/v1/ingest/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function get(path: string) {
  return api.fetch(new Request("https://api.example.com" + path), env, context);
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-10-23",
    }),
  );
  env = {
    DB: (await mf.getD1Database("DB")) as unknown as D1Database,
    SOURCE_SCOPES: JSON.stringify({
      "test-app-audience": { source: "test", jails: ["sshd", "nginx"] },
    }),
  };
  await env.DB.exec(
    (
      await readFile(
        new URL("../migrations/0001_initial.sql", import.meta.url),
        "utf8",
      )
    ).replaceAll("\n", " "),
  );
});
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ip_observations"),
    env.DB.prepare("DELETE FROM jail_state"),
  ]);
});
describe("validation and Access", () => {
  it("rejects unknown verified audiences and mismatched source paths", async () => {
    expect(
      (
        await ingest.fetch(request(snapshot()), env, {
          access: { aud: "other-app" },
        })
      ).status,
    ).toBe(403);
    const r = request(snapshot());
    const other = new Request(
      "https://ingest.example.com/v1/ingest/snapshot/other",
      r,
    );
    expect((await ingest.fetch(other, env, auth)).status).toBe(403);
  });
  it("rejects special IPv4 ranges and ambiguous spellings while preserving public boundaries", () => {
    for (const ip of [
      "192.175.48.1",
      "192.31.196.1",
      "192.52.193.1",
      "1.1",
      "0x01010101",
      "001.1.1.1",
      "256.1.1.1",
    ])
      expect(() => normalizeIP(ip)).toThrow();
    for (const ip of [
      "100.63.255.255",
      "100.128.0.1",
      "172.15.255.254",
      "172.32.0.1",
      "192.0.1.1",
    ])
      expect(normalizeIP(ip)).toBe(ip);
  });
  it("accepts Cloudflare JSON bindings for source scope", async () => {
    const runtime = {
      ...env,
      SOURCE_SCOPES: {
        "test-app-audience": { source: "test", jails: ["sshd"] },
      },
    };
    expect(
      (await ingest.fetch(request(snapshot()), runtime, auth)).status,
    ).toBe(200);
  });
  it("rejects unauthenticated calls and spoofed headers", async () => {
    const r = request(snapshot());
    r.headers.set("CF-Access-Client-Id", "test-app-audience");
    expect((await ingest.fetch(r, env, {})).status).toBe(403);
  });
  it("enforces source and jail scope from verified identity", async () => {
    expect(
      (
        await ingest.fetch(
          request({ ...snapshot(), source: "other" }),
          env,
          auth,
        )
      ).status,
    ).toBe(403);
    expect(
      (await ingest.fetch(request({ ...snapshot(), jail: "other" }), env, auth))
        .status,
    ).toBe(403);
  });
  it("rejects private, reserved, loopback, multicast, malformed and zoned addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.0.1",
      "100.64.0.1",
      "192.0.2.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "0.0.0.0",
      "::",
      "::1",
      "2001:db8::1",
      "fd00::1",
      "fe80::1",
      "ff02::1",
      "1.2.3.4/24",
      "fe80::1%eth0",
    ])
      expect(() => normalizeIP(ip), ip).toThrow();
  });
  it("normalizes IPv4-mapped and IPv6 spellings", () => {
    expect(normalizeIP("::ffff:1.1.1.1")).toBe("1.1.1.1");
    expect(normalizeIP("2001:4860:4860:0:0:0:0:8888")).toBe(
      "2001:4860:4860::8888",
    );
  });
  it("rejects oversized, invalid, conflicting and future data", async () => {
    for (const body of [
      { ...snapshot(), ips: [{ ip: "10.0.0.1" }] },
      { ...snapshot(), observed_at: "2099-01-01T00:00:00Z" },
      { ...snapshot(), currently_banned: -1 },
      {
        ...snapshot(),
        ips: [
          { ip: "1.1.1.1", country: "AU" },
          { ip: "::ffff:1.1.1.1", country: "US" },
        ],
      },
    ])
      expect((await ingest.fetch(request(body), env, auth)).status).toBe(400);
    const r = request(snapshot());
    r.headers.set("Content-Length", "3000000");
    expect((await ingest.fetch(r, env, auth)).status).toBe(413);
  });
});
describe("atomic diff ingestion", () => {
  it("stores, deduplicates, and avoids observation writes on replay/heartbeat", async () => {
    const t = now();
    const first = await ingest.fetch(
      request(snapshot(["1.1.1.1", "::ffff:1.1.1.1", "8.8.8.8"], t)),
      env,
      auth,
    );
    expect(first.status).toBe(200);
    const result = (await first.json()) as any;
    expect(result.public_ip_count).toBe(2);
    expect(
      (
        (await (
          await ingest.fetch(
            request(snapshot(["8.8.8.8", "1.1.1.1"], t)),
            env,
            auth,
          )
        ).json()) as any
      ).status,
    ).toBe("unchanged");
    const heartbeat = {
      ...snapshot([], t + 1),
      ips: undefined,
      mode: "heartbeat",
      snapshot_hash: result.snapshot_hash,
    };
    const r = await ingest.fetch(request(heartbeat), env, auth);
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).changed_rows).toBe(0);
    const row = await env.DB.prepare(
      "SELECT count(*) AS n FROM ip_observations",
    ).first<any>();
    expect(row.n).toBe(2);
  });
  it("marks removals inactive, handles empty snapshots and preserves first_seen on recurrence", async () => {
    const t = now();
    await ingestSnapshot(snapshot(["1.1.1.1", "8.8.8.8"], t), env);
    await ingestSnapshot(snapshot(["8.8.8.8"], t + 1), env);
    let row = await env.DB.prepare(
      "SELECT * FROM ip_observations WHERE ip='1.1.1.1'",
    ).first<any>();
    expect(row.active).toBe(0);
    expect(row.last_seen).toBe(t);
    await ingestSnapshot(snapshot(["1.1.1.1"], t + 2), env);
    row = await env.DB.prepare(
      "SELECT * FROM ip_observations WHERE ip='1.1.1.1'",
    ).first<any>();
    expect(row.first_seen).toBe(t);
    expect(row.active).toBe(1);
    await ingestSnapshot(snapshot([], t + 3), env);
    expect(
      (
        await env.DB.prepare(
          "SELECT count(*) AS n FROM ip_observations WHERE active=1",
        ).first<any>()
      ).n,
    ).toBe(0);
  });
  it("rejects stale updates, conflicting timestamps and unknown heartbeat hashes", async () => {
    const t = now();
    await ingestSnapshot(snapshot(["1.1.1.1"], t), env);
    expect(
      (await ingest.fetch(request(snapshot(["8.8.8.8"], t - 1)), env, auth))
        .status,
    ).toBe(409);
    expect(
      (await ingest.fetch(request(snapshot(["8.8.8.8"], t)), env, auth)).status,
    ).toBe(409);
    expect(
      (
        await ingest.fetch(
          request({
            ...snapshot([], t + 1),
            ips: undefined,
            mode: "heartbeat",
            snapshot_hash: "0".repeat(64),
          }),
          env,
          auth,
        )
      ).status,
    ).toBe(409);
  });
  it("serializes concurrent snapshots without mixing their IP sets", async () => {
    const t = now();
    await ingestSnapshot(snapshot(["1.1.1.1"], t), env);
    await Promise.allSettled([
      ingestSnapshot(snapshot(["8.8.8.8"], t + 1), env),
      ingestSnapshot(snapshot(["9.9.9.9"], t + 2), env),
    ]);
    const state = await env.DB.prepare(
      "SELECT collected_at FROM jail_state",
    ).first<any>();
    const ips = (
      await env.DB.prepare(
        "SELECT ip FROM ip_observations WHERE active=1",
      ).all<any>()
    ).results.map((r) => r.ip);
    expect(ips).toEqual(
      state.collected_at === t + 2 ? ["9.9.9.9"] : ["8.8.8.8"],
    );
  });
});
describe("public API", () => {
  it("limits public clients before database reads", async () => {
    const limited = {
      ...env,
      READ_LIMITER: { limit: async () => ({ success: false }) },
    };
    const result = await api.fetch(
      new Request("https://api.example.com/v1/ips"),
      limited,
      context,
    );
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("60");
  });
  it("supports lookup, search, pagination, statistics, sources and text feed", async () => {
    await ingestSnapshot(snapshot(["1.1.1.1", "8.8.8.8", "9.9.9.9"]), env);
    const first = (await (await get("/v1/ips?limit=2")).json()) as any;
    expect(first.observations).toHaveLength(2);
    expect(
      (
        (await (
          await get("/v1/ips?limit=2&cursor=" + first.next_cursor)
        ).json()) as any
      ).observations,
    ).toHaveLength(1);
    expect(
      ((await (await get("/v1/lookup?ip=::ffff:1.1.1.1")).json()) as any)
        .observations,
    ).toHaveLength(1);
    expect(((await (await get("/v1/stats")).json()) as any).active.ips).toBe(3);
    expect(
      ((await (await get("/v1/sources")).json()) as any).sources,
    ).toHaveLength(1);
    const feed = await get("/v1/feed.txt?limit=2");
    expect((await feed.text()).trim().split("\n")).toHaveLength(2);
    expect(feed.headers.get("X-Truncated")).toBe("true");
    expect((await get("/v1/ips?country=AU&asn=13335")).status).toBe(200);
  });
  it("excludes stale sources from active lists, statistics and feeds", async () => {
    await ingestSnapshot(snapshot(["1.1.1.1"], now() - 3 * 86400), env);
    expect(
      ((await (await get("/v1/ips")).json()) as any).observations,
    ).toHaveLength(0);
    expect(await (await get("/v1/feed.txt")).text()).toBe("");
    expect(
      ((await (await get("/v1/lookup?ip=1.1.1.1")).json()) as any)
        .observations[0].stale,
    ).toBe(1);
  });
  it("rejects invalid cursors, SQL-like input and write methods", async () => {
    for (const path of [
      "/v1/lookup?ip=invalid",
      "/v1/ips?limit=999999",
      "/v1/ips?cursor=broken",
      "/v1/ips?source=foo%27OR%201=1",
      "/v1/ips?active=maybe",
    ])
      expect((await get(path)).status).toBe(400);
    expect((await api.fetch(request(snapshot()), env, context)).status).toBe(
      405,
    );
  });
});

describe("query filters, sorting and aggregated statistics", () => {
  interface Seed {
    ip: string;
    first: number;
    last: number;
    collected?: number;
    country?: string;
    asn?: number;
    organization?: string;
    active?: number;
    source?: string;
    jail?: string;
  }

  async function seed(rows: Seed[]) {
    const states = new Map<
      string,
      { source: string; jail: string; collected: number }
    >();
    for (const row of rows) {
      const source = row.source ?? "test";
      const jail = row.jail ?? "sshd";
      const collected = row.collected ?? row.last;
      const key = `${source}\u0000${jail}`;
      const previous = states.get(key);
      if (!previous || collected > previous.collected)
        states.set(key, { source, jail, collected });
    }
    for (const state of states.values())
      await env.DB.prepare(
        "INSERT OR REPLACE INTO jail_state(source,jail,snapshot_hash,collected_at,currently_banned,total_banned,public_ip_count,write_token) VALUES(?,?,?,?,?,?,?,?)",
      )
        .bind(
          state.source,
          state.jail,
          "seed",
          state.collected,
          1,
          1,
          1,
          "token",
        )
        .run();
    for (const row of rows)
      await env.DB.prepare(
        "INSERT OR REPLACE INTO ip_observations(source,jail,ip,first_seen,last_seen,active,country,asn,organization,network) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          row.source ?? "test",
          row.jail ?? "sshd",
          row.ip,
          row.first,
          row.last,
          row.active ?? 1,
          row.country === undefined ? "AU" : row.country,
          row.asn === undefined ? 13335 : row.asn,
          row.organization === undefined ? "Test" : row.organization,
          null,
        )
        .run();
  }

  it("filters by prefix, organization, time range, stale and active", async () => {
    const t = now();
    await seed([
      {
        ip: "1.1.1.1",
        first: t - 1000,
        last: t - 500,
        country: "JP",
        asn: 13335,
        organization: "Cloudflare",
        jail: "sshd",
      },
      {
        ip: "8.8.8.8",
        first: t - 2000,
        last: t - 100,
        country: "US",
        asn: 15169,
        organization: "Google",
        jail: "nginx",
      },
      {
        ip: "9.9.9.9",
        first: t - 3000,
        last: t - 900,
        country: "JP",
        asn: 13335,
        organization: "Cloudflare",
        jail: "postfix",
      },
      {
        ip: "1.0.1.1",
        first: t - 4000,
        last: t - 4000,
        collected: t - 3 * 86400,
        country: "JP",
        asn: 13335,
        organization: "Cloudflare",
        jail: "recidive",
      },
    ]);
    const ips = async (query: string) =>
      ((await (await get("/v1/ips?" + query)).json()) as any).observations.map(
        (row: any) => row.ip,
      );
    expect(await ips("ip_prefix=1.1.")).toEqual(["1.1.1.1"]);
    expect(await ips("organization=cloudflare")).toEqual([
      "1.1.1.1",
      "9.9.9.9",
    ]);
    expect(await ips("organization=cloudflare&active=all")).toHaveLength(3);
    expect(await ips(`country=JP&first_seen_from=${t - 2500}`)).toEqual([
      "1.1.1.1",
    ]);
    expect(await ips(`last_seen_to=${t - 800}`)).toEqual(["9.9.9.9"]);
    expect(await ips("active=all&stale=true")).toEqual(["1.0.1.1"]);
    expect(await ips("active=all&stale=false")).toHaveLength(3);
  });

  it("sorts across pages without duplicates and rejects a cursor from another query", async () => {
    const t = now();
    await seed(
      ["1.1.1.1", "8.8.8.8", "9.9.9.9", "1.0.1.1", "4.4.4.4"].map(
        (ip, index) => ({
          ip,
          first: t - 1000 + index * 10,
          last: t - 500 + index * 10,
          jail: ["sshd", "nginx", "postfix", "dovecot", "recidive"][index],
        }),
      ),
    );
    const collected: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 4; page++) {
      const query =
        `/v1/ips?sort=last_seen&order=desc&limit=2` +
        (cursor ? `&cursor=${cursor}` : "");
      const data = (await (await get(query)).json()) as any;
      collected.push(...data.observations.map((row: any) => row.ip));
      cursor = data.next_cursor;
      if (!cursor) break;
    }
    expect(collected).toEqual([
      "4.4.4.4",
      "1.0.1.1",
      "9.9.9.9",
      "8.8.8.8",
      "1.1.1.1",
    ]);
    const first = (await (
      await get("/v1/ips?sort=last_seen&order=desc&limit=1")
    ).json()) as any;
    expect(
      (
        await get(
          `/v1/ips?sort=first_seen&order=desc&cursor=${first.next_cursor}`,
        )
      ).status,
    ).toBe(400);
  });

  it("applies filters to statistics and groups by a selected column", async () => {
    const t = now();
    await seed([
      {
        ip: "1.1.1.1",
        first: t - 100,
        last: t - 50,
        country: "JP",
        asn: 13335,
        jail: "sshd",
      },
      {
        ip: "9.9.9.9",
        first: t - 200,
        last: t - 60,
        country: "JP",
        asn: 13335,
        jail: "nginx",
      },
      {
        ip: "8.8.8.8",
        first: t - 300,
        last: t - 70,
        country: "US",
        asn: 15169,
        jail: "postfix",
      },
    ]);
    const filtered = (await (await get("/v1/stats?country=JP")).json()) as any;
    expect(filtered.active.observations).toBe(2);
    expect(filtered.countries).toEqual([
      { value: "JP", observations: 2, ips: 2 },
    ]);
    const grouped = (await (
      await get(
        "/v1/stats?country=JP&group_by=asn&sort=observations&order=desc&limit=1",
      )
    ).json()) as any;
    expect(grouped.group_by).toBe("asn");
    expect(grouped.groups).toEqual([{ value: 13335, observations: 2, ips: 2 }]);
    expect((await get("/v1/stats?group_by=bogus")).status).toBe(400);
  });

  it("applies filters and cursor binding to the text feed", async () => {
    const t = now();
    await seed([
      { ip: "1.1.1.1", first: t - 100, last: t - 50, country: "JP" },
      { ip: "8.8.8.8", first: t - 200, last: t - 60, country: "US" },
      { ip: "9.9.9.9", first: t - 300, last: t - 70, country: "JP" },
    ]);
    const feed = await get("/v1/feed.txt?country=JP&limit=1");
    expect((await feed.text()).trim()).toBe("1.1.1.1");
    const cursor = feed.headers.get("X-Next-Cursor")!;
    expect(cursor).toBeTruthy();
    const next = await get(`/v1/feed.txt?country=JP&limit=1&cursor=${cursor}`);
    expect((await next.text()).trim()).toBe("9.9.9.9");
    expect(
      (await get(`/v1/feed.txt?country=US&limit=1&cursor=${cursor}`)).status,
    ).toBe(400);
  });

  it("rejects invalid filters, sorts and ranges", async () => {
    for (const path of [
      "/v1/ips?sort=bogus",
      "/v1/ips?order=bogus",
      "/v1/ips?stale=maybe",
      "/v1/ips?ip_prefix=%25",
      "/v1/ips?organization=",
      "/v1/ips?first_seen_from=abc",
      "/v1/ips?first_seen_from=20&first_seen_to=10",
      "/v1/stats?sort=bogus",
      "/v1/stats?order=bogus",
      "/v1/stats?limit=999999",
    ])
      expect((await get(path)).status, path).toBe(400);
  });
});
