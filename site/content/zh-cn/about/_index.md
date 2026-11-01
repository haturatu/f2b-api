---
title: "关于本服务"
weight: 4
description: "采集、存储与发布的工作方式，以及源代码和许可证。"
---

原来已经有 Fail2ban 的 HTML 报告，但如果想知道“哪个 jail 记录了这个 IP”或者“现在还在封禁吗”，仅靠报告不太方便。

因此保留了原来的采集流程，另外做了一套用于查询的公开 API。旧的 HTML 报告仍然会生成。

## 架构

从服务器上的 Fail2ban 到公开 API，大致经过以下步骤：

```text
Fail2ban (FreeBSD / PF, Linux / nftables)
  → f2b-report: HTML + JSON
  → submission queue: HTTPS, retries, heartbeat when nothing changed
  → f2b-ingest Worker: input validation, normalization, diff application
  → Cloudflare D1: per-jail collection state and IP observation history
  → f2b-api Worker: public GET API and this static site
```

`f2b-ingest` 负责接收和校验快照，`f2b-api` 负责查询与 Hugo 站点的访问。两者使用同一个 D1 数据库，但公开接口不能提交新记录，也不能直接操作任何服务器的 PF 或 nftables。**是否封禁 IP，仍由每台服务器上的 Fail2ban 决定。**

这个站点除了提供 API 使用说明，也解释这些 IP **为什么会被记录下来**。

## 显示语言

本站提供日语、英语、俄语、简体中文和繁体中文版本。对根路径的请求会根据已保存的偏好、浏览器语言和连接来源国家，跳转到 `/ja/`、`/en/`、`/ru/`、`/zh-cn/` 或 `/zh-tw/`。从导航栏选择语言会将偏好保存到 Cookie 中。

我们继续生成现有的 HTML 报告。本站说明 API 与公开策略，并链接到报告本身。

## 源代码

- [f2b-api](https://github.com/haturatu/f2b-api)：API、OpenAPI 规范以及本站 Hugo 站点。
- [f2b-report](https://github.com/haturatu/f2b-report)：Fail2ban 状态解析与 HTML/JSON 输出。

Hugo 内容与主题配置位于 `f2b-api/site/`。站点构建与 Worker 的交付逻辑在同一仓库中管理。

## 许可证

f2b-api 源代码与原始文档以 [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE) 分发。Copyright (c) 2026, haturatu

站内搜索使用 FlexSearch，以 [Apache License 2.0](/licenses/flexsearch.txt) 分发。许可证与版权声明保留在交付的静态资源中。
