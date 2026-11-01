---
title: "About this service"
weight: 4
description: "How collection, storage, and publication work, plus source code and licenses."
---

I was already generating HTML reports from Fail2ban, but they were awkward for questions such as “Which jail recorded this IP?” or “Is it still banned?”

The API reuses that collection process, with a separate ingestion path and a public, read-only interface. The original HTML reports are still generated.

## Architecture

The flow from the firewall to the published result looks like this:

```text
Fail2ban (FreeBSD / PF, Linux / nftables)
  → f2b-report: HTML + JSON
  → submission queue: HTTPS, retries, heartbeat when nothing changed
  → f2b-ingest Worker: input validation, normalization, diff application
  → Cloudflare D1: per-jail collection state and IP observation history
  → f2b-api Worker: public GET API and this static site
```

The `f2b-ingest` Worker handles incoming snapshots, while `f2b-api` serves queries and the Hugo site. They share D1, but the public API cannot submit data or operate PF or nftables on any server. Each server's own Fail2ban decides what to block.

This site focuses on **why an IP was recorded**, alongside the API and the existing HTML reports.

## Languages

This site is available in Japanese, English, Russian, Simplified Chinese, and Traditional Chinese. Requests to the root are directed to `/ja/`, `/en/`, `/ru/`, `/zh-cn/`, or `/zh-tw/` based on the saved preference, the browser language, and the connection country. Choosing a language from the navigation bar stores the preference in a cookie.

We continue to generate the existing HTML reports. This site explains the API and the public policies, and links to the reports themselves.

## Source code

- [f2b-api](https://github.com/haturatu/f2b-api): API, OpenAPI specification, and this Hugo site.
- [f2b-report](https://github.com/haturatu/f2b-report): Fail2ban state parsing and HTML/JSON output.

Hugo content and theme configuration live in `f2b-api/site/`. The site build and the Worker's delivery logic are managed in the same repository.

## License

The f2b-api source code and original documentation are distributed under the [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE). Copyright (c) 2026, haturatu

In-site search uses FlexSearch, distributed under the [Apache License 2.0](/licenses/flexsearch.txt). The license and copyright notice are kept in the delivered assets.
