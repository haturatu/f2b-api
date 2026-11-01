---
title: "Using the API"
weight: 2
description: "Lookup, filtering, sorting, statistics, and the text feed of the public read API."
---

The base URL is `https://api.f2b.0xhw.com`. The public read API requires no authentication and handles IPv4 and IPv6. You can run GET requests from the [API reference](https://api.f2b.0xhw.com/docs). The [OpenAPI JSON](https://api.f2b.0xhw.com/openapi.json) is also available.

## Endpoints

| Path | Purpose |
| --- | --- |
| `/health` | Service information |
| `/v1/lookup?ip=...` | Observations for a specific IP, including released and stale state |
| `/v1/ips` | Filtered observation list with sorting and pagination |
| `/v1/stats` | Filtered counts and per-column aggregates |
| `/v1/sources` | Collection sources and jail update state |
| `/v1/feed.txt` | Deduplicated IP list of active observations |

## Looking up an IP

```sh
curl 'https://api.f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

This IP is a call example. The API still responds normally when there are no observations, and `observations` is an empty array. Private and reserved addresses and invalid values return 400.

`first_seen` and `last_seen` are Unix seconds. `active` and `stale` are returned as 0 or 1. See [Reading the data]({{< relref "/data/_index.md" >}}) for their meaning.

## Filtering and pagination

```sh
curl 'https://api.f2b.0xhw.com/v1/ips?country=JP&jail=sshd&sort=last_seen&order=desc&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?ip_prefix=1.1.&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?organization=Cloudflare&active=all&limit=100'
```

| Parameter | Meaning |
| --- | --- |
| `source` | Collection source label |
| `jail` | Jail name |
| `country` | Uppercase two-letter country code |
| `asn` | ASN number |
| `active` | `true` (default), `false`, or `all` |
| `stale` | `true` for sources older than 48 hours; `false` for fresh sources |
| `ip_prefix` | Text prefix of the canonical IP address, such as `1.1.` |
| `organization` | Case-insensitive substring of the organization name |
| `first_seen_from`, `first_seen_to` | Inclusive Unix seconds for the first observation |
| `last_seen_from`, `last_seen_to` | Inclusive Unix seconds for the effective last observation |

`sort` accepts `ip`, `source`, `jail`, `country`, `asn`, `organization`, `active`, `first_seen`, and `last_seen`; the default is `ip`. `order` is `asc` (default) or `desc`.

The cursor is bound to the filters and sort order. Reusing a cursor with different conditions returns 400. Ties are broken by `ip`, `source`, and `jail`, so pages do not duplicate or skip observations.

The page size `limit` defaults to 100 and can be at most 500. When `next_cursor` is a string, keep the same filters and pass it as `cursor` in the next request. Do not interpret or modify the cursor.

## Text feed

```sh
curl -i 'https://api.f2b.0xhw.com/v1/feed.txt?country=JP&limit=1000'
```

The feed returns one IP per line and accepts the same filters. The default order is by IP address; the cursor is bound to the filters. The limit defaults to 1000 and can be at most 5000. When `X-Truncated: true` is returned, pass `X-Next-Cursor` as the next `cursor` to continue.

## Statistics

`/v1/stats` accepts the same filters. Without `group_by`, it returns totals and counts by country, ASN, jail, and source. With `group_by`, it returns a single sorted aggregate list.

```sh
curl 'https://api.f2b.0xhw.com/v1/stats?country=JP&group_by=asn&sort=observations&order=desc&limit=20'
```

`group_by` accepts `country`, `asn`, `jail`, or `source`. `sort` accepts `observations` (default), `ips`, or `value`. `order` defaults to `desc`, and `limit` defaults to 100 and can be at most 500.

## Caching and usage limits

The API limits each client IP to roughly 120 requests per minute and returns 429 with `Retry-After` when the limit is exceeded. This limit is an approximation per site.

Statistics are cached for 15 minutes, the feed for 5 minutes, and other APIs for 1 minute. Results can therefore differ briefly right after a collection. Free-plan limits or temporary failures can also make the API unavailable; retry after an interval on error.
