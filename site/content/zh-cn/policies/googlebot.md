---
title: "如何验证 Googlebot 并识别伪装爬虫"
description: "通过反向和正向 DNS 验证 Googlebot，了解 Cloudflare 已验证 Bot，以及 Fail2ban fake-googlebot 规则的差异。"
weight: 3
---

User-Agent 中出现 `Googlebot` 并不代表请求一定来自 Google。查看 `fake-googlebot` jail 记录时，应先确认真实的来源 IP。

## 使用 DNS 进行验证

首先对来源 IP 进行反向 DNS 查询，获取主机名。随后查询该主机名的正向 DNS，并确认结果包含原始 IP。

```sh
host 66.249.66.1
host crawl-66-249-66-1.googlebot.com
```

这组命令使用 [Google 官方验证文档](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests)中的示例。实际调查时应替换为日志里的 IP 和查询得到的主机名。IPv6 还需要验证 AAAA 记录。

Google 为不同类别的爬虫和抓取器列出了 `.googlebot.com`、`.google.com` 和 `.googleusercontent.com` 等后缀。请按类别验证，并要求完整的域名标签边界，不能仅检查字符串中是否包含 `googlebot.com`。

## 不同采集源的规则差异

根据[服务级策略]({{< relref "/policies/services.md" >}})，`freebsd` 会同时检查反向 DNS 和正向解析是否匹配原始 IP，而 `oci` 只检查反向 DNS 主机名的后缀。同名 jail 的验证强度并不一定相同。

Cloudflare 的已验证 Bot 分类可以提供额外参考，但不能仅凭 User-Agent 放行请求。需要兼顾正常搜索引擎爬虫和伪装访问的处理。
