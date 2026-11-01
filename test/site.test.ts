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
const get = (path: string, init?: RequestInit) =>
  api.fetch(new Request("https://example.com" + path, init), env, ctx);
const withCountry = (request: Request, country: string) => {
  Object.defineProperty(request, "cf", { value: { country } });
  return request;
};

describe("Hugo documentation site", () => {
  it("serves the site in Japanese and English without D1", async () => {
    const ja = await get("/ja/");
    expect(ja.status).toBe(200);
    expect(ja.headers.get("Content-Type")).toContain("text/html");
    expect(await ja.text()).toContain(
      "Fail2ban の観測を、検索できるデータに。",
    );

    const en = await get("/en/");
    expect(en.status).toBe(200);
    expect(await en.text()).toContain(
      "Fail2ban observations, made searchable.",
    );

    const scanner = await get("/ja/policies/scanners/");
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

  it("chooses the language from cookie, browser, country, then defaults to English", async () => {
    const root = (init?: RequestInit) => get("/", init);

    let response = await root();
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://example.com/en/");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toContain("Accept-Language");

    response = await root({
      headers: { "Accept-Language": "ja-JP, ja;q=0.9" },
    });
    expect(response.headers.get("Location")).toBe("https://example.com/ja/");

    response = await root({ headers: { "Accept-Language": "en-US,en;q=0.9" } });
    expect(response.headers.get("Location")).toBe("https://example.com/en/");

    const japanese = await api.fetch(
      withCountry(new Request("https://example.com/"), "JP"),
      env,
      ctx,
    );
    expect(japanese.headers.get("Location")).toBe("https://example.com/ja/");

    const german = await api.fetch(
      withCountry(new Request("https://example.com/"), "DE"),
      env,
      ctx,
    );
    expect(german.headers.get("Location")).toBe("https://example.com/en/");

    response = await root({
      headers: {
        "Accept-Language": "en-US",
        Cookie: "theme=dark; lang=ja",
      },
    });
    expect(response.headers.get("Location")).toBe("https://example.com/ja/");
  });

  it("moves legacy document paths to the selected language", async () => {
    const redirect = await get("/policies?from=home");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe(
      "https://example.com/en/policies/?from=home",
    );

    const japanese = await get("/about", {
      headers: { Cookie: "lang=ja" },
    });
    expect(japanese.headers.get("Location")).toBe(
      "https://example.com/ja/about/",
    );
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

  it("preserves canonical paths and returns a localized HTML 404 while API errors remain JSON", async () => {
    const redirect = await get("/ja/policies?from=home");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe(
      "https://example.com/ja/policies/?from=home",
    );

    const japanese = await get("/ja/missing/");
    expect(japanese.status).toBe(404);
    expect(await japanese.text()).toContain("ホームへ戻る");

    const english = await get("/en/missing/");
    expect(english.status).toBe(404);
    expect(await english.text()).toContain("Back to home");

    for (const path of ["/missing/", "/.env", "/__proto__"]) {
      const result = await get(path);
      expect(result.status).toBe(404);
      expect(await result.text()).toContain("Back to home");
    }
    const missingAPI = await get("/v1/missing");
    expect(missingAPI.status).toBe(404);
    expect(missingAPI.headers.get("Content-Type")).toContain(
      "application/json",
    );
    const head = await get("/ja/", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect((await get("/ja/policies/", { method: "POST" })).status).toBe(405);
  });

  it("declares the language alternates for search engines", async () => {
    const html = await (await get("/ja/about/")).text();
    expect(html).toMatch(/hreflang=("?)ja\1/);
    expect(html).toMatch(/hreflang=("?)en\1/);
    expect(html).toContain("hreflang=x-default");
    expect(html).toContain("https://f2b.0xhw.com/en/about/");
  });
});
