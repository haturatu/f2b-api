---
title: "Fail2banのIP観測データを検索する"
heroTitle: "$ curl https://api.f2b.0xhw.com/v1/ips | jq"
description: "複数のサーバーでFail2banが記録したIPv4・IPv6を検索。Jail別の検知条件、観測時刻、国・ASN別の統計、公開REST APIの使い方を紹介します。"
toc: false
---

**f2b-api** は、複数のサーバーで Fail2ban が記録した IP をまとめて検索するための公開 API です。

以前から Fail2ban の状態を HTML レポートとして出していましたが、特定の IP を調べたり、Jail ごとの違いを見たりするには少し使いづらいところがありました。というわけで、IPv4 / IPv6 の検索、国・ASN 別の統計、重複を除いた IP 一覧などを API から取得できるようにしています。

ただし、**ここに載っている IP が必ず攻撃者というわけではありません**。

あくまでも「収集元の Fail2ban が、設定された条件に一致した」と記録しているだけです。CGNAT で共有される IPv4 や、動的 IP の再割り当て、ログの誤検知などを考えると、IP だけで利用者や悪意を断定することはできません。

{{< cards >}}
  {{< card link="policies/" title="遮断ポリシー" icon="shield-check" subtitle="どんなログで BAN するのか。回数判定と永久 BAN の条件。" >}}
  {{< card link="api/" title="API の使い方" icon="code" subtitle="検索、絞り込み、ページング、統計、テキストフィード。" >}}
  {{< card link="data/" title="データの読み方" icon="database" subtitle="観測時刻、BAN の解除、収集が止まった場合の扱い。" >}}
{{< /cards >}}

## とりあえず使ってみる

[API リファレンス](https://api.f2b.0xhw.com/docs)からブラウザーで GET を試せます。curl でもそのまま取得できます。

```sh
curl 'https://api.f2b.0xhw.com/v1/stats' | jq
curl 'https://api.f2b.0xhw.com/v1/ips?limit=10' | jq
```

- [OpenAPI 3.1 仕様](https://api.f2b.0xhw.com/openapi.json)
- [現在の統計](https://api.f2b.0xhw.com/v1/stats)
- [現在有効な IP 一覧](https://api.f2b.0xhw.com/v1/ips)
- [従来の HTML レポート](https://soulminingrig.com/f2b-report/)

公開の読み取り API には認証が必要ありません。BAN 状態を書き換えたり、各サーバーのファイアウォールを操作したりする機能はありません。

## 公開しているもの

収集元の公開用ラベル、Jail 名、IP、初回・最終観測時刻、現在の BAN 状態、国・ASN・組織などの付加情報を公開しています。

一方で、生のアクセスログ、アカウント名、認証情報、管理用の除外リストは公開していません。

収集の仕組みは[このサービスについて]({{< relref "/about/_index.md" >}})、各フィールドの意味は[データの読み方]({{< relref "/data/_index.md" >}})にまとめています。
