import ipaddr from "ipaddr.js";
import {
  HttpError,
  IPRecord,
  LABEL,
  MAX_BODY_BYTES,
  MAX_IPS,
  Snapshot,
} from "./types";

export function normalizeIP(input: unknown): string {
  if (
    typeof input !== "string" ||
    input.length > 45 ||
    input.includes("%") ||
    !ipaddr.isValid(input)
  )
    throw new HttpError(400, "Invalid IP address");
  if (
    !input.includes(":") &&
    !/^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/.test(input)
  )
    throw new HttpError(400, "Ambiguous IPv4 spelling");
  let ip = ipaddr.parse(input);
  if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
    ip = (ip as ipaddr.IPv6).toIPv4Address();
  if (ip.range() !== "unicast")
    throw new HttpError(
      400,
      "Only public globally routable IP addresses are accepted",
    );
  return ip.toString();
}
function text(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    throw new HttpError(400, "Invalid metadata");
  return value.trim() || null;
}
export function normalizeRecords(input: unknown): IPRecord[] {
  if (!Array.isArray(input) || input.length > MAX_IPS)
    throw new HttpError(400, "Invalid IP array or too many records");
  const found = new Map<string, IPRecord>();
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new HttpError(400, "Invalid IP record");
    const record = value as Record<string, unknown>;
    const ip = normalizeIP(record.ip);
    const country = text(record.country, 2)?.toUpperCase() ?? null;
    if (country !== null && !/^[A-Z]{2}$/.test(country))
      throw new HttpError(400, "Invalid country code");
    const asn = record.asn ?? null;
    if (
      asn !== null &&
      (typeof asn !== "number" ||
        !Number.isSafeInteger(asn) ||
        asn < 1 ||
        asn > 4294967295)
    )
      throw new HttpError(400, "Invalid ASN");
    const row: IPRecord = {
      ip,
      country,
      asn: asn as number | null,
      organization: text(record.organization, 512),
      network: text(record.network, 512),
    };
    const previous = found.get(ip);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row))
      throw new HttpError(400, "Conflicting duplicate IP metadata");
    found.set(ip, row);
  }
  return [...found.values()].sort((a, b) =>
    a.ip < b.ip ? -1 : a.ip > b.ip ? 1 : 0,
  );
}
export async function readSnapshot(request: Request): Promise<Snapshot> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "Content-Type must be application/json");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new HttpError(413, "Request too large");
  if (!request.body) throw new HttpError(400, "Missing JSON body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.length;
  }
  let body: Snapshot;
  try {
    body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(raw),
    );
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  if (
    !body ||
    body.schema_version !== 1 ||
    !LABEL.test(body.source ?? "") ||
    !LABEL.test(body.jail ?? "")
  )
    throw new HttpError(400, "Invalid schema, source or jail");
  if (
    typeof body.observed_at !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(body.observed_at)
  )
    throw new HttpError(400, "observed_at must be an ISO UTC timestamp");
  const time = Date.parse(body.observed_at);
  if (
    !Number.isFinite(time) ||
    time > Date.now() + 300000 ||
    time < Date.now() - 7 * 86400000
  )
    throw new HttpError(400, "Observation timestamp outside accepted window");
  if (
    ![body.currently_banned, body.total_banned].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 2147483647,
    )
  )
    throw new HttpError(400, "Invalid counters");
  if (body.mode === "heartbeat") {
    if (
      typeof body.snapshot_hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.snapshot_hash) ||
      body.ips !== undefined
    )
      throw new HttpError(400, "Invalid heartbeat");
  } else {
    if (body.mode !== undefined && body.mode !== "snapshot")
      throw new HttpError(400, "Invalid snapshot mode");
    body.ips = normalizeRecords(body.ips);
    if (body.currently_banned < body.ips.length)
      throw new HttpError(400, "IP count exceeds current bans");
  }
  return body;
}
export async function snapshotHash(ips: IPRecord[]): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(ips)),
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
