import generated from "../site/generated/assets.json";
export { default as siteVersion } from "../site/generated/version";

interface Asset {
  body: string;
  type: string;
  binary: boolean;
  etag: string;
}
const assets = new Map<string, Asset>(Object.entries(generated));

export type Language = "ja" | "en" | "ru" | "zh-cn" | "zh-tw";

export const LANGUAGES: Language[] = ["ja", "en", "ru", "zh-cn", "zh-tw"];

const COUNTRY_LANGUAGES: Record<string, Language> = {
  JP: "ja",
  RU: "ru",
  CN: "zh-cn",
  TW: "zh-tw",
  HK: "zh-tw",
  MO: "zh-tw",
};

function languageTag(tag: string): Language | undefined {
  const value = tag.trim().toLowerCase();
  if (value === "ja" || value.startsWith("ja-")) return "ja";
  if (value === "en" || value.startsWith("en-")) return "en";
  if (value === "ru" || value.startsWith("ru-")) return "ru";
  if (
    value === "zh-tw" ||
    value === "zh-hk" ||
    value === "zh-mo" ||
    value === "zh-hant" ||
    value.startsWith("zh-hant-")
  )
    return "zh-tw";
  if (
    value === "zh" ||
    value === "zh-cn" ||
    value === "zh-sg" ||
    value === "zh-hans" ||
    value.startsWith("zh-hans-")
  )
    return "zh-cn";
  return undefined;
}

export function preferredLanguage(request: Request): Language {
  const cookie = request.headers.get("Cookie") ?? "";
  const saved = /(?:^|;\s*)lang=(ja|en|ru|zh-cn|zh-tw)(?:;|$)/.exec(cookie);
  if (saved) return saved[1] as Language;
  const accept = request.headers.get("Accept-Language") ?? "";
  for (const entry of accept.split(",")) {
    const language = languageTag(entry.split(";")[0]);
    if (language) return language;
  }
  const country = (request as Request & { cf?: { country?: string } }).cf
    ?.country;
  return (country && COUNTRY_LANGUAGES[country]) || "en";
}

function redirect(url: URL, pathname: string): Response {
  const target = new URL(url);
  target.pathname = pathname;
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "private, no-store",
      Vary: "Accept-Language, Cookie",
    },
  });
}

export function siteResponse(request: Request): Response | undefined {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/") return redirect(url, `/${preferredLanguage(request)}/`);
  if (/^\/(policies|api|data|about)(\/|$)/.test(path)) {
    const suffix = path.endsWith("/") ? "" : "/";
    return redirect(url, `/${preferredLanguage(request)}${path}${suffix}`);
  }
  let asset = assets.get(path.endsWith("/") ? path + "index.html" : path);
  if (!asset && !path.endsWith("/") && assets.has(path + "/index.html")) {
    const canonical = new URL(url);
    canonical.pathname += "/";
    return new Response(null, {
      status: 308,
      headers: {
        Location: canonical.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  const status = asset ? 200 : 404;
  if (!asset) {
    if (path.startsWith("/v1/") || path === "/v1") return undefined;
    const language =
      LANGUAGES.find((code) => path.startsWith(`/${code}/`)) ??
      preferredLanguage(request);
    asset = assets.get(`/${language}/404.html`) ?? assets.get("/404.html");
  }
  if (!asset) return undefined;
  const body = asset.binary
    ? Uint8Array.from(atob(asset.body), (character) => character.charCodeAt(0))
    : asset.body;
  const fingerprinted = /\.[a-f0-9]{64}\./.test(path);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": asset.type,
      "Cache-Control":
        status === 404
          ? "no-store"
          : fingerprinted
            ? "public, max-age=31536000, immutable"
            : "public, max-age=300",
      ETag: asset.etag,
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    },
  });
}
