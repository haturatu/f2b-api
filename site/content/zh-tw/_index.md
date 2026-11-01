---
title: "可搜尋的 Fail2ban 觀測資料。"
description: "由多個收集來源記錄的公開封鎖觀測資料，以及其背後的偵測政策。"
toc: false
---

**f2b-api** 是一套公開 API，用來查詢多台伺服器上 Fail2ban 曾記錄的 IP 位址。

先前已經透過 HTML 報告公開 Fail2ban 的統計資訊，但想搜尋某個 IP，或比較它在哪些 Jail 被記錄，翻找報告並不方便。所以另外做了這套 API，提供 IPv4/IPv6 查詢、條件篩選、國家與 ASN 統計，以及去重後的 IP 文字清單。

有一點需要特別說明：**出現在資料庫中的 IP 不一定屬於攻擊者**。紀錄只表示某個收集來源的日誌符合 Fail2ban 設定的篩選條件。CGNAT 共用 IPv4、動態位址重新分配及誤判，都代表不能僅憑一筆紀錄判斷使用者身分或惡意行為。

{{< cards >}}
  {{< card link="policies/" title="封鎖政策" icon="shield-check" subtitle="認證失敗、重複偵測，以及單次符合即永久封鎖的條件。" >}}
  {{< card link="api/" title="使用 API" icon="code" subtitle="IP 查詢、分頁、統計與文字 feed。" >}}
  {{< card link="data/" title="解讀資料" icon="database" subtitle="觀測時間、目前的封鎖狀態，以及已解除或過期的紀錄。" >}}
{{< /cards >}}

## 快速開始

可以直接透過[互動式 API 參考](https://api.f2b.0xhw.com/docs)執行 GET 請求，也可以使用 curl：

```sh
curl 'https://api.f2b.0xhw.com/v1/stats' | jq
curl 'https://api.f2b.0xhw.com/v1/ips?limit=10' | jq
```

- [API 參考與瀏覽器內呼叫](https://api.f2b.0xhw.com/docs)
- [OpenAPI 3.1 規格](https://api.f2b.0xhw.com/openapi.json)
- [目前統計](https://api.f2b.0xhw.com/v1/stats)
- [目前有效的 IP](https://api.f2b.0xhw.com/v1/ips)
- [既有的 HTML 報告](https://soulminingrig.com/f2b-report/)

## 公開內容

公開內容包括收集來源標籤、Jail 名稱、IP、首次與最後觀測時間、目前封鎖狀態，以及國家、ASN、組織等網路資訊。**原始存取日誌、帳號名稱、憑證及管理用排除清單不會公開。**

讀取 API 不需要驗證，但無法向收集端提交資料，也不能控制伺服器的防火牆。資料流程請參閱[關於本服務]({{< relref "/about/_index.md" >}})，欄位含義則在[解讀資料]({{< relref "/data/_index.md" >}})說明。
