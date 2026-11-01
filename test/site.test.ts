import { describe, expect, it } from "vitest";
import api from "../src/index";
import assets from "../site/generated/assets.json";
import type { Env } from "../src/types";

const env = {
  get DB() {
    throw new Error("Static pages must not query D1");
  },
} as Env;
const ctx = { waitUntil: () => {} } as ExecutionContext;
const get = (path: string, method = "GET") =>
  api.fetch(new Request("https://example.com" + path, { method }), env, ctx);

describe("Hugo documentation site", () => {
  it("serves the homepage and public policies without D1", async () => {
    const home = await get("/");
    expect(home.status).toBe(200);
    expect(home.headers.get("Content-Type")).toContain("text/html");
    expect(await home.text()).toContain(
      "Fail2ban の観測を、検索できるデータに。",
    );
    const scanner = await get("/policies/scanners/");
    const html = await scanner.text();
    for (const jail of [
      "secrets",
      "method",
      "traversal",
      "jndi",
      "sqli",
      "cve",
      "ua",
      "backdoor",
    ])
      expect(html).toContain("nginx-scanner-" + jail);
    expect(html).toContain("nginx-auth-garbage");
    expect(html).not.toContain("10.1.0.0/16");
  });

  it("serves referenced local pages and assets, including search, with their MIME types", async () => {
    const references = new Set<string>();
    for (const asset of Object.values(assets)) {
      if (!asset.type.startsWith("text/html")) continue;
      for (const match of asset.body.matchAll(
        /(?:href|src)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
      )) {
        const value = match[1] ?? match[2] ?? match[3];
        if (
          value.startsWith("/") &&
          !value.startsWith("//") &&
          !value.startsWith("/v1/")
        )
          references.add(value.split("#")[0]);
      }
    }
    for (const path of references) {
      let result = await get(path);
      if (result.status === 308) {
        const location = new URL(result.headers.get("Location")!);
        expect(location.origin).toBe("https://example.com");
        result = await get(location.pathname + location.search);
      }
      expect(result.status, path).toBe(200);
      expect(result.headers.get("Content-Type"), path).toBeTruthy();
    }
    const search = Object.keys(assets).find((path) =>
      path.includes("search-data"),
    )!;
    expect(
      Object.values(JSON.parse(await (await get(search)).text())).length,
    ).toBeGreaterThan(0);
    const css = Object.keys(assets).find((path) => path.endsWith(".css"))!;
    const result = await get(css);
    expect(result.headers.get("Content-Type")).toContain("text/css");
    expect(result.headers.get("Cache-Control")).toContain("immutable");
    const icon = await get("/favicon.ico");
    expect(icon.headers.get("Content-Type")).toBe("image/x-icon");
    expect((await icon.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("preserves canonical paths and returns a helpful HTML 404 while API errors remain JSON", async () => {
    const redirect = await get("/policies?from=home");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe(
      "https://example.com/policies/?from=home",
    );
    for (const path of ["/missing/", "/.env", "/__proto__"]) {
      const result = await get(path);
      expect(result.status).toBe(404);
      expect(await result.text()).toContain("ホームへ戻る");
    }
    const missingAPI = await get("/v1/missing");
    expect(missingAPI.status).toBe(404);
    expect(missingAPI.headers.get("Content-Type")).toContain(
      "application/json",
    );
    const head = await get("/", "HEAD");
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect((await get("/policies/", "POST")).status).toBe(405);
  });
});
