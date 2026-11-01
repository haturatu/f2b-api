---
title: "Fail2ban の観測を、検索できるデータに。"
description: "複数の収集元が記録した BAN の観測と、その検知ポリシーを公開します。"
toc: false
---

**f2b-api** は、Fail2ban が記録した IP を集約する公開 API です。IPv4 と IPv6 の検索、Jail ごとの観測、国別・ASN 別の統計、重複を除いた IP フィードを提供します。

IP の記録は、各収集元の遮断基準に一致したことを示します。**悪意や侵害が確認されたことを意味しません。** 共有 IP、動的な割り当て、設定に依存する誤検知を考慮して利用してください。

{{< cards >}}
  {{< card link="policies/" title="遮断ポリシー" icon="shield-check" subtitle="通常の認証失敗、繰り返し検知、一度の一致で永久 BAN する条件を確認します。" >}}
  {{< card link="api/" title="API の使い方" icon="code" subtitle="IP 検索、ページング、統計、テキストフィードを利用します。" >}}
  {{< card link="data/" title="データの読み方" icon="database" subtitle="観測時刻、現在の BAN、解除済み・更新停止の違いを確認します。" >}}
{{< /cards >}}

## すぐに使う

- [API リファレンスとブラウザーからの実行](/docs)
- [OpenAPI 3.1 仕様](/openapi.json)
- [現在の統計](/v1/stats)
- [現在有効な IP 一覧](/v1/ips)
- [既存の HTML レポート](https://soulminingrig.com/f2b-report/)

```sh
curl 'https://f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

これは検索例です。例の IP が観測されていることを示すものではありません。

## 公開しているもの

収集元の公開ラベル、Jail 名、観測された IP、初回・最終確認時刻、国・ASN・組織などの付加情報を提供します。サイトでは、それらの観測を生むポリシーと判定上の制約を説明します。

API の公開読み取り機能は認証不要です。全体の構成は[このサービスについて]({{< relref "/about/_index.md" >}})を参照してください。
