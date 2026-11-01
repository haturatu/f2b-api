export interface Env {
  DB: D1Database;
  API_HOST?: string;
  SITE_HOST?: string;
  READ_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  SOURCE_SCOPES?: string | Record<string, { source: string; jails: string[] }>;
  STALE_SECONDS?: string;
}
export interface IPRecord {
  ip: string;
  country: string | null;
  asn: number | null;
  organization: string | null;
  network: string | null;
}
export interface Snapshot {
  schema_version: 1;
  source: string;
  jail: string;
  observed_at: string;
  currently_banned: number;
  total_banned: number;
  mode?: "snapshot" | "heartbeat";
  snapshot_hash?: string;
  ips?: IPRecord[];
}
export interface AccessContext {
  access?: { readonly aud: string };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const LABEL = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
export const MAX_IPS = 10000;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export function cutoff(env: Env): number {
  const seconds = Number(env.STALE_SECONDS ?? 172800);
  return (
    Math.floor(Date.now() / 1000) -
    (Number.isSafeInteger(seconds) && seconds >= 3600 ? seconds : 172800)
  );
}
export function response(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError)
    return response({ error: error.message }, error.status);
  console.error(JSON.stringify({ level: "ERROR", message: "request_failed" }));
  return response({ error: "Service temporarily unavailable" }, 503);
}
