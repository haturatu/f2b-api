---
title: "API の使い方"
weight: 2
description: "公開読み取り API の検索、ページング、統計、テキストフィード。"
---

ベース URL は `https://f2b.0xhw.com` です。公開読み取り API は認証不要で、IPv4・IPv6 を扱います。[API リファレンス](/docs)から GET を実行できます。[OpenAPI JSON](/openapi.json)も利用できます。

## エンドポイント

| パス | 用途 |
| --- | --- |
| `/health` | サービス情報 |
| `/v1/lookup?ip=...` | 指定 IP の観測、解除済み・更新停止の情報 |
| `/v1/ips` | 観測一覧とページング |
| `/v1/stats` | 有効な観測とユニーク IP の統計 |
| `/v1/sources` | 収集元と Jail の更新状態 |
| `/v1/feed.txt` | 有効な IP の重複を除いたテキスト一覧 |

## IP を検索する

```sh
curl 'https://f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

この IP は呼び出しの例です。観測がない場合も正常に応答し、`observations` が空の配列になります。プライベート・予約アドレスや不正な値には 400 を返します。

`first_seen` と `last_seen` は Unix 秒です。`active` と `stale` は 0 または 1 で返します。意味は[データの読み方](/data/)を参照してください。

## 一覧とページング

```sh
curl 'https://f2b.0xhw.com/v1/ips?source=freebsd&jail=sshd&limit=100'
```

`source`、`jail`、`country`、`asn`、`active` で絞り込めます。`country` は大文字 2 文字の国コードです。

| active | 対象 |
| --- | --- |
| `true`（既定） | 更新が新しい Jail の有効な観測 |
| `false` | 最新の収集で一覧から外れた観測 |
| `all` | 解除済み・更新停止を含む全履歴 |

ページサイズの `limit` は既定 100、最大 500 です。返された `next_cursor` が文字列なら、同じ絞り込み条件を保ち、`cursor` として次のリクエストへ渡します。`null` なら最終ページです。カーソルは解釈・加工せず、クエリー値として URL エンコードしてください。

## テキストフィード

```sh
curl -i 'https://f2b.0xhw.com/v1/feed.txt?limit=1000'
```

IP を 1 行ずつ返します。上限は既定 1,000、最大 5,000 件です。`X-Truncated: true` の場合は `X-Next-Cursor` を次の `cursor` に指定して取得を続けます。既定の先頭ページだけで全件取得できるとは限りません。

## キャッシュと利用上限

API はクライアント IP ごとに 1 分 120 回を目安に制限し、超過時は 429 と `Retry-After` を返します。この制限は拠点ごとの概算です。

統計は 15 分、フィードは 5 分、その他の API は 1 分のキャッシュを使用します。最新の収集直後でも結果に差が出る場合があります。無料枠の上限や一時的な障害により利用できない場合もあるため、エラー時は間隔を空けて再試行してください。
