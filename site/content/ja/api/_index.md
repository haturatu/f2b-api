---
title: "API の使い方"
weight: 2
description: "IP の検索、絞り込み、並べ替え、統計、テキストフィードの利用方法。"
---

ベース URL は `https://api.f2b.0xhw.com` です。

公開しているのは読み取り用の GET API なので、認証は必要ありません。IPv4 と IPv6 の両方を扱えます。ブラウザーで試すなら [API リファレンス](https://api.f2b.0xhw.com/docs) が手軽です。[OpenAPI 仕様](https://api.f2b.0xhw.com/openapi.json)も公開しています。

## 何ができるのか

| パス | 内容 |
| --- | --- |
| `/health` | サービスの情報 |
| `/v1/lookup?ip=...` | 指定した IP の観測を検索 |
| `/v1/ips` | 観測一覧の絞り込み、並べ替え、ページング |
| `/v1/stats` | 件数や国・ASN・Jail・収集元ごとの集計 |
| `/v1/sources` | 収集元と Jail の更新状況 |
| `/v1/feed.txt` | 現在有効な IP を重複なしで返すテキスト一覧 |

## IP を一つ調べる

例えば次のように実行します。

```sh
curl 'https://api.f2b.0xhw.com/v1/lookup?ip=1.1.1.1' | jq
```

`1.1.1.1` は呼び出し例です。観測がない場合でも正常に応答して、`observations` は空配列になります。予約アドレスや不正な値には 400 を返します。

`first_seen`、`last_seen` は Unix 秒、`active` と `stale` は 0 または 1 です。どんな状態を表すのかは[データの読み方]({{< relref "/data/_index.md" >}})を参照してください。

## 条件を付けて検索する

IP を全部取得するより、国や Jail、最終観測時刻で絞った方が便利なこともあります。

```sh
# 日本の sshd 観測を新しい順に
curl 'https://api.f2b.0xhw.com/v1/ips?country=JP&jail=sshd&sort=last_seen&order=desc&limit=100'

# IP の前方一致
curl 'https://api.f2b.0xhw.com/v1/ips?ip_prefix=1.1.&limit=100'

# 組織名で検索し、解除済みも含める
curl 'https://api.f2b.0xhw.com/v1/ips?organization=Cloudflare&active=all&limit=100'
```

| パラメーター | 指定する内容 |
| --- | --- |
| `source` | 収集元のラベル |
| `jail` | Jail 名 |
| `country` | 大文字 2 文字の国コード |
| `asn` | ASN 番号 |
| `active` | `true`（既定）、`false`、`all` |
| `stale` | `true` は 48 時間を超えて更新されない収集元、`false` は更新が新しい収集元 |
| `ip_prefix` | 正規化済み IP の前方一致 |
| `organization` | 組織名の部分一致。大文字小文字は区別しない |
| `first_seen_from` / `first_seen_to` | 初回観測の Unix 秒。両端を含む |
| `last_seen_from` / `last_seen_to` | 最終観測の Unix 秒。両端を含む |

`sort` は `ip`、`source`、`jail`、`country`、`asn`、`organization`、`active`、`first_seen`、`last_seen` から指定できます。既定は `ip`。`order` は `asc`（既定）と `desc` です。

### ページング

`/v1/ips` は既定で 100 件、最大 500 件ずつ返します。

結果に `next_cursor` が入っていたら、その値を次のリクエストの `cursor` に指定します。**絞り込み条件と並び順は変えないでください。** 違う条件に使い回したり、中身を加工したりすると 400 を返します。

同じソート値は `ip`、`source`、`jail` の順で比較して、ページ内の順序を安定させています。

## 統計を見る

`/v1/stats` には、全体の件数と国・ASN・Jail・収集元ごとの集計があります。

```sh
curl 'https://api.f2b.0xhw.com/v1/stats?country=JP&group_by=asn&sort=observations&order=desc&limit=20' | jq
```

`group_by` には `country`、`asn`、`jail`、`source` を指定できます。省略すると全体と複数の分類の集計、指定するとその項目ごとの結果になります。

`sort` は `observations`（既定）、`ips`、`value`。 `order` の既定は `desc`、`limit` は既定 100、最大 500 です。

ちなみに、同じ IP が複数の Jail で検知されれば、観測件数と IP 件数は一致しません。詳しくは[観測の単位]({{< relref "/data/_index.md" >}}#観測の単位)を参照してください。

## テキストフィード

`/v1/feed.txt` は現在有効な IP を重複なしで、1 行ずつ返します。

```sh
curl -i 'https://api.f2b.0xhw.com/v1/feed.txt?country=JP&limit=1000'
```

並び順は常に IP 順です。`limit` は既定 1,000、最大 5,000。`X-Truncated: true` がある場合は、`X-Next-Cursor` を次の `cursor` に渡してください。

ただし、フィードをそのまま別サービスの永久 BAN リストに入れるのはおすすめしません。IP の共有や再割り当てを考えると、[検知条件]({{< relref "/policies/_index.md" >}})と収集時刻を確認してから判断する方が安全です。

## キャッシュと制限

クライアント IP ごとに 1 分 120 回を目安に制限し、超過時は 429 と `Retry-After` を返します。この回数は拠点ごとの概算で、世界共通の厳密なカウンターではありません。

統計は 15 分、フィードは 5 分、その他の API は 1 分キャッシュします。収集した直後でも古い結果が返ることがあります。

無料枠の上限や一時的な障害で利用できない場合は、間隔を空けて再試行してください。
