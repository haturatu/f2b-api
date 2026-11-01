---
title: "About this service"
weight: 4
description: "How collection, storage, and publication work, plus source code and licenses."
---

This page describes how data is collected, stored, and published, and lists the source code and licenses.

## Architecture

```text
Fail2ban (FreeBSD / PF, Linux / nftables)
  → f2b-report: HTML + JSON
  → submission queue: HTTPS, retries, heartbeat when nothing changed
  → f2b-ingest Worker: input validation, normalization, diff application
  → Cloudflare D1: per-jail collection state and IP observation history
  → f2b-api Worker: public GET API and this static site
```

The collection Worker and the public Worker are separate and share the same D1 database. The public API cannot submit data or operate any server's firewall.

This site is available in Japanese and English. Requests to the root are directed to `/ja/` or `/en/` based on the saved preference, the browser language, and the connection country. Choosing a language from the navigation bar stores the preference in a cookie.

We continue to generate the existing HTML reports. This site explains the API and the public policies, and links to the reports themselves.

## Source code

- [f2b-api](https://github.com/haturatu/f2b-api): API, OpenAPI specification, and this Hugo site.
- [f2b-report](https://github.com/haturatu/f2b-report): Fail2ban state parsing and HTML/JSON output.

Hugo content and theme configuration live in `f2b-api/site/`. The site build and the Worker's delivery logic are managed in the same repository.

## License

The f2b-api source code and original documentation are distributed under the [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE). Copyright (c) 2026, haturatu

In-site search uses FlexSearch, distributed under the [Apache License 2.0](/licenses/flexsearch.txt). The license and copyright notice are kept in the delivered assets.
