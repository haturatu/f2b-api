---
title: "Fail2ban observations, made searchable."
description: "Public ban observations recorded by multiple collection sources, together with the detection policies behind them."
toc: false
---

**f2b-api** is a public API that aggregates IP addresses recorded by Fail2ban. It provides IPv4 and IPv6 lookup, per-jail observations, country and ASN statistics, and a deduplicated IP feed.

An IP record means that the address matched a blocking rule on one of the collection sources. **It does not prove malicious activity or compromise.** Take shared IPs, dynamic assignment, and configuration-dependent false positives into account when using the data.

{{< cards >}}
  {{< card link="policies/" title="Blocking policies" icon="shield-check" subtitle="Authentication failures, repeated detections, and the conditions that permanently ban on a single match." >}}
  {{< card link="api/" title="Using the API" icon="code" subtitle="IP lookup, pagination, statistics, and the text feed." >}}
  {{< card link="data/" title="Reading the data" icon="database" subtitle="Observation times, current bans, and released or stale entries." >}}
{{< /cards >}}

## Quick start

- [API reference and in-browser calls](/docs)
- [OpenAPI 3.1 specification](/openapi.json)
- [Current statistics](/v1/stats)
- [Currently active IPs](/v1/ips)
- [Existing HTML reports](https://soulminingrig.com/f2b-report/)

```sh
curl 'https://f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

This is a lookup example. It does not mean that the example IP has been observed.

## What is published

We publish the public label of each collection source, jail names, observed IP addresses, first and last confirmation times, and enrichment such as country, ASN, and organization. This site explains the policies behind those observations and the limitations of the judgment.

The public read API requires no authentication. See [About this service]({{< relref "/about/_index.md" >}}) for the overall architecture.
