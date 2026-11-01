---
title: "Fail2ban observations, made searchable."
description: "Public ban observations recorded by multiple collection sources, together with the detection policies behind them."
toc: false
---

**f2b-api** is a public API for searching IP addresses recorded by Fail2ban across multiple servers.

I had already been publishing Fail2ban statistics as HTML reports, but those are not especially convenient when you want to look up one IP or compare detections across jails. So I added IPv4/IPv6 lookup, filtering, country and ASN statistics, and a deduplicated text feed.

There is one important distinction: **an IP in this database is not necessarily an attacker**. It only means that one of the collection sources recorded a match against its configured Fail2ban rules. Shared IPv4 addresses behind CGNAT, dynamic reassignment, and false positives all matter. An observation alone cannot establish who was behind a request or whether it was malicious.

{{< cards >}}
  {{< card link="policies/" title="Blocking policies" icon="shield-check" subtitle="Authentication failures, repeated detections, and the conditions that permanently ban on a single match." >}}
  {{< card link="api/" title="Using the API" icon="code" subtitle="IP lookup, pagination, statistics, and the text feed." >}}
  {{< card link="data/" title="Reading the data" icon="database" subtitle="Observation times, current bans, and released or stale entries." >}}
{{< /cards >}}

## Quick start

You can run GET requests in the [interactive API reference](https://api.f2b.0xhw.com/docs), or just use curl:

```sh
curl 'https://api.f2b.0xhw.com/v1/stats' | jq
curl 'https://api.f2b.0xhw.com/v1/ips?limit=10' | jq
```

- [API reference and in-browser calls](https://api.f2b.0xhw.com/docs)
- [OpenAPI 3.1 specification](https://api.f2b.0xhw.com/openapi.json)
- [Current statistics](https://api.f2b.0xhw.com/v1/stats)
- [Currently active IPs](https://api.f2b.0xhw.com/v1/ips)
- [Existing HTML reports](https://soulminingrig.com/f2b-report/)

## What is published

We publish source labels, jail names, IPs, first and last observation times, current ban state, and network metadata such as country, ASN, and organization. Raw access logs, account names, credentials, and administrative exclusion lists are **not** published.

The public read API needs no authentication, but it cannot submit observations or control the servers' firewalls. See [About this service]({{< relref "/about/_index.md" >}}) for the data flow and [Reading the data]({{< relref "/data/_index.md" >}}) for what the fields actually mean.
