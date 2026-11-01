---
title: "API の使い方"
weight: 2
description: "公開読み取り API の検索、絞り込み、並べ替え、統計、テキストフィード。"
---

ベース URL は `https://api.f2b.0xhw.com` です。公開読み取り API は認証不要で、IPv4 と IPv6 を扱います。[API リファレンス](https://api.f2b.0xhw.com/docs)から GET を実行できます。[OpenAPI JSON](https://api.f2b.0xhw.com/openapi.json) も利用できます。

## エンドポイント

| パス | 用途 |
| --- | --- |
| `/health` | サービス情報 |
| `/v1/lookup?ip=...` | 指定 IP の観測、解除済み・更新停止の情報 |
| `/v1/ips` | 条件で絞り込み、並べ替え、ページングできる観測一覧 |
| `/v1/stats` | 条件で絞り込んだ件数と列ごとの集計 |
| `/v1/sources` | 収集元と Jail の更新状態 |
| `/v1/feed.txt` | 有効な観測の IP を重複なく並べたテキスト一覧 |

## IP を検索する

```sh
curl 'https://api.f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

この IP は呼び出しの例です。観測がない場合も正常に応答し、`observations` は空の配列になります。プライベート・予約アドレスや不正な値には 400 を返します。

`first_seen` と `last_seen` は Unix 秒です。`active` と `stale` は 0 または 1 で返します。意味は[データの読み方]({{< relref "/data/_index.md" >}})を参照してください。

## 絞り込みとページング

```sh
curl 'https://api.f2b.0xhw.com/v1/ips?country=JP&jail=sshd&sort=last_seen&order=desc&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?ip_prefix=1.1.&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?organization=Cloudflare&active=all&limit=100'
```

| パラメーター | 意味 |
| --- | --- |
| `source` | 収集元のラベル |
| `jail` | Jail 名 |
| `country` | 大文字 2 文字の国コード |
| `asn` | ASN 番号 |
| `active` | `true`（既定）、`false`、`all` |
| `stale` | `true` は 48 時間を超えて更新がない収集元、`false` は更新が新しい収集元 |
| `ip_prefix` | 正規化した IP アドレスの前方一致。例: `1.1.` |
| `organization` | 組織名の大文字小文字を区別しない部分一致 |
| `first_seen_from`、`first_seen_to` | 初回観測の Unix 秒。両端を含みます |
| `last_seen_from`、`last_seen_to` | 有効な最終観測の Unix 秒。両端を含みます |

`sort` には `ip`、`source`、`jail`、`country`、`asn`、`organization`、`active`、`first_seen`、`last_seen` を指定できます。既定値は `ip` です。`order` は `asc`（既定）または `desc` です。

カーソルは絞り込み条件と並べ替えに結び付いています。条件が異なるカーソルを使うと 400 を返します。同値の場合は `ip`、`source`、`jail` の順で比較するため、ページをまたいでも観測の重複や取りこぼしは発生しません。

ページサイズの `limit` は既定値 100、最大値 500 です。`next_cursor` が文字列なら、同じ条件を保ったまま `cursor` として次のリクエストへ渡します。カーソルは解釈したり加工したりしないでください。

## テキストフィード

```sh
curl -i 'https://api.f2b.0xhw.com/v1/feed.txt?country=JP&limit=1000'
```

IP を 1 行ずつ返します。絞り込み条件は `/v1/ips` と同じです。並び順は常に IP アドレス順で、カーソルは絞り込み条件に結び付いています。上限は既定値 1000、最大値 5000 です。`X-Truncated: true` の場合は `X-Next-Cursor` を次の `cursor` に指定して取得を続けます。

## 統計

`/v1/stats` は `/v1/ips` と同じ絞り込み条件を受け付けます。`group_by` を指定しない場合は、合計と国・ASN・Jail・収集元ごとの件数を返します。`group_by` を指定すると、1 つの列で集計した結果を並べ替えて返します。

```sh
curl 'https://api.f2b.0xhw.com/v1/stats?country=JP&group_by=asn&sort=observations&order=desc&limit=20'
```

`group_by` には `country`、`asn`、`jail`、`source` を指定できます。`sort` には `observations`（既定）、`ips`、`value` を指定できます。`order` の既定値は `desc`、`limit` の既定値は 100、最大値は 500 です。

## キャッシュと利用上限

API はクライアント IP ごとに 1 分 120 回を目安に制限し、超過時は 429 と `Retry-After` を返します。この制限は拠点ごとの概算です。

統計は 15 分、フィードは 5 分、その他の API は 1 分のキャッシュを使用します。最新の収集直後でも結果に差が出る場合があります。無料枠の上限や一時的な障害により利用できない場合もあるため、エラー時は間隔を空けて再試行してください。
