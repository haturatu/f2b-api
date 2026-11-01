---
title: "Scanner mitigation"
weight: 1
description: "The nine jails that permanently ban on a single match, and the requests that do not trigger on their own."
---

The nine jails below follow the [shared settings]({{< relref "/policies/_index.md" >}}#shared-scanner-settings) and ban permanently on a single detection. Access to specific paths or User-Agents is also treated as an operating blocking criterion of the collection sources. Access alone does not indicate a vulnerability in that product or a successful attack.

## Sensitive files and VCS

`nginx-scanner-secrets` targets probes for `.env`, `.git/config`, `.svn/entries`, cloud credential files, private keys, history files, and configuration backups.

This filter excludes `/.well-known/acme-challenge/`. It distinguishes these probes from ordinary checks that a public file exists.

## HTTP methods

`nginx-scanner-method` targets TRACE, CONNECT, configured WebDAV and extension methods, PRI, and configured malformed or lowercase methods. Examples include PROPFIND, MKCOL, LOCK, `GETT`, and `get`.

Ordinary OPTIONS is used for CORS preflight and is not part of this method check. This filter excludes paths under `/dav`, `/webdav`, and `/remote.php`.

## Path traversal

`nginx-scanner-traversal` targets `../`, configured encoded forms, system password files, process environment information, Windows configuration files, and null-byte probe signatures.

Even when a string looks like an ordinary search term, it can match if the configured signature appears anywhere in the URI.

## JNDI

`nginx-scanner-jndi` targets `${jndi:` in the URI and configured percent-encoded forms. It is not a rule that covers the entire User-Agent or arbitrary headers.

## SQL injection signatures

`nginx-scanner-sqli` targets URIs that have a query string. It detects `UNION SELECT`, `information_schema`, `sleep(...)`, `benchmark(...)`, configured expressions that attempt file input or output, and configured tautologies.

Configured delimiters and percent-encoding are taken into account. This does not detect SQL injection in general, nor does it replace input validation in an application.

## Product- and appliance-specific probe paths

`nginx-scanner-cve` targets access to configured paths for PHPUnit, Ignition, Actuator, Solr, VPN appliances, mail products, administration consoles, CGI, WordPress, and diagnostic pages.

Examples include PHPUnit's `eval-stdin.php`, `/_ignition/execute-solution`, `/actuator/env`, `/manager/html`, `/server-status`, and `/xmlrpc.php`. This filter excludes Actuator's `/health` and `/info`.

Services that legitimately expose these features can receive normal requests, so a path alone cannot be a general basis for judging malice.

## User-Agent

`nginx-scanner-ua` detects configured scanner names in the User-Agent, such as nikto, sqlmap, Nmap Scripting Engine, masscan, zgrab, Nuclei, WPScan, gobuster, ffuf, and Nessus. Matching respects word boundaries.

Common HTTP clients such as curl, wget, and `python-urllib`, or an empty User-Agent, do not match this condition on their own. A User-Agent is self-reported, so it does not establish who used a tool or any malicious intent.

## Backdoor names and response codes

`nginx-scanner-backdoor` targets combinations of configured file names such as `shell`, `cmd`, `upload`, and `alfa` with configured PHP, ASP, JSP, and CGI extensions, and matches when the response is **200 or 403**.

It assumes a site that is not PHP-based. It is not a condition that bans every 404 for an arbitrary `.php` path.

## Abnormal requests to authentication paths

`nginx-auth-garbage` targets 400, 405, 411, 413, 414, 415, 422, 431, and 501 responses on configured authentication paths such as `/login`, `/signin`, and `/api/auth`. PUT, DELETE, PATCH, and PROPFIND on configured authentication paths are also targeted under separate conditions.

A 401 for an ordinary POST to `/login` is not part of this jail. The listed error responses can also occur with normal clients, so this is likewise an operating standard of the collection sources.

## What does not trigger a ban on its own

- Ordinary OPTIONS, HEAD, and PATCH.
- A 401 for an ordinary POST to `/login`.
- curl, wget, `python-urllib`, common browser User-Agents, and an empty User-Agent.
- A 404 for an ordinary `.php` path.
- A 200 for `package.json`.

This explains single-request conditions in scanner mitigation. If the same request matches another signature, it is detected by that jail. Ordinary HTTP requests can also match the [existing HTTP rate rule]({{< relref "/policies/services.md" >}}#http).
