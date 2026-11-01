---
title: "使用 API"
weight: 2
description: "公開讀取 API 的查詢、篩選、排序、統計與文字 feed。"
---

基礎 URL 為 `https://api.f2b.0xhw.com`。公開讀取 API 不需驗證，並支援 IPv4 與 IPv6。你可以在 [API 參考](https://api.f2b.0xhw.com/docs) 中直接執行 GET 請求。[OpenAPI JSON](https://api.f2b.0xhw.com/openapi.json) 也可取得。

## 端點

| 路徑 | 用途 |
| --- | --- |
| `/health` | 服務資訊 |
| `/v1/lookup?ip=...` | 特定 IP 的觀測資料，包含已解除與過期狀態 |
| `/v1/ips` | 可排序與分頁的篩選後觀測清單 |
| `/v1/stats` | 篩選後的計數與各欄位彙總 |
| `/v1/sources` | 收集來源與 Jail 更新狀態 |
| `/v1/feed.txt` | 有效觀測資料的去重 IP 清單 |

## 查詢 IP

```sh
curl 'https://api.f2b.0xhw.com/v1/lookup?ip=1.1.1.1'
```

此 IP 僅為呼叫範例。即使沒有任何觀測資料，API 仍會正常回應，此時 `observations` 為空陣列。私有位址、保留位址與無效值會傳回 400。

`first_seen` 與 `last_seen` 為 Unix 秒數。`active` 與 `stale` 以 0 或 1 傳回。其意義請參閱[解讀資料]({{< relref "/data/_index.md" >}})。

## 篩選與分頁

```sh
curl 'https://api.f2b.0xhw.com/v1/ips?country=JP&jail=sshd&sort=last_seen&order=desc&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?ip_prefix=1.1.&limit=100'
curl 'https://api.f2b.0xhw.com/v1/ips?organization=Cloudflare&active=all&limit=100'
```

| 參數 | 意義 |
| --- | --- |
| `source` | 收集來源標籤 |
| `jail` | Jail 名稱 |
| `country` | 大寫二位國碼 |
| `asn` | ASN 編號 |
| `active` | `true`（預設）、`false` 或 `all` |
| `stale` | `true` 表示來源超過 48 小時未更新；`false` 表示來源為最新 |
| `ip_prefix` | 正規化 IP 位址的文字前綴，例如 `1.1.` |
| `organization` | 組織名稱的子字串，不區分大小寫 |
| `first_seen_from`, `first_seen_to` | 首次觀測的 Unix 秒數（含端點） |
| `last_seen_from`, `last_seen_to` | 有效最後觀測的 Unix 秒數（含端點） |

`sort` 接受 `ip`、`source`、`jail`、`country`、`asn`、`organization`、`active`、`first_seen` 與 `last_seen`，預設為 `ip`。`order` 為 `asc`（預設）或 `desc`。

游標會綁定篩選條件與排序順序。以不同條件重複使用游標會傳回 400。同值時依 `ip`、`source`、`jail` 排序，因此分頁不會重複或略過觀測資料。

每頁筆數 `limit` 預設為 100，上限為 500。當 `next_cursor` 為字串時，請保持相同篩選條件，並在下一次請求中作為 `cursor` 傳入。請勿解讀或修改游標。

## 文字 feed

```sh
curl -i 'https://api.f2b.0xhw.com/v1/feed.txt?country=JP&limit=1000'
```

feed 每行傳回一個 IP，並接受相同的篩選條件。預設依 IP 位址排序；游標會綁定篩選條件。上限預設為 1000，最多為 5000。當回應包含 `X-Truncated: true` 時，請將 `X-Next-Cursor` 作為下一次的 `cursor` 傳入以繼續取得。

## 統計

`/v1/stats` 接受相同的篩選條件。未指定 `group_by` 時，會傳回總計以及依國家、ASN、Jail、來源分組的計數。指定 `group_by` 時，則傳回單一排序後的彙總清單。

```sh
curl 'https://api.f2b.0xhw.com/v1/stats?country=JP&group_by=asn&sort=observations&order=desc&limit=20'
```

`group_by` 接受 `country`、`asn`、`jail` 或 `source`。`sort` 接受 `observations`（預設）、`ips` 或 `value`。`order` 預設為 `desc`，`limit` 預設為 100，上限為 500。

## 快取與使用限制

API 將每個用戶端 IP 限制為每分鐘約 120 次請求，超過限制時會傳回 429 與 `Retry-After`。此限制為每個網站的近似值。

統計資料快取 15 分鐘，feed 快取 5 分鐘，其他 API 快取 1 分鐘。因此收集後短時間內，結果可能略有差異。免費方案限制或暫時性故障也可能使 API 無法使用；發生錯誤時請間隔一段時間後重試。
