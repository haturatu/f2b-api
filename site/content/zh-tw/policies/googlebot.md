---
title: "如何驗證 Googlebot 並辨識偽裝爬蟲"
description: "透過反向與正向 DNS 驗證 Googlebot，瞭解 Cloudflare 已驗證 Bot，以及 Fail2ban fake-googlebot 規則的差異。"
weight: 3
---

User-Agent 出現 `Googlebot`，不代表請求一定來自 Google。檢查 `fake-googlebot` Jail 的紀錄時，應先確認真正的來源 IP。

## 使用 DNS 驗證

首先對來源 IP 進行反向 DNS 查詢，取得主機名稱，再查詢該名稱的正向 DNS，確認結果包含原始 IP。

```sh
host 66.249.66.1
host crawl-66-249-66-1.googlebot.com
```

此範例來自 [Google 官方驗證文件](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests)。實際檢查時，請替換成日誌內的 IP 及反查結果。IPv6 也需要檢查 AAAA 紀錄。

Google 針對不同類型的爬蟲和擷取器說明了 `.googlebot.com`、`.google.com` 與 `.googleusercontent.com` 等後綴。應依類型查證並確認完整的網域標籤邊界，不能只檢查字串是否包含 `googlebot.com`。

## 不同來源的檢查方式

依照[服務別政策]({{< relref "/policies/services.md" >}})，`freebsd` 會檢查反向 DNS 並確認正向解析符合原始 IP；`oci` 則只驗證反向主機名稱的後綴。相同的 Jail 名稱並不代表相同的驗證強度。

Cloudflare 的已驗證 Bot 分類可作為額外參考，但不可僅憑 User-Agent 允許存取。應同時避免誤擋正常爬蟲與放行偽裝流量。
