---
title: "Blocking policies"
weight: 1
description: "Repeated authentication failures and scanner signatures are evaluated separately."
---

Fail2ban blocks IPs when log entries match configured filters, but not every jail decides the same way.

SSH and mail failures are generally counted over a time window. Certain HTTP scanner signatures, on the other hand, trigger a permanent ban on just one match. Understanding the difference matters when interpreting the public API.

## Active configuration

These are the source servers' settings as checked on November 1, 2026, **not recommended defaults for every server**. The collection source labels are `freebsd` and `oci`. Each uses 15 jails: 6 for traditional services and 9 for scanner mitigation.

## Two evaluation methods

| Method | Scope | Blocking criterion |
| --- | --- | --- |
| Repeated detection | SSH, mail authentication, HTTP, repeat offenders | Number of matches within a configured detection window |
| Single detection | Configured HTTP scanner signatures | Permanent ban on one match |

A "match" here means that a log line matches a jail filter. Aggregation and exclusion settings can make this differ from a simple request count.

## Shared scanner settings

```ini
maxretry = 1
findtime = 10m
bantime = -1
bantime.increment = false
```

The nine configured jails ban permanently on a single match. `bantime = -1` means no automatic expiry. The 10-minute detection window does not represent how long the ban lasts.

The blocking scope covers HTTP/HTTPS over TCP and UDP on ports 80 and 443. `freebsd` applies it with PF and `oci` with nftables. Detection and firewall enforcement run in each source's Fail2ban; this public API does not distribute blocking instructions.

- [The nine scanner rules]({{< relref "/policies/scanners.md" >}})
- [Detection counts and ban durations by service]({{< relref "/policies/services.md" >}})

## Why you should not copy these rules without reviewing them

On services that legitimately use administration screens, WebDAV, WordPress, PHP, or extended HTTP methods, the same request can be normal. The conditions listed here are the operating standards of the collection sources, not recommended settings that can be applied unchanged to any site.

Administrative exclusion networks, endpoints, credentials, and internal log contents are not published. The public description and the complete configuration managed on each server are kept separate.
