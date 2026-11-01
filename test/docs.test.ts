import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import api from "../src/index";
import type { Env } from "../src/types";

const env = {
  get DB() {
    throw new Error("Documentation must not query D1");
  },
} as Env;
const ctx = { waitUntil: () => {} } as ExecutionContext;
const fetch = (path: string, method = "GET") =>
  api.fetch(
    new Request(`https://staging.example.com${path}`, { method }),
    env,
    ctx,
  );

describe("public API documentation", () => {
  it("serves both docs paths with GET-only execution and pinned assets", async () => {
    for (const path of ["/docs", "/docs/"]) {
      const result = await fetch(path);
      expect(result.status).toBe(200);
      expect(result.headers.get("Content-Type")).toContain("text/html");
      expect(result.headers.get("Cache-Control")).toBe("public, max-age=3600");
      const html = await result.text();
      expect(html).toContain('supportedSubmitMethods: ["get"]');
      expect(html).toContain('url: "/openapi.json"');
      expect(html).toContain("validatorUrl: null");
      expect(html).toContain("swagger-ui-dist@5.33.3");
      expect(html.match(/integrity="sha384-/g)).toHaveLength(2);
      const nonce = html.match(/<script nonce="([^"]+)"/)![1];
      expect(result.headers.get("Content-Security-Policy")).toContain(
        `'nonce-${nonce}'`,
      );
      expect(result.headers.get("Content-Security-Policy")).toContain(
        "connect-src 'self'",
      );
    }
  });

  it("publishes the checked-in public specification on the current host", async () => {
    const result = await fetch("/openapi.json");
    expect(result.status).toBe(200);
    expect(result.headers.get("Content-Type")).toContain("application/json");
    expect(result.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const spec = (await result.json()) as any;
    const checkedIn = JSON.parse(
      await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
    );
    expect(spec).toEqual(checkedIn);
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.servers).toEqual([
      { url: "https://api.f2b.0xhw.com", description: expect.any(String) },
    ]);
    expect(Object.keys(spec.paths)).toHaveLength(6);
    for (const path of Object.values(spec.paths))
      expect(Object.keys(path as object)).toEqual(["get"]);
    expect(spec.components.securitySchemes).toBeUndefined();
    for (const name of [
      "Observation",
      "Lookup",
      "ObservationPage",
      "Stats",
      "SourceState",
    ]) {
      expect(
        Object.keys(spec.components.schemas[name].properties).length,
      ).toBeGreaterThan(1);
    }
    const visit = (value: any) => {
      if (!value || typeof value !== "object") return;
      if (value.$ref) {
        expect(value.$ref).toMatch(/^#\//);
        expect(
          value.$ref
            .slice(2)
            .split("/")
            .reduce((node: any, key: string) => node?.[key], spec),
        ).toBeDefined();
      }
      Object.values(value).forEach(visit);
    };
    visit(spec);
    const collector = JSON.parse(
      await readFile(
        new URL("../openapi-ingest.json", import.meta.url),
        "utf8",
      ),
    );
    expect(
      collector.paths["/v1/ingest/snapshot/{source}"].post.security,
    ).toBeDefined();
  });

  it("supports HEAD without a body and rejects writes to documentation routes", async () => {
    for (const path of ["/docs", "/openapi.json"]) {
      const head = await fetch(path, "HEAD");
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
      expect((await fetch(path, "POST")).status).toBe(405);
    }
  });
});
