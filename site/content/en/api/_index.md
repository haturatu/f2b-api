---
title: "Using the API"
weight: 2
description: "Lookup, pagination, statistics, and the text feed of the public read API."
---

The base URL is `https://f2b.0xhw.com`. The public read API requires no authentication and handles IPv4 and IPv6. You can run GET requests from the [API reference](/docs). The [OpenAPI JSON](/openapi.json) is also available.

## Endpoints

| Path | Purpose |
| --- | --- |
| `/health` | Service information |
| `/v1/lookup?ip=...` | Observations for a specific IP, including released and stale state |
| `/v1/ips` | Observation list and pagination |
| `/v1/stats` | Statistics for active observations and unique IPs |
| `/v1/sources` | Collection sources and jail update state |
| `/v1/feed.txt` | Deduplicated text list of active IPs |

## Looking up an IP

```sh
curl 'https://f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

This IP is a call example. The API still responds normally when there are no observations, and `observations` is an empty array. Private and reserved addresses and invalid values return 400.

`first_seen` and `last_seen` are Unix seconds. `active` and `stale` are returned as 0 or 1. See [Reading the data]({{< relref "/data/_index.md" >}}) for their meaning.

## Listing and pagination

```sh
curl 'https://f2b.0xhw.com/v1/ips?source=oci&jail=sshd&limit=100'
curl 'https://f2b.0xhw.com/v1/ips?country=CN&limit=100'
curl 'https://f2b.0xhw.com/v1/ips?asn=3462&limit=100'
```

You can filter by `source`, `jail`, `country`, `asn`, and `active`. The values accepted for `source` and `jail` are listed at [/v1/sources](https://f2b.0xhw.com/v1/sources). `country` is an uppercase two-letter country code.

| active | Scope |
| --- | --- |
| `true` (default) | Active observations of jails with recent updates |
| `false` | Observations dropped from the list in the latest collection |
| `all` | Full history, including released and stale observations |

The page size `limit` defaults to 100 and can be at most 500. When `next_cursor` is a string, keep the same filters and pass it as `cursor` in the next request. If it is `null`, you are on the last page. Do not interpret or modify the cursor; pass it as a URL-encoded query value.

## Text feed

```sh
curl -i 'https://f2b.0xhw.com/v1/feed.txt?limit=1000'
```

The feed returns one IP per line. The limit defaults to 1000 and can be at most 5000. When `X-Truncated: true` is returned, pass `X-Next-Cursor` as the next `cursor` to continue. The default first page does not always contain every record.

## Caching and usage limits

The API limits each client IP to roughly 120 requests per minute and returns 429 with `Retry-After` when the limit is exceeded. This limit is an approximation per site.

Statistics are cached for 15 minutes, the feed for 5 minutes, and other APIs for 1 minute. Results can therefore differ briefly right after a collection. Free-plan limits or temporary failures can also make the API unavailable; retry after an interval on error.
