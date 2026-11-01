---
title: "このサービスについて"
weight: 4
description: "Fail2ban の収集結果が公開 API になるまでの構成とソースコード。"
---

もともと Fail2ban の遮断状況を HTML にして公開していたのですが、それだけだと「この IP はどの Jail で検知されたのか」「今も BAN されているのか」を調べるには向いていません。

そこで、今までの収集処理を生かしつつ、検索用の API を別に作りました。

## どういう構成なのか

全体の流れはこんな感じです。

```text
Fail2ban（FreeBSD / PF、Linux / nftables）
  ↓
f2b-report：HTML と JSON の生成
  ↓
送信キュー：HTTPS 送信と再送。変更がなければ heartbeat
  ↓
f2b-ingest Worker：入力検証、正規化、差分反映
  ↓
Cloudflare D1：Jail の収集状態と IP の観測履歴
  ↓
f2b-api Worker：公開 GET API と Hugo サイト
```

収集用の `f2b-ingest` と公開用の `f2b-api` は Worker を分けており、D1 だけを共有します。公開 API からデータを書き込むことはできません。

また、この API が各サーバーの PF や nftables を直接操作することもありません。どの IP を BAN するかは、そのサーバーの Fail2ban が判断しています。

従来の HTML レポートも引き続き生成しています。こちらのサイトでは、API の使い方に加えて、**そもそもどんな条件で記録された IP なのか**を説明しています。

## 表示言語

日本語、英語、ロシア語、簡体字中国語、繁体字中国語に対応しています。

ルートにアクセスした場合、保存した言語設定、ブラウザーの言語、接続元の国を順番に確認し、`/ja/`、`/en/`、`/ru/`、`/zh-cn/`、`/zh-tw/` へリダイレクトします。

画面の言語メニューから切り替えた設定は Cookie に保存します。接続元の国だけで言語が決まるわけではありません。

## ソースコード

- [f2b-api](https://github.com/haturatu/f2b-api)：公開 API、OpenAPI 仕様、この Hugo サイト
- [f2b-report](https://github.com/haturatu/f2b-report)：Fail2ban の状態解析、HTML と JSON の出力

Hugo の本文やテーマ設定は `f2b-api/site/` にあります。サイトのビルドと Worker への配信も同じリポジトリで管理しています。

## ライセンス

f2b-api のコードと独自のドキュメントは [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE) です。Copyright (c) 2026, haturatu

サイト内検索に使っている FlexSearch は [Apache License 2.0](/licenses/flexsearch.txt) で配布しています。ライセンスと著作権表示は配信アセットに保持しています。
