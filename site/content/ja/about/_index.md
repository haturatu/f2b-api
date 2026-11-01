---
title: "このサービスについて"
weight: 4
description: "収集・保存・公開の構成とソースコード、ライセンス。"
---

このページでは、データの収集から公開までの構成と、ソースコード、ライセンスを説明します。

## 構成

```text
Fail2ban（FreeBSD / PF、Linux / nftables）
  → f2b-report：HTML + JSON
  → 送信キュー：HTTPS、再送、変更がない場合は heartbeat
  → f2b-ingest Worker：入力検証、正規化、差分反映
  → Cloudflare D1：Jail の収集状態と IP の観測履歴
  → f2b-api Worker：公開 GET API とこの静的サイト
```

収集用 Worker と公開用 Worker は分離し、同じ D1 を共有します。公開 API からデータを投稿することや、各サーバーのファイアウォールを操作することはできません。

このサイトは日本語、英語、ロシア語、簡体字中国語、繁体字中国語で提供します。ルートへのアクセスは、保存された言語設定、ブラウザーの言語、接続元の国をもとに `/ja/`、`/en/`、`/ru/`、`/zh-cn/`、`/zh-tw/` のいずれかへリダイレクトします。ナビゲーションバーの言語メニューで切り替えると、選択は Cookie に保存されます。

既存の HTML レポートも引き続き生成します。このサイトは API の説明と公開用ポリシーを掲載し、レポート本体へのリンクを提供します。

## ソースコード

- [f2b-api](https://github.com/haturatu/f2b-api)：API、OpenAPI 仕様、この Hugo サイト。
- [f2b-report](https://github.com/haturatu/f2b-report)：Fail2ban の状態解析、HTML と JSON の出力。

Hugo の本文とテーマ設定は `f2b-api/site/` に置き、サイトのビルドと Worker の配信処理は同じリポジトリで管理します。

## ライセンス

f2b-api のソースコードと独自のドキュメントは [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE) で配布されています。Copyright (c) 2026, haturatu

サイト内検索は FlexSearch を使用し、[Apache License 2.0](/licenses/flexsearch.txt) で配布されています。ライセンスと著作権表示は配信アセットに保持しています。
