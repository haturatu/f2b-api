---
title: "使用 API"
weight: 2
description: "公开只读 API 的查询、过滤、排序、统计与文本订阅源。"
---

基础 URL 是 `https://api.f2b.0xhw.com`。这里只提供**公开只读的 GET API**，无需登录就能查询 IPv4 和 IPv6 的观测记录，但不能修改任何服务器的封禁列表。

想在浏览器里尝试请求，可以使用[交互式 API 参考](https://api.f2b.0xhw.com/docs)；机器可读的 [OpenAPI 规范](https://api.f2b.0xhw.com/openapi.json)也可以获取。

## 可以查询什么

| 路径 | 用途 |
| --- | --- |
| `/health` | 服务信息 |
| `/v1/lookup?ip=...` | 指定 IP 的观测记录，包括已解除与陈旧状态 |
| `/v1/ips` | 支持排序与分页的过滤后观测列表 |
| `/v1/stats` | 过滤后的计数与按列聚合 |
| `/v1/sources` | 采集源与 jail 更新状态 |
| `/v1/feed.txt` | 有效观测记录的去重 IP 列表 |

## 查询单个 IP

```sh
curl 'https://api.f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

该 IP 仅作调用示例。即使没有任何观测记录，API 仍会正常响应，此时 `observations` 为空数组。私有地址、保留地址以及非法值会返回 400。

`first_seen` 与 `last_seen` 为 Unix 秒。`active` 与 `stale` 以 0 或 1 返回。其含义请参阅[解读数据]({{< relref "/data/_index.md" >}})。

## 过滤与分页

没必要每次都下载完整列表。可以按照国家、jail、组织名称或观测时间缩小查询范围：

```sh
curl 'https://api.f2b.0xhw.com/v1/ips?country=JP&jail=sshd&sort=last_seen&order=desc&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?ip_prefix=1.1.&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?organization=Cloudflare&active=all&limit=100'
```

| 参数 | 含义 |
| --- | --- |
| `source` | 采集源标识 |
| `jail` | jail 名称 |
| `country` | 大写的两位国家代码 |
| `asn` | ASN 编号 |
| `active` | `true`（默认）、`false` 或 `all` |
| `stale` | `true` 表示采集源超过 48 小时未更新；`false` 表示数据较新 |
| `ip_prefix` | 规范化 IP 地址的文本前缀，例如 `1.1.` |
| `organization` | 组织名称的不区分大小写子串 |
| `first_seen_from`、`first_seen_to` | 首次观测时间的包含式 Unix 秒范围 |
| `last_seen_from`、`last_seen_to` | 有效最后观测时间的包含式 Unix 秒范围 |

`sort` 接受 `ip`、`source`、`jail`、`country`、`asn`、`organization`、`active`、`first_seen` 和 `last_seen`，默认为 `ip`。`order` 可为 `asc`（默认）或 `desc`。

游标与过滤条件和排序方式绑定。使用不同的条件复用游标会返回 400。排序值相同时按 `ip`、`source` 和 `jail` 排序，因此分页不会重复或跳过观测记录。

每页条数 `limit` 默认为 100，最大为 500。当 `next_cursor` 为字符串时，保持相同的过滤条件，并在下一次请求中将其作为 `cursor` 传入。请勿解析或修改游标。

## 文本订阅源

```sh
curl -i 'https://api.f2b.0xhw.com/v1/feed.txt?country=JP&limit=1000'
```

订阅源每行返回一个 IP，并接受相同的过滤参数。默认按 IP 地址排序；游标与过滤条件绑定。`limit` 默认为 1000，最大为 5000。若响应返回 `X-Truncated: true`，请将 `X-Next-Cursor` 作为下一次请求的 `cursor` 以继续获取。

**不要把这个列表直接当成永久封禁名单使用。** 它记录的是 Fail2ban 的观测结果，而不是经过身份确认的攻击者。请先检查[检测规则]({{< relref "/policies/_index.md" >}})和观测时间。

## 统计

如果只想看汇总而不是单条记录，可以用 `/v1/stats`。它接受相同的过滤参数。未指定 `group_by` 时，返回总计以及按国家、ASN、jail 和采集源的计数。指定 `group_by` 时，返回单个已排序的聚合列表。

```sh
curl 'https://api.f2b.0xhw.com/v1/stats?country=JP&group_by=asn&sort=observations&order=desc&limit=20'
```

`group_by` 接受 `country`、`asn`、`jail` 或 `source`。`sort` 接受 `observations`（默认）、`ips` 或 `value`。`order` 默认为 `desc`，`limit` 默认为 100，最大为 500。

## 缓存与使用限制

API 将每个客户端 IP 限制为每分钟约 120 次请求，超出限制时返回 429 并附带 `Retry-After`。这是边缘节点上的近似限制，并非全球共用的精确计数器。

统计数据缓存 15 分钟，订阅源缓存 5 分钟，其他 API 缓存 1 分钟。因此在采集完成后的一小段时间内，结果可能不一致。免费套餐限制或临时故障也可能导致 API 不可用；出错时请间隔一段时间后重试。
