import openapi from "../openapi.json";

const specification = JSON.stringify(openapi);
const cdn = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.3";

export function openapiDocument(): Response {
  return new Response(specification, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export function docsPage(): Response {
  const nonce = crypto.randomUUID();
  return new Response(
    `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <meta name="color-scheme" content="light">
  <title>f2b-api — APIドキュメント</title>
  <link rel="stylesheet" href="${cdn}/swagger-ui.css" integrity="sha384-Ov4/wv3j2bmct8cDc5X4ngJZohVPzEmc6uDPH8WeljUxO5vtoykvMEfbu9Vh6RaW" crossorigin="anonymous">
  <style nonce="${nonce}">
    body { margin: 0; background: #fafafa; color: #222; font-family: system-ui, sans-serif; }
    header { border-bottom: 1px solid #ddd; background: white; }
    nav { max-width: 1460px; margin: auto; padding: 8px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 20px; }
    nav a { min-height: 44px; display: inline-flex; align-items: center; color: #174ea6; }
    a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #174ea6; outline-offset: 3px; }
    .skip { position: absolute; left: 12px; top: -100px; background: white; padding: 12px; z-index: 10; }
    .skip:focus { top: 12px; }
    .status { padding: 24px; }
    .swagger-ui input, .swagger-ui select, .swagger-ui textarea { font-size: 16px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; } }
  </style>
</head>
<body>
  <a class="skip" href="#swagger-ui">APIドキュメントへ移動</a>
  <header>
    <nav aria-label="関連リンク">
      <strong>f2b-api</strong>
      <a href="/openapi.json">OpenAPI JSON</a>
      <a href="https://github.com/haturatu/f2b-api">GitHub</a>
      <a href="https://soulminingrig.com/f2b-report/">HTMLレポート</a>
    </nav>
  </header>
  <main id="swagger-ui" tabindex="-1" aria-label="公開APIドキュメント" aria-busy="true">
    <p class="status" role="status">ドキュメントを読み込んでいます…</p>
  </main>
  <noscript><p class="status">画面の表示にはJavaScriptが必要です。<a href="/openapi.json">OpenAPI JSON</a>も利用できます。</p></noscript>
  <script src="${cdn}/swagger-ui-bundle.js" integrity="sha384-h00llMzD1afyNow1pDmnZKlHsUZgp9KE9HXLFXF2CvbwsBY0+WBO4f75SfGwvM4K" crossorigin="anonymous"></script>
  <script nonce="${nonce}">
    const root = document.getElementById("swagger-ui");
    if (typeof SwaggerUIBundle === "function") {
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        supportedSubmitMethods: ["get"],
        persistAuthorization: false,
        withCredentials: false,
        queryConfigEnabled: false,
        validatorUrl: null,
        onComplete: () => root.setAttribute("aria-busy", "false")
      });
    } else {
      root.setAttribute("aria-busy", "false");
      root.querySelector("[role=status]").textContent = "画面を読み込めませんでした。上のOpenAPI JSONリンクをご利用ください。";
    }
  </script>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "DENY",
      },
    },
  );
}
