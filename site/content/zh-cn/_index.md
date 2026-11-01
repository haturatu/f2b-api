---
title: "Fail2ban 观测记录，皆可检索。"
description: "由多个采集源记录的公开封禁观测数据，以及其背后的检测策略。"
toc: false
---

**f2b-api** 是一个公开 API，用来查询多台服务器上 Fail2ban 记录过的 IP 地址。

之前已经通过 HTML 报告公开 Fail2ban 的统计信息，但想找某个 IP，或者比较它在不同 jail 中的记录，翻报告并不方便。所以我又做了这个 API，提供 IPv4/IPv6 查询、条件过滤、按国家和 ASN 统计，以及去重后的 IP 文本列表。

有一点特别需要说明：**数据库里出现的 IP 不一定属于攻击者**。这只能说明某个采集源的日志符合了 Fail2ban 的过滤规则。CGNAT 下共享的 IPv4、动态地址重新分配、误报等情况，都意味着不能只凭一条记录确定访问者的身份或恶意行为。

{{< cards >}}
  {{< card link="policies/" title="阻断策略" icon="shield-check" subtitle="认证失败、重复检测，以及单次命中即永久封禁的条件。" >}}
  {{< card link="api/" title="使用 API" icon="code" subtitle="IP 查询、分页、统计与文本订阅源。" >}}
  {{< card link="data/" title="解读数据" icon="database" subtitle="观测时间、当前封禁，以及已解除或陈旧（stale）的记录。" >}}
{{< /cards >}}

## 快速开始

可以直接在 [交互式 API 参考](https://api.f2b.0xhw.com/docs)中执行 GET 请求，也可以使用 curl：

```sh
curl 'https://api.f2b.0xhw.com/v1/stats' | jq
curl 'https://api.f2b.0xhw.com/v1/ips?limit=10' | jq
```

- [API 参考与浏览器内调用](https://api.f2b.0xhw.com/docs)
- [OpenAPI 3.1 规范](https://api.f2b.0xhw.com/openapi.json)
- [当前统计](https://api.f2b.0xhw.com/v1/stats)
- [当前有效的 IP](https://api.f2b.0xhw.com/v1/ips)
- [现有的 HTML 报告](https://soulminingrig.com/f2b-report/)

## 公开的内容

公开的数据包括采集源标识、jail 名称、IP、首次和最后观测时间、当前封禁状态，以及国家、ASN、组织等网络信息。**原始访问日志、账号名称、凭据和管理用排除列表不会公开。**

读取 API 无需认证，但无法向采集端提交记录，也无法控制服务器的防火墙。数据流转方式见[关于本服务]({{< relref "/about/_index.md" >}})，各字段的具体含义见[解读数据]({{< relref "/data/_index.md" >}})。
