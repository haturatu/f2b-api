---
title: "各服務政策"
weight: 2
description: "既有 6 個 Jail 的偵測期間、符合次數與封鎖期間。"
---

本頁說明與掃描器防護分開運作的 6 個 Jail 之偵測期間、符合次數與封鎖期間。

下表為 2026 年 11 月 1 日的有效設定。

| Jail | 偵測期間 | 符合次數 | freebsd 封鎖期間 | oci 封鎖期間 |
| --- | --- | --- | --- | --- |
| `sshd` | 1 週 | 3 | 10 週 | 10 週 |
| `postfix` | 1 天 | 4 | 2 週 | 2 週 |
| `dovecot` | 1 天 | 4 | 2 週 | 2 週 |
| `nginx` | 60 秒 | 60 | 1 週 | 1 天 |
| `recidive` | 2 週 | 5 | 52 週 | 52 週 |
| `fake-googlebot` | 1 週 | 1 | 99,999 週 | 99,999 週 |

## SSH 與郵件

`sshd` 評估 SSH 認證失敗等事件，`postfix` 與 `dovecot` 則以各自的篩選器評估相關郵件服務日誌。這些是日誌行的符合次數，並不代表訊息傳送總數或連線總數。

## HTTP

`nginx` 篩選器依收集來源而異。

- `freebsd`：對 GET、POST 與 HEAD 的 200、4xx、5xx 回應，在 60 秒內符合 60 次。
- `oci`：對大寫方法的 429、444、499、503、504 回應，在 60 秒內符合 60 次。

因此相同的 Jail 名稱並不代表相同的偵測。請結合 `source` 與 `jail` 來解讀 API 結果。

## 累犯

`recidive` 依據 Fail2ban 記錄的封鎖來評估累犯。同一個 IP 可能與各服務的 Jail 重疊。重複項目會保留在 API 觀測清單中，但在文字 feed 中會以 IP 為單位合併。

## 偽裝 Googlebot

`fake-googlebot` 對自稱 Googlebot 的請求使用既有的 DNS 檢查。

- `freebsd`：解析名稱，並確認正向解析結果與原始 IP 相符。
- `oci`：確認解析出的名稱結尾為 `googlebot.com` 或 `google.com`。

兩者的檢查強度不同。封鎖期間為既有的極長有限值，並非掃描器防護所用的 `bantime = -1` 永久封鎖。
