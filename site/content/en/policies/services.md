---
title: "Per-service policies"
weight: 2
description: "Detection windows, match counts, and ban durations for the six existing jails."
---

This page describes the detection windows, match counts, and ban durations of the six jails that operate separately from scanner mitigation.

The table shows the active configuration as of November 1, 2026.

| Jail | Detection window | Matches | freebsd ban duration | oci ban duration |
| --- | --- | --- | --- | --- |
| `sshd` | 1 week | 3 | 10 weeks | 10 weeks |
| `postfix` | 1 day | 4 | 2 weeks | 2 weeks |
| `dovecot` | 1 day | 4 | 2 weeks | 2 weeks |
| `nginx` | 60 seconds | 60 | 1 week | 1 day |
| `recidive` | 2 weeks | 5 | 52 weeks | 52 weeks |
| `fake-googlebot` | 1 week | 1 | 99,999 weeks | 99,999 weeks |

## SSH and mail

`sshd` evaluates SSH authentication failures and similar events, while `postfix` and `dovecot` evaluate the relevant mail service logs, each with its own filter. These are log-line match counts and do not represent the total number of messages sent or connections.

## HTTP

The `nginx` filter differs by collection source.

- `freebsd`: matches 60 times in 60 seconds for GET, POST, and HEAD responses with 200, 4xx, or 5xx.
- `oci`: matches 60 times in 60 seconds for 429, 444, 499, 503, and 504 responses to uppercase methods.

The same jail name therefore does not mean the same detection. Read API results by combining `source` and `jail`.

## Repeat offenders

`recidive` evaluates repeat offenses based on the bans recorded by Fail2ban. The same IP can overlap with the per-service jails. Duplicates are kept in the API observation list but are combined per IP in the text feed.

## Fake Googlebot

`fake-googlebot` uses the existing DNS check for requests that claim to be Googlebot.

- `freebsd`: resolves the name and verifies that forward resolution matches the original IP.
- `oci`: verifies that the resolved name ends with `googlebot.com` or `google.com`.

The two checks differ in strength. The ban duration is the existing very long finite value and is not the permanent `bantime = -1` ban used in scanner mitigation.
