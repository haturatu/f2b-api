import { cutoff, Env, errorResponse, HttpError, response } from "./types";
import { normalizeIP } from "./validation";
import { docsPage, openapiDocument } from "./docs";
import { siteResponse, siteVersion } from "./site";
import {
  buildFilters,
  decodeCursor,
  decodeFeedCursor,
  encodeCursor,
  encodeFeedCursor,
  parseSort,
  queryHash,
  SORT_EXPRESSIONS,
  SortKey,
} from "./query";
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
interface Observation {
  ip: string;
  source: string;
  jail: string;
  first_seen: number;
  last_seen: number;
  active: number;
  country: string | null;
  asn: number | null;
  organization: string | null;
  network: string | null;
  stale: number;
}
function sortValue(row: Observation, sort: SortKey): string | number {
  if (sort === "country") return row.country ?? "";
  if (sort === "asn") return row.asn ?? 0;
  if (sort === "organization") return row.organization ?? "";
  return row[sort as keyof Observation] as string | number;
}
const API_PATH = /^\/(?:v1(?:\/|$)|health$|docs(?:\/|$)|openapi\.json$)/;
function hostRedirect(url: URL, env: Env): Response | undefined {
  if (!env.API_HOST || !env.SITE_HOST) return undefined;
  const apiHost = url.hostname === env.API_HOST;
  const siteHost = url.hostname === env.SITE_HOST;
  if (!apiHost && !siteHost) return undefined;
  const apiPath = API_PATH.test(url.pathname);
  if (apiHost === apiPath) return undefined;
  const target = new URL(url);
  target.protocol = "https:";
  target.host = apiHost ? env.SITE_HOST : env.API_HOST;
  return new Response(null, {
    status: 308,
    headers: {
      Location: target.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
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
    const filters = buildFilters(url, fresh);
    const { sort, order } = parseSort(url);
    const hash = queryHash(filters.canonical, sort, order);
    const expression = SORT_EXPRESSIONS[sort];
    const where = [...filters.where];
    const args = [fresh, ...filters.args];
    const cursor = url.searchParams.get("cursor");
    if (cursor) {
      const decoded = decodeCursor(cursor, hash, sort);
      where.push(
        `(${expression},o.ip,o.source,o.jail)${order === "asc" ? ">" : "<"}(?,?,?,?)`,
      );
      args.push(decoded.v, ...decoded.k);
    }
    const limit = pageLimit(url);
    args.push(limit + 1);
    const direction = order.toUpperCase();
    const data = await env.DB.prepare(
      `SELECT ${FIELDS} ${JOIN} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${expression} ${direction},o.ip ${direction},o.source ${direction},o.jail ${direction} LIMIT ?`,
    )
      .bind(...args)
      .all<Observation>();
    const rows = data.results.slice(0, limit);
    const last = rows.at(-1);
    return response({
      observations: rows,
      next_cursor:
        data.results.length > limit && last
          ? encodeCursor(hash, sortValue(last, sort), [
              last.ip,
              last.source,
              last.jail,
            ])
          : null,
    });
  }
  if (url.pathname === "/v1/feed.txt") {
    const filters = buildFilters(url, fresh);
    const hash = queryHash(filters.canonical, "ip", "asc");
    const where = [...filters.where];
    const args = [...filters.args];
    const cursor = url.searchParams.get("cursor");
    if (cursor) {
      where.push("o.ip>?");
      args.push(decodeFeedCursor(cursor, hash));
    }
    const limit = pageLimit(url, 5000, 1000);
    args.push(limit + 1);
    const data = await env.DB.prepare(
      `SELECT DISTINCT o.ip ${JOIN} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.ip LIMIT ?`,
    )
      .bind(...args)
      .all<{ ip: string }>();
    const rows = data.results.slice(0, limit);
    const truncated = data.results.length > limit;
    return new Response(
      rows.map((r) => r.ip).join("\n") + (rows.length ? "\n" : ""),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Truncated": String(truncated),
          ...(truncated && rows.length
            ? { "X-Next-Cursor": encodeFeedCursor(hash, rows.at(-1)!.ip) }
            : {}),
        },
      },
    );
  }
  if (url.pathname === "/v1/stats") {
    const filters = buildFilters(url, fresh);
    const where = filters.where.length
      ? "WHERE " + filters.where.join(" AND ")
      : "";
    const group = url.searchParams.get("group_by");
    const order = url.searchParams.get("order") ?? "desc";
    if (order !== "asc" && order !== "desc")
      throw new HttpError(400, "Invalid order");
    const sort = url.searchParams.get("sort") ?? "observations";
    if (!["observations", "ips", "value"].includes(sort))
      throw new HttpError(400, "Invalid sort");
    const limit = pageLimit(url, 500, 100);
    const summary = env.DB.prepare(
      `SELECT COUNT(*) AS observations,COUNT(DISTINCT o.ip) AS ips ${JOIN} ${where}`,
    ).bind(...filters.args);
    if (group === null) {
      const statements = [summary];
      for (const key of ["country", "asn", "jail", "source"]) {
        statements.push(
          env.DB.prepare(
            `SELECT o.${key} AS value,COUNT(*) AS observations,COUNT(DISTINCT o.ip) AS ips ${JOIN} ${where} GROUP BY o.${key} ORDER BY observations DESC,value ASC LIMIT 100`,
          ).bind(...filters.args),
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
    if (!["country", "asn", "jail", "source"].includes(group))
      throw new HttpError(400, "Invalid group_by");
    const direction = order.toUpperCase();
    const sortExpression = sort === "value" ? `o.${group}` : sort;
    const groups = env.DB.prepare(
      `SELECT o.${group} AS value,COUNT(*) AS observations,COUNT(DISTINCT o.ip) AS ips ${JOIN} ${where} GROUP BY o.${group} ORDER BY ${sortExpression} ${direction},value ASC LIMIT ?`,
    ).bind(...filters.args, limit);
    const data = await env.DB.batch([summary, groups]);
    return response({
      active: data[0].results[0],
      group_by: group,
      sort,
      order,
      groups: data[1].results,
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
      const url = new URL(request.url);
      const redirect = hostRedirect(url, env);
      if (redirect) return redirect;
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
      if (API_PATH.test(url.pathname)) headers.set("X-Robots-Tag", "noindex");
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
