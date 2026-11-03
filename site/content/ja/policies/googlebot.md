---
title: "Googlebotの確認方法と偽装アクセスの見分け方"
description: "GooglebotのUser-Agentは偽装可能。逆引き・正引きDNSの照合、Cloudflareでの確認、Fail2banの検知ルールの違いを説明します。"
weight: 3
---

User-Agent に `Googlebot` と書いてあっても、それだけで本物とは判断できません。このサービスで使っている `fake-googlebot` Jail の挙動を確認するときも、まず接続元の IP を見ます。

## DNSで確かめる

アクセスログに記録された IP を使い、逆引きでホスト名を取得します。続いて、そのホスト名を正引きして**元の IP が含まれること**を確認します。

```sh
host 66.249.66.1
host crawl-66-249-66-1.googlebot.com
```

これは[Googleの公式ドキュメント](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests?hl=ja)に掲載されている例です。実際の調査ではログの IP と逆引き結果を使ってください。IPv6 の場合は AAAA レコードでも照合します。

ホスト名の末尾は `.googlebot.com`、`.google.com`、`.googleusercontent.com` などGoogleが説明する範囲を、クローラーの種類に応じて確認します。文字列に `googlebot.com` が含まれるだけの別ドメインは認めません。

## 収集元ごとの違い

[サービス別ポリシー]({{< relref "/policies/services.md" >}})のとおり、`freebsd` では逆引きと正引きの一致を確認しています。一方 `oci` は逆引きホスト名の末尾だけの確認です。この違いがあるため、Jail 名が同じでも検証の強さは同じではありません。

Cloudflare側の検証済みBot判定も参考になりますが、User-Agentの文字列だけをホワイトリストにしないでください。正規のクローラーへの過剰な遮断と、偽装アクセスの見逃しの両方を避ける必要があります。
