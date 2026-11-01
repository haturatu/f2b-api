---
title: "關於本服務"
weight: 4
description: "收集、儲存與公開的運作方式，以及原始碼與授權條款。"
---

原本已經有 Fail2ban 的 HTML 報告，但如果想確認「是哪個 Jail 記錄了這個 IP」或「現在還在封鎖嗎」，只靠報告不太方便。

因此保留原有的收集流程，另外建立方便查詢的公開 API。既有的 HTML 報告仍會持續產生。

## 架構

從伺服器上的 Fail2ban 到公開 API，大致會經過以下步驟：

```text
Fail2ban（FreeBSD / PF、Linux / nftables）
  → f2b-report：HTML + JSON
  → 提交佇列：HTTPS、重試、無變更時發送 heartbeat
  → f2b-ingest Worker：輸入驗證、正規化、套用差異
  → Cloudflare D1：各 Jail 的收集狀態與 IP 觀測紀錄
  → f2b-api Worker：公開 GET API 與本靜態網站
```

`f2b-ingest` 負責接收與驗證快照，`f2b-api` 負責查詢與 Hugo 網站。兩者共用 D1，但公開介面不能提交新紀錄，也無法直接操作任何伺服器上的 PF 或 nftables。**是否封鎖 IP，仍由各台伺服器上的 Fail2ban 決定。**

這個網站不只提供 API 的使用方法，也說明這些 IP **為什麼會被記錄下來**。

## 顯示語言

本網站提供日文、英文、俄文、簡體中文與繁體中文版本。存取根路徑時，會依據已儲存的偏好、瀏覽器語言與連線來源國家，導向 `/ja/`、`/en/`、`/ru/`、`/zh-cn/` 或 `/zh-tw/`。從導覽列選擇語言後，偏好會儲存在 Cookie 中。

我們仍持續產生既有的 HTML 報告。本網站說明 API 與公開政策，並連結至報告本身。

## 原始碼

- [f2b-api](https://github.com/haturatu/f2b-api)：API、OpenAPI 規格與本 Hugo 網站。
- [f2b-report](https://github.com/haturatu/f2b-report)：Fail2ban 狀態解析與 HTML/JSON 輸出。

Hugo 內容與主題設定位於 `f2b-api/site/`。網站建置與 Worker 的傳遞邏輯在同一個儲存庫中管理。

## 授權條款

f2b-api 的原始碼與原創文件以 [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE) 散布。Copyright (c) 2026, haturatu

站內搜尋使用 FlexSearch，以 [Apache License 2.0](/licenses/flexsearch.txt) 散布。授權條款與著作權聲明保留在傳遞的資源中。
