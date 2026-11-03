---
title: "How to verify Googlebot and identify spoofed crawlers"
description: "Check Googlebot with reverse and forward DNS, understand Cloudflare verified bots, and compare Fail2ban fake-googlebot jail rules."
weight: 3
---

A request claiming `Googlebot` in its User-Agent is not necessarily from Google. When reviewing observations from the `fake-googlebot` jail, start with the actual source IP, not the header.

## Verify the IP with DNS

Resolve the source IP to a hostname (reverse DNS). Then resolve that hostname again (forward DNS) and check that the original IP is returned.

```sh
host 66.249.66.1
host crawl-66-249-66-1.googlebot.com
```

These commands use the example from [Google's official verification guide](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests). Use the IP and returned hostname from your own logs in practice. Check AAAA records for IPv6.

Google documents hostname suffixes including `.googlebot.com`, `.google.com` and `.googleusercontent.com` for different crawler and fetcher classes. Match the actual class, require a domain-label boundary, and never trust an unrelated hostname simply because it contains the text `googlebot.com`.

## What the source jails do

As explained in [per-service policies]({{< relref "/policies/services.md" >}}), `freebsd` verifies both reverse and matching forward DNS. The `oci` rule currently checks only the reverse hostname suffix. Identical jail names therefore do not imply identical verification strength.

Cloudflare's verified-bot classification can also help at the edge, but a User-Agent match alone is not an adequate security exception. Avoid blocking genuine crawlers while treating all unverified traffic as potentially spoofed.
