import { HttpError, LABEL } from "./types";
import { normalizeIP } from "./validation";

export const LAST_SEEN =
  "CASE WHEN o.active=1 THEN s.collected_at ELSE o.last_seen END";

export const SORT_EXPRESSIONS = {
  ip: "o.ip",
  source: "o.source",
  jail: "o.jail",
  country: "COALESCE(o.country,'')",
  asn: "COALESCE(o.asn,0)",
  organization: "COALESCE(o.organization,'')",
  active: "o.active",
  first_seen: "o.first_seen",
  last_seen: LAST_SEEN,
} as const;

export type SortKey = keyof typeof SORT_EXPRESSIONS;
const SORT_KEYS = Object.keys(SORT_EXPRESSIONS) as SortKey[];
const NUMERIC_SORTS = new Set<SortKey>([
  "asn",
  "active",
  "first_seen",
  "last_seen",
]);

export type Order = "asc" | "desc";

export interface Filters {
  where: string[];
  args: (string | number)[];
  canonical: string;
}

function integer(
  url: URL,
  name: string,
  max = 100000000000,
): number | undefined {
  const value = url.searchParams.get(name);
  if (value === null) return undefined;
  if (!/^\d{1,12}$/.test(value)) throw new HttpError(400, `Invalid ${name}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max)
    throw new HttpError(400, `Invalid ${name}`);
  return number;
}

function escapeLike(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

export function buildFilters(url: URL, fresh: number): Filters {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const canonical: string[] = [];

  const active = url.searchParams.get("active") ?? "true";
  if (!["true", "false", "all"].includes(active))
    throw new HttpError(400, "Invalid active filter");
  canonical.push(`active=${active}`);
  if (active !== "all") {
    where.push("o.active=?");
    args.push(active === "true" ? 1 : 0);
  }
  if (active === "true") {
    where.push("s.collected_at>=?");
    args.push(fresh);
  }

  const stale = url.searchParams.get("stale");
  if (stale !== null) {
    if (!["true", "false"].includes(stale))
      throw new HttpError(400, "Invalid stale filter");
    where.push(`s.collected_at${stale === "true" ? "<" : ">="}?`);
    args.push(fresh);
  }
  canonical.push(`stale=${stale ?? "any"}`);

  for (const key of ["source", "jail", "country"] as const) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      if (!(key === "country" ? /^[A-Z]{2}$/.test(value) : LABEL.test(value)))
        throw new HttpError(400, "Invalid filter");
      where.push(`o.${key}=?`);
      args.push(value);
      canonical.push(`${key}=${value}`);
    }
  }

  const asn = url.searchParams.get("asn");
  if (asn !== null) {
    if (!/^\d+$/.test(asn) || Number(asn) < 1 || Number(asn) > 4294967295)
      throw new HttpError(400, "Invalid ASN");
    where.push("o.asn=?");
    args.push(Number(asn));
    canonical.push(`asn=${Number(asn)}`);
  }

  const prefix = url.searchParams.get("ip_prefix");
  if (prefix !== null) {
    if (!/^[0-9a-fA-F:.]{1,40}$/.test(prefix))
      throw new HttpError(400, "Invalid IP prefix");
    const value = prefix.toLowerCase();
    where.push("o.ip LIKE ? ESCAPE '\\'");
    args.push(escapeLike(value) + "%");
    canonical.push(`ip_prefix=${value}`);
  }

  const organization = url.searchParams.get("organization");
  if (organization !== null) {
    if (
      !/^[^\u0000-\u001f\u007f]{1,128}$/.test(organization) ||
      organization.trim() === ""
    )
      throw new HttpError(400, "Invalid organization filter");
    where.push("o.organization LIKE ? ESCAPE '\\'");
    args.push("%" + escapeLike(organization) + "%");
    canonical.push(`organization=${organization}`);
  }

  const ranges: [string, string, number | undefined][] = [
    ["first_seen_from", "o.first_seen", integer(url, "first_seen_from")],
    ["first_seen_to", "o.first_seen", integer(url, "first_seen_to")],
    ["last_seen_from", "last_seen", integer(url, "last_seen_from")],
    ["last_seen_to", "last_seen", integer(url, "last_seen_to")],
  ];
  for (const [name, column, value] of ranges) {
    if (value === undefined) continue;
    const expression = column === "last_seen" ? LAST_SEEN : column;
    where.push(`${expression}${name.endsWith("_from") ? ">=" : "<="}?`);
    args.push(value);
    canonical.push(`${name}=${value}`);
  }
  const firstFrom = url.searchParams.get("first_seen_from");
  const firstTo = url.searchParams.get("first_seen_to");
  if (
    firstFrom !== null &&
    firstTo !== null &&
    Number(firstFrom) > Number(firstTo)
  )
    throw new HttpError(400, "Invalid first_seen range");
  const lastFrom = url.searchParams.get("last_seen_from");
  const lastTo = url.searchParams.get("last_seen_to");
  if (lastFrom !== null && lastTo !== null && Number(lastFrom) > Number(lastTo))
    throw new HttpError(400, "Invalid last_seen range");

  return { where, args, canonical: canonical.join("&") };
}

export function parseSort(url: URL): { sort: SortKey; order: Order } {
  const sort = (url.searchParams.get("sort") ?? "ip") as SortKey;
  if (!SORT_KEYS.includes(sort)) throw new HttpError(400, "Invalid sort");
  const order = (url.searchParams.get("order") ?? "asc") as Order;
  if (order !== "asc" && order !== "desc")
    throw new HttpError(400, "Invalid order");
  return { sort, order };
}

export function queryHash(
  canonical: string,
  sort: SortKey,
  order: Order,
): string {
  const input = `${canonical}&sort=${sort}&order=${order}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface Cursor {
  q: string;
  v: string | number;
  k: [string, string, string];
}

function base64url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64url(value: string): string {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function decode(value: string): unknown {
  try {
    if (value.length > 2048) throw 0;
    return JSON.parse(fromBase64url(value));
  } catch {
    throw new HttpError(400, "Invalid cursor");
  }
}

export function decodeCursor(
  value: string,
  hash: string,
  sort: SortKey,
): Cursor {
  const payload = decode(value);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    throw new HttpError(400, "Invalid cursor");
  const { q, v, k } = payload as Record<string, unknown>;
  if (
    q !== hash ||
    typeof k !== "object" ||
    !Array.isArray(k) ||
    k.length !== 3
  )
    throw new HttpError(400, "Invalid cursor");
  if (
    !k.every((part) => typeof part === "string" && part.length <= 64) ||
    (NUMERIC_SORTS.has(sort) ? typeof v !== "number" : typeof v !== "string")
  )
    throw new HttpError(400, "Invalid cursor");
  if (typeof k[0] !== "string") throw new HttpError(400, "Invalid cursor");
  normalizeIP(k[0]);
  if (typeof k[1] !== "string" || !LABEL.test(k[1]))
    throw new HttpError(400, "Invalid cursor");
  if (typeof k[2] !== "string" || !LABEL.test(k[2]))
    throw new HttpError(400, "Invalid cursor");
  return { q, v: v as string | number, k: k as [string, string, string] };
}

export function encodeCursor(
  hash: string,
  value: string | number,
  key: [string, string, string],
): string {
  return base64url(JSON.stringify({ q: hash, v: value, k: key }));
}

export interface FeedCursor {
  q: string;
  i: string;
}

export function encodeFeedCursor(hash: string, ip: string): string {
  return base64url(JSON.stringify({ q: hash, i: ip }));
}

export function decodeFeedCursor(value: string, hash: string): string {
  const payload = decode(value);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    throw new HttpError(400, "Invalid cursor");
  const { q, i } = payload as Record<string, unknown>;
  if (q !== hash || typeof i !== "string")
    throw new HttpError(400, "Invalid cursor");
  normalizeIP(i);
  return i;
}
