import {
  cutoff,
  Env,
  errorResponse,
  HttpError,
  LABEL,
  response,
} from "./types";
import { normalizeIP } from "./validation";
import { docsPage, openapiDocument } from "./docs";
import { siteResponse, siteVersion } from "./site";
const JOIN =
  "FROM ip_observations o JOIN jail_state s ON s.source=o.source AND s.jail=o.jail";
const FIELDS =
  "o.source,o.jail,o.ip,o.first_seen,CASE WHEN o.active=1 THEN s.collected_at ELSE o.last_seen END AS last_seen,o.active,o.country,o.asn,o.organization,o.network,(s.collected_at < ?) AS stale";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "ETag, X-Next-Cursor, X-Truncated",
  "X-Content-Type-Options": "nosniff",
};
function pageLimit(url: URL, max = 500, fallback = 100): number {
  const n = Number(url.searchParams.get("limit") ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw new HttpError(400, `limit must be between 1 and ${max}`);
  return n;
}
function encodeCursor(data: string[]): string {
  return btoa(JSON.stringify(data))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
function decodeCursor(value: string, size: number): string[] {
  try {
    if (value.length > 512) throw 0;
    const parts: unknown = JSON.parse(
      atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (
      !Array.isArray(parts) ||
      parts.length !== size ||
      !parts.every((v) => typeof v === "string" && v.length <= 64)
    )
      throw 0;
    normalizeIP(parts[0]);
    if (parts.slice(1).some((v) => !LABEL.test(v))) throw 0;
    return parts;
  } catch {
    throw new HttpError(400, "Invalid cursor");
  }
}
async function route(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === "/docs" || url.pathname === "/docs/") return docsPage();
  if (url.pathname === "/openapi.json") return openapiDocument();
  const fresh = cutoff(env);
  if (url.pathname === "/health")
    return response({
      service: "f2b-api",
      version: 1,
      status: "ok",
      classification: "Fail2ban observations; not proof of malicious activity",
      html_reports: "https://soulminingrig.com/f2b-report/",
    });
  if (url.pathname === "/v1/lookup") {
    const ip = normalizeIP(url.searchParams.get("ip"));
    const result = await env.DB.prepare(
      `SELECT ${FIELDS} ${JOIN} WHERE o.ip=? ORDER BY o.source,o.jail LIMIT 1001`,
    )
      .bind(fresh, ip)
      .all();
    return response({
      ip,
      observations: result.results.slice(0, 1000),
      truncated: result.results.length > 1000,
    });
  }
  if (url.pathname === "/v1/sources") {
    const data = await env.DB.prepare(
      "SELECT source,jail,collected_at,currently_banned,total_banned,public_ip_count,(collected_at < ?) AS stale FROM jail_state ORDER BY source,jail LIMIT 1000",
    )
      .bind(fresh)
      .all();
    return response({ sources: data.results });
  }
  if (url.pathname === "/v1/ips") {
    const where: string[] = [];
    const args: (string | number)[] = [fresh];
    const active = url.searchParams.get("active") ?? "true";
    if (!["true", "false", "all"].includes(active))
      throw new HttpError(400, "Invalid active filter");
    if (active !== "all") {
      where.push("o.active=?");
      args.push(active === "true" ? 1 : 0);
    }
    if (active === "true") {
      where.push("s.collected_at>=?");
      args.push(fresh);
    }
    for (const key of ["source", "jail", "country"]) {
      const value = url.searchParams.get(key);
      if (value !== null) {
        if (!(key === "country" ? /^[A-Z]{2}$/.test(value) : LABEL.test(value)))
          throw new HttpError(400, "Invalid filter");
        where.push(`o.${key}=?`);
        args.push(value);
      }
    }
    const asn = url.searchParams.get("asn");
    if (asn !== null) {
      if (!/^\d+$/.test(asn) || Number(asn) < 1 || Number(asn) > 4294967295)
        throw new HttpError(400, "Invalid ASN");
      where.push("o.asn=?");
      args.push(Number(asn));
    }
    const cursor = url.searchParams.get("cursor");
    if (cursor) {
      where.push("(o.ip,o.source,o.jail)>(?,?,?)");
      args.push(...decodeCursor(cursor, 3));
    }
    const limit = pageLimit(url);
    args.push(limit + 1);
    const data = await env.DB.prepare(
      `SELECT ${FIELDS} ${JOIN} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.ip,o.source,o.jail LIMIT ?`,
    )
      .bind(...args)
      .all<{ ip: string; source: string; jail: string }>();
    const rows = data.results.slice(0, limit);
    const last = rows.at(-1);
    return response({
      observations: rows,
      next_cursor:
        data.results.length > limit && last
          ? encodeCursor([last.ip, last.source, last.jail])
          : null,
    });
  }
  if (url.pathname === "/v1/feed.txt") {
    const limit = pageLimit(url, 5000, 1000);
    const cursor = url.searchParams.get("cursor");
    const after = cursor ? decodeCursor(cursor, 1)[0] : "";
    const data = await env.DB.prepare(
      `SELECT DISTINCT o.ip ${JOIN} WHERE o.active=1 AND s.collected_at>=? AND o.ip>? ORDER BY o.ip LIMIT ?`,
    )
      .bind(fresh, after, limit + 1)
      .all<{ ip: string }>();
    const rows = data.results.slice(0, limit);
    const truncated = data.results.length > limit;
    return new Response(
      rows.map((r) => r.ip).join("\n") + (rows.length ? "\n" : ""),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Truncated": String(truncated),
          ...(truncated
            ? { "X-Next-Cursor": encodeCursor([rows.at(-1)!.ip]) }
            : {}),
        },
      },
    );
  }
  if (url.pathname === "/v1/stats") {
    const active = `${JOIN} WHERE o.active=1 AND s.collected_at>=?`;
    const statements = [
      env.DB.prepare(
        `SELECT COUNT(*) AS observations,COUNT(DISTINCT o.ip) AS ips ${active}`,
      ).bind(fresh),
    ];
    for (const group of ["country", "asn", "jail", "source"]) {
      statements.push(
        env.DB.prepare(
          `SELECT o.${group} AS value,COUNT(*) AS observations,COUNT(DISTINCT o.ip) AS ips ${active} GROUP BY o.${group} ORDER BY observations DESC LIMIT 100`,
        ).bind(fresh),
      );
    }
    const data = await env.DB.batch(statements);
    return response({
      active: data[0].results[0],
      countries: data[1].results,
      asns: data[2].results,
      jails: data[3].results,
      sources: data[4].results,
    });
  }
  const page = siteResponse(request);
  if (page) return page;
  throw new HttpError(404, "Not found");
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: cors });
      if (!["GET", "HEAD"].includes(request.method))
        throw new HttpError(405, "Method not allowed");
      if (
        env.READ_LIMITER &&
        !(
          await env.READ_LIMITER.limit({
            key: request.headers.get("CF-Connecting-IP") ?? "unknown",
          })
        ).success
      ) {
        const limited = response({ error: "Rate limit exceeded" }, 429);
        limited.headers.set("Retry-After", "60");
        for (const [key, value] of Object.entries(cors))
          limited.headers.set(key, value);
        return limited;
      }
      const url = new URL(request.url);
      url.searchParams.sort();
      const cacheURL = new URL(url);
      cacheURL.searchParams.set("__f2b_release", siteVersion);
      const cacheKey = new Request(cacheURL.toString());
      const cache = typeof caches !== "undefined" ? caches.default : undefined;
      let result = cache ? await cache.match(cacheKey) : undefined;
      if (!result) {
        result = await route(request, url, env);
        if (result.ok) {
          if (
            !result.headers.has("Cache-Control") ||
            result.headers.get("Cache-Control") === "no-store"
          )
            result.headers.set(
              "Cache-Control",
              `public, max-age=${url.pathname === "/v1/stats" ? 900 : url.pathname === "/v1/feed.txt" ? 300 : 60}`,
            );
          if (cache) ctx.waitUntil(cache.put(cacheKey, result.clone()));
        }
      }
      const headers = new Headers(result.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(request.method === "HEAD" ? null : result.body, {
        status: result.status,
        headers,
      });
    } catch (error) {
      const result = errorResponse(error);
      for (const [k, v] of Object.entries(cors)) result.headers.set(k, v);
      return result;
    }
  },
};
