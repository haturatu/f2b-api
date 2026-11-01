---
title: "このサービスについて"
weight: 4
description: "収集・保存・公開の構成とソースコード、ライセンス。"
---

## 構成

```text
Fail2ban（FreeBSD / PF、Linux / nftables）
  → f2b-report：HTML + JSON
  → 送信キュー：HTTPS、再送、変更がない場合は heartbeat
  → Cloudflare Access：収集元ごとの Service Token
  → f2b-ingest Worker：入力検証、正規化、差分反映
  → Cloudflare D1：Jail の収集状態と IP の観測履歴
  → f2b-api Worker：公開 GET API とこの静的サイト
```

収集用と公開用の Worker を分け、同じ D1 を利用します。収集元は認証と Jail の範囲を確認してから書き込みます。公開 API からデータを投稿したり、各サーバーのファイアウォールを操作したりすることはできません。

既存の HTML レポートも引き続き生成します。このサイトは API の説明と公開用ポリシーを掲載し、レポート本体へのリンクを提供します。

## ソースコード

- [f2b-api](https://github.com/haturatu/f2b-api)：API、OpenAPI 仕様、この Hugo サイト。
- [f2b-report](https://github.com/haturatu/f2b-report)：Fail2ban の状態解析、HTML・JSON の出力。
- [既存 HTML レポート](https://soulminingrig.com/f2b-report/)：Jail ごとのレポート。

Hugo の本文・テーマ設定は `f2b-api/site/`、サイトのビルドと Worker の配信処理は同じリポジトリで管理します。

## ライセンス

f2b-api のソースコードと独自のドキュメントは [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE)です。Copyright (c) 2026, haturatu。

サイト内検索は FlexSearch を使用し、[Apache License 2.0](/licenses/flexsearch.txt)で配布されています。ライセンスと著作権表示を配信アセットに保持しています。
