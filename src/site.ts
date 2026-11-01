import generated from "../site/generated/assets.json";
export { default as siteVersion } from "../site/generated/version";

interface Asset {
  body: string;
  type: string;
  binary: boolean;
  etag: string;
}
const assets = new Map<string, Asset>(Object.entries(generated));

export function siteResponse(url: URL): Response | undefined {
  const path = url.pathname;
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
    asset = assets.get("/404.html");
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
