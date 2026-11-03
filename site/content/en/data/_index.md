---
title: "Reading the data"
datasetName: "Fail2ban IP observation dataset"
datasetDescription: "A periodically collected dataset of IPv4 and IPv6 addresses observed in Fail2ban ban lists across multiple sources. The public REST API exposes source, jail, observation times, ban state, country and ASN metadata. An observation does not prove malicious activity."
weight: 3
description: "Observation times, ban state, stale updates, and the meaning and limits of country and ASN data."
---

The confusing part of these results is that **“observed at some point” is not the same as “currently banned.”**

Collection is periodic rather than real time. Before using this as an attacker list, it helps to understand what an observation actually represents and what the timestamps cannot tell you.

## Unit of observation

One observation is the combination of `source`, `jail`, and `ip`. If the same IP is detected by two jails or two collection sources, it is kept as multiple observations.

For example, an IP recorded by both SSH and Nginx produces two observations. That's why the number of observations may be higher than the number of distinct IPs.

In statistics, `observations` is the number of observations and `ips` is the number of unique IPs. The text feed also deduplicates IPs.

## Time and state

| Field | Meaning |
| --- | --- |
| `first_seen` | When this collection platform first confirmed the address |
| `last_seen` | The last collection time at which it was confirmed |
| `active = 1` | Present in the ban list of the latest snapshot |
| `active = 0` | Dropped from the list in a later snapshot |
| `stale = 1` | The jail has not been collected for more than 48 hours |

These timestamps mark when **this collection system observed the state**, not when Fail2ban first issued the ban. A source stopping updates is also not evidence that a ban has been lifted. Jails with stale updates are excluded from the current list, statistics, and feed. Lookup and `active=all` let you inspect past observations.

## Limits of periodic collection

Alongside the daily report generation, each collection source writes its current ban list as JSON. When nothing has changed it sends a hash-based heartbeat; when something changed it applies a diff from a complete snapshot.

An IP banned and released between two snapshots will never appear in the dataset. The API is not an event-by-event audit log. This is not an API that restores every past ban list. Records exist only from the point at which this collection platform began observing.

## Country, ASN, and organization

These are enrichment values from GeoIP (IP geolocation) and RDAP (registration data). Unknown values are `null`. Country codes and ASN (Autonomous System Number) values describe networks; they do not identify the nationality, residence, affiliation, or identity of the person who made the request.

## What is public

The public API provides IP addresses, public collection-source labels, jail names, observation times, state, and network enrichment. Raw access logs, request bodies, account names, credentials, and administrative exclusion lists are not published.

**Do not feed these observations directly into a permanent automatic blocklist.** An IP record alone is not proof of malicious intent; review the [detection rules]({{< relref "/policies/_index.md" >}}) and the state. Shared lines and dynamic IP assignment mean that a different user may be using the address than at the time of observation.

## Reporting false positives or specification issues

You can report interpretation questions or inconsistencies in the specification through the [f2b-api GitHub repository](https://github.com/haturatu/f2b-api). Do not publish credentials, raw logs, or personal information. When reviewing a correction, we separate the jail, the observation time, and the conditions of the issue.

## Public dataset and access

This page also describes the **Fail2ban IP observation dataset**. The records come from periodic snapshots of ban lists from multiple Fail2ban sources, not from verified attack-attribution events.

- [Observations (JSON)](https://api.f2b.0xhw.com/v1/ips): source, jail, IP, timestamps, ban state and network metadata, returned in pages.
- [Statistics (JSON)](https://api.f2b.0xhw.com/v1/stats): totals and breakdowns by country, ASN, jail and source.
- [Active IP text feed](https://api.f2b.0xhw.com/v1/feed.txt): deduplicated IPs, with pagination for larger sets.
- [OpenAPI specification](https://api.f2b.0xhw.com/openapi.json): endpoint contracts and parameters.

The API is paginated; it is not a single-file download of all historical records. The software's BSD license does not automatically establish redistribution terms for the observation dataset. Confirm data-use terms separately.
