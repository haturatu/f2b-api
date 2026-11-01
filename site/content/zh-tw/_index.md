---
title: "可搜尋的 Fail2ban 觀測資料。"
description: "由多個收集來源記錄的公開封鎖觀測資料，以及其背後的偵測政策。"
toc: false
---

**f2b-api** 是一套公開 API，彙整 Fail2ban 所記錄的 IP 位址。它提供 IPv4 與 IPv6 查詢、各 Jail 的觀測資料、國家與 ASN 統計，以及去重後的 IP feed。

一筆 IP 紀錄代表該位址在某個收集來源上符合了封鎖規則。**這並不證明惡意活動或系統已遭入侵。** 使用這些資料時，請將共用 IP、動態配發，以及因設定而產生的誤判納入考量。

{{< cards >}}
  {{< card link="policies/" title="封鎖政策" icon="shield-check" subtitle="認證失敗、重複偵測，以及單次符合即永久封鎖的條件。" >}}
  {{< card link="api/" title="使用 API" icon="code" subtitle="IP 查詢、分頁、統計與文字 feed。" >}}
  {{< card link="data/" title="解讀資料" icon="database" subtitle="觀測時間、目前的封鎖狀態，以及已解除或過期的紀錄。" >}}
{{< /cards >}}

## 快速開始

- [API 參考與瀏覽器內呼叫](https://api.f2b.0xhw.com/docs)
- [OpenAPI 3.1 規格](https://api.f2b.0xhw.com/openapi.json)
- [目前統計](https://api.f2b.0xhw.com/v1/stats)
- [目前有效的 IP](https://api.f2b.0xhw.com/v1/ips)
- [既有的 HTML 報告](https://soulminingrig.com/f2b-report/)

## 公開內容

我們公開每個收集來源的公開標籤、Jail 名稱、觀測到的 IP 位址、首次與最後確認時間，以及國家、ASN、組織等補充資料。本網站說明這些觀測背後的各項政策，以及此判斷的限制。

公開讀取 API 不需驗證。整體架構請參閱[關於本服務]({{< relref "/about/_index.md" >}})。
