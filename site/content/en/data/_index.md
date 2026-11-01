---
title: "Reading the data"
weight: 3
description: "Observation times, ban state, stale updates, and the meaning and limits of country and ASN data."
---

## Unit of observation

One observation is the combination of `source`, `jail`, and `ip`. If the same IP is detected by two jails or two collection sources, it is kept as multiple observations.

In statistics, `observations` is the number of observations and `ips` is the number of unique IPs. The text feed also deduplicates IPs.

## Time and state

| Field | Meaning |
| --- | --- |
| `first_seen` | When this collection platform first confirmed the address |
| `last_seen` | The last collection time at which it was confirmed |
| `active = 1` | Present in the ban list of the latest snapshot |
| `active = 0` | Dropped from the list in a later snapshot |
| `stale = 1` | The jail has not been collected for more than 48 hours |

Times are not the moment the ban event itself occurred. A stopped collection source is not treated as a ban release. Jails with stale updates are excluded from the current list, statistics, and feed. Lookup and `active=all` let you inspect past observations.

## Limits of periodic collection

Alongside the daily report generation, each collection source writes its current ban list as JSON. When nothing has changed it sends a hash-based heartbeat; when something changed it applies a diff from a complete snapshot.

IPs that were banned and released between two collections cannot be recorded. This is not an API that restores every past ban list. Records exist only from the point at which this collection platform began observing.

## Country, ASN, and organization

These are enrichment values from GeoIP, RDAP, and similar sources. Unknown values are `null`. Country codes and ASNs describe networks; they do not identify the nationality, residence, affiliation, or identity of the person who made the request.

## What is public

The public API provides IP addresses, public collection-source labels, jail names, observation times, state, and network enrichment. Raw access logs, request bodies, account names, credentials, and administrative exclusion lists are not published.

Do not treat an IP record alone as proof of malicious intent or as grounds for permanent automatic blocking; review the [detection rules]({{< relref "/policies/_index.md" >}}) and the state. Shared lines and dynamic IP assignment mean that a different user may be using the address than at the time of observation.

## Reporting false positives or specification issues

You can report interpretation questions or inconsistencies in the specification through the [GitHub repository](https://github.com/haturatu/f2b-api). Do not publish credentials, raw logs, or personal information. When reviewing a correction, we separate the jail, the observation time, and the conditions of the issue.
