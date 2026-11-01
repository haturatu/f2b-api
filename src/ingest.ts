import {
  AccessContext,
  Env,
  errorResponse,
  HttpError,
  response,
  Snapshot,
} from "./types";
import { readSnapshot, snapshotHash } from "./validation";
interface State {
  snapshot_hash: string;
  collected_at: number;
  write_token: string;
  public_ip_count: number;
}

export async function ingestSnapshot(
  body: Snapshot,
  env: Env,
): Promise<Response> {
  const { source, jail } = body;
  const observed = Math.floor(Date.parse(body.observed_at) / 1000);
  const previous = await env.DB.prepare(
    "SELECT snapshot_hash,collected_at,write_token,public_ip_count FROM jail_state WHERE source=? AND jail=?",
  )
    .bind(source, jail)
    .first<State>();
  const hash =
    body.mode === "heartbeat"
      ? body.snapshot_hash!
      : await snapshotHash(body.ips!);
  if (
    body.mode === "heartbeat" &&
    (!previous || previous.snapshot_hash !== hash)
  )
    throw new HttpError(409, "Full snapshot required");
  if (
    previous &&
    (observed < previous.collected_at ||
      (observed === previous.collected_at && hash !== previous.snapshot_hash))
  )
    throw new HttpError(409, "Stale or conflicting snapshot");
  if (
    previous &&
    observed === previous.collected_at &&
    hash === previous.snapshot_hash
  )
    return response({ status: "unchanged", snapshot_hash: hash });
  const token = crypto.randomUUID();
  const count = body.ips?.length ?? previous!.public_ip_count;
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO jail_state(source,jail,snapshot_hash,collected_at,currently_banned,total_banned,public_ip_count,write_token)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source,jail) DO UPDATE SET snapshot_hash=excluded.snapshot_hash,collected_at=excluded.collected_at,
    currently_banned=excluded.currently_banned,total_banned=excluded.total_banned,public_ip_count=excluded.public_ip_count,write_token=excluded.write_token
    WHERE jail_state.collected_at=? AND jail_state.snapshot_hash=? AND excluded.collected_at>jail_state.collected_at`,
    ).bind(
      source,
      jail,
      hash,
      observed,
      body.currently_banned,
      body.total_banned,
      count,
      token,
      previous?.collected_at ?? -1,
      previous?.snapshot_hash ?? "",
    ),
  ];
  if (!previous || hash !== previous.snapshot_hash) {
    const json = JSON.stringify(body.ips);
    statements.push(
      env.DB.prepare(
        `UPDATE ip_observations SET active=0,last_seen=? WHERE source=? AND jail=? AND active=1
      AND EXISTS(SELECT 1 FROM jail_state WHERE source=? AND jail=? AND write_token=?)
      AND ip NOT IN(SELECT json_extract(value,'$.ip') FROM json_each(?))`,
      ).bind(
        previous?.collected_at ?? observed,
        source,
        jail,
        source,
        jail,
        token,
        json,
      ),
    );
    statements.push(
      env.DB.prepare(
        `INSERT INTO ip_observations(source,jail,ip,first_seen,last_seen,active,country,asn,organization,network)
      SELECT ?,?,json_extract(value,'$.ip'),?,?,1,json_extract(value,'$.country'),json_extract(value,'$.asn'),json_extract(value,'$.organization'),json_extract(value,'$.network')
      FROM json_each(?) WHERE EXISTS(SELECT 1 FROM jail_state WHERE source=? AND jail=? AND write_token=?)
      ON CONFLICT(source,jail,ip) DO UPDATE SET active=1,last_seen=excluded.last_seen,country=excluded.country,asn=excluded.asn,organization=excluded.organization,network=excluded.network
      WHERE ip_observations.active=0 OR ip_observations.country IS NOT excluded.country OR ip_observations.asn IS NOT excluded.asn OR ip_observations.organization IS NOT excluded.organization OR ip_observations.network IS NOT excluded.network`,
      ).bind(source, jail, observed, observed, json, source, jail, token),
    );
  }
  const results = await env.DB.batch(statements);
  if (!results[0].meta.changes)
    throw new HttpError(409, "Concurrent snapshot; retry");
  return response({
    status: hash === previous?.snapshot_hash ? "heartbeat" : "updated",
    snapshot_hash: hash,
    public_ip_count: count,
    changed_rows: results.slice(1).reduce((n, r) => n + r.meta.changes, 0),
  });
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: AccessContext,
  ): Promise<Response> {
    try {
      if (new URL(request.url).pathname !== "/v1/ingest/snapshot")
        throw new HttpError(404, "Not found");
      if (request.method !== "POST")
        throw new HttpError(405, "Method not allowed");
      if (!ctx.access)
        throw new HttpError(
          403,
          "Cloudflare Access service authentication required",
        );
      const identity = await ctx.access.getIdentity();
      if (!identity?.service_token_status || !identity.service_token_id)
        throw new HttpError(403, "Service token required");
      const tokens =
        typeof env.SOURCE_TOKENS === "string"
          ? (JSON.parse(env.SOURCE_TOKENS) as Record<
              string,
              { source: string; jails: string[] }
            >)
          : (env.SOURCE_TOKENS ?? {});
      const scope = tokens[identity.service_token_id];
      if (!scope) throw new HttpError(403, "Unknown collection source");
      const body = await readSnapshot(request);
      if (body.source !== scope.source || !scope.jails.includes(body.jail))
        throw new HttpError(403, "Source or jail outside service-token scope");
      return await ingestSnapshot(body, env);
    } catch (error) {
      return errorResponse(error);
    }
  },
};
