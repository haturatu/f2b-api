---
title: "關於本服務"
weight: 4
description: "收集、儲存與公開的運作方式，以及原始碼與授權條款。"
---

本頁說明資料如何收集、儲存與公開，並列出原始碼與授權條款。

## 架構

```text
Fail2ban（FreeBSD / PF、Linux / nftables）
  → f2b-report：HTML + JSON
  → 提交佇列：HTTPS、重試、無變更時發送 heartbeat
  → f2b-ingest Worker：輸入驗證、正規化、套用差異
  → Cloudflare D1：各 Jail 的收集狀態與 IP 觀測紀錄
  → f2b-api Worker：公開 GET API 與本靜態網站
```

收集用 Worker 與公開用 Worker 彼此分離，並共用同一個 D1 資料庫。公開 API 無法提交資料，也無法操作任何伺服器的防火牆。

本網站提供日文、英文、俄文、簡體中文與繁體中文版本。存取根路徑時，會依據已儲存的偏好、瀏覽器語言與連線來源國家，導向 `/ja/`、`/en/`、`/ru/`、`/zh-cn/` 或 `/zh-tw/`。從導覽列選擇語言後，偏好會儲存在 Cookie 中。

我們仍持續產生既有的 HTML 報告。本網站說明 API 與公開政策，並連結至報告本身。

## 原始碼

- [f2b-api](https://github.com/haturatu/f2b-api)：API、OpenAPI 規格與本 Hugo 網站。
- [f2b-report](https://github.com/haturatu/f2b-report)：Fail2ban 狀態解析與 HTML/JSON 輸出。

Hugo 內容與主題設定位於 `f2b-api/site/`。網站建置與 Worker 的傳遞邏輯在同一個儲存庫中管理。

## 授權條款

f2b-api 的原始碼與原創文件以 [BSD 2-Clause License](https://github.com/haturatu/f2b-api/blob/master/LICENSE) 散布。Copyright (c) 2026, haturatu

站內搜尋使用 FlexSearch，以 [Apache License 2.0](/licenses/flexsearch.txt) 散布。授權條款與著作權聲明保留在傳遞的資源中。
