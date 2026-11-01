---
title: "Fail2ban 观测记录，皆可检索。"
description: "由多个采集源记录的公开封禁观测数据，以及其背后的检测策略。"
toc: false
---

**f2b-api** 是一个汇总 Fail2ban 所记录 IP 地址的公开 API。它提供 IPv4 与 IPv6 查询、按 jail 划分的观测记录、国家与 ASN 统计，以及去重后的 IP 订阅源。

一条 IP 记录表示该地址在某个采集源上命中了阻断规则。**它并不能证明存在恶意活动或系统已被入侵。** 使用这些数据时，请考虑共享 IP、动态分配以及依赖配置的误报情况。

{{< cards >}}
  {{< card link="policies/" title="阻断策略" icon="shield-check" subtitle="认证失败、重复检测，以及单次命中即永久封禁的条件。" >}}
  {{< card link="api/" title="使用 API" icon="code" subtitle="IP 查询、分页、统计与文本订阅源。" >}}
  {{< card link="data/" title="解读数据" icon="database" subtitle="观测时间、当前封禁，以及已解除或陈旧（stale）的记录。" >}}
{{< /cards >}}

## 快速开始

- [API 参考与浏览器内调用](https://api.f2b.0xhw.com/docs)
- [OpenAPI 3.1 规范](https://api.f2b.0xhw.com/openapi.json)
- [当前统计](https://api.f2b.0xhw.com/v1/stats)
- [当前有效的 IP](https://api.f2b.0xhw.com/v1/ips)
- [现有的 HTML 报告](https://soulminingrig.com/f2b-report/)

## 公开的内容

我们公开每个采集源的公开标识、jail 名称、观测到的 IP 地址、首次与最后确认时间，以及国家、ASN、组织等附加信息。本站说明这些观测背后的策略以及判定的局限性。

公开只读 API 无需认证。整体架构请参阅[关于本服务]({{< relref "/about/_index.md" >}})。
