---
title: "掃描器防護"
weight: 1
description: "單次符合即永久封鎖的 9 個 Jail，以及單獨不會觸發封鎖的請求。"
---

這 9 個掃描器相關的 Jail 可以在**一筆日誌符合條件後就永久封鎖 IP**。與 SSH 按失敗次數判定不同，它們主要比對常見的掃描請求特徵。

不過，正常用戶端也可能使用相同的路徑、HTTP 方法或 User-Agent，所以排除條件同樣重要。**符合規則不代表攻擊成功，也不能據此認定發送者的身分。**

9 個 Jail 都使用[共用設定]({{< relref "/policies/_index.md" >}}#shared-scanner-settings)。以下分別說明偵測範圍，以及刻意排除的情況。

## 機密檔案與 VCS

`nginx-scanner-secrets` 針對 `.env`、`.git/config`、`.svn/entries`、雲端憑證檔案、私鑰、歷史檔案與設定備份的探測。

此篩選器排除 `/.well-known/acme-challenge/`。它會將這類探測與一般確認公開檔案是否存在的行為區分開來。

## HTTP 方法

`nginx-scanner-method` 針對 TRACE、CONNECT、設定的 WebDAV 與延伸方法、PRI，以及設定的畸形或小寫方法。例如 PROPFIND、MKCOL、LOCK、`GETT` 與 `get`。

一般 OPTIONS 用於 CORS 預檢，不屬於此方法檢查。此篩選器排除 `/dav`、`/webdav` 與 `/remote.php` 下的路徑。

## 路徑穿越

`nginx-scanner-traversal` 針對 `../`、設定的編碼形式、系統密碼檔、行程環境資訊、Windows 設定檔與 null 位元組探測特徵。

即使字串看起來像一般搜尋詞，只要設定的特徵出現在 URI 中的任何位置，仍可能符合。

## JNDI

`nginx-scanner-jndi` 針對 URI 中的 `${jndi:` 與設定的百分比編碼形式。這不是涵蓋整個 User-Agent 或任意標頭的規則。

## SQL 注入特徵

`nginx-scanner-sqli` 針對帶有查詢字串的 URI。它會偵測 `UNION SELECT`、`information_schema`、`sleep(...)`、`benchmark(...)`、嘗試檔案輸入或輸出的設定運算式，以及設定的恆真條件。

判定時會考量設定的分隔符與百分比編碼。這無法偵測所有 SQL 注入，也不能取代應用程式的輸入驗證。

## 產品與設備專屬的探測路徑

`nginx-scanner-cve` 針對 PHPUnit、Ignition、Actuator、Solr、VPN 設備、郵件產品、管理主控台、CGI、WordPress 與診斷頁面等設定路徑的存取。

例如 PHPUnit 的 `eval-stdin.php`、`/_ignition/execute-solution`、`/actuator/env`、`/manager/html`、`/server-status` 與 `/xmlrpc.php`。此篩選器排除 Actuator 的 `/health` 與 `/info`。

會正常公開這些功能的服務也可能收到正常請求，因此僅憑路徑無法作為判斷惡意的一般依據。

## User-Agent

`nginx-scanner-ua` 會在 User-Agent 中偵測設定的掃描器名稱，例如 nikto、sqlmap、Nmap Scripting Engine、masscan、zgrab、Nuclei、WPScan、gobuster、ffuf 與 Nessus。比對時會考量詞邊界。

curl、wget、`python-urllib` 等常見 HTTP 用戶端，或空白的 User-Agent，單獨不會符合此條件。User-Agent 是自行申報的資訊，無法確認工具使用者或任何惡意意圖。

因此，即使 User-Agent 寫著掃描器名稱，也無法可靠地辨識實際發送請求的人。

## 後門名稱與回應碼

`nginx-scanner-backdoor` 針對 `shell`、`cmd`、`upload`、`alfa` 等設定檔名與設定的 PHP、ASP、JSP、CGI 副檔名之組合，並在回應為 **200 或 403** 時符合。

此規則假設網站並非以 PHP 建置。它並不是對任意 `.php` 路徑的一律 404 封鎖條件。

## 認證路徑的異常請求

`nginx-auth-garbage` 針對 `/login`、`/signin`、`/api/auth` 等設定認證路徑上的 400、405、411、413、414、415、422、431 與 501 回應。對設定認證路徑的 PUT、DELETE、PATCH 與 PROPFIND 也以另一條件納入。

對 `/login` 的一般 POST 所產生的 401 不屬於此 Jail。所列的錯誤回應也可能發生於正常用戶端，因此這同樣是收集來源運作上的標準。

## 單獨不會觸發封鎖的情況

- 一般的 OPTIONS、HEAD 與 PATCH。
- 對 `/login` 的一般 POST 所產生的 401。
- curl、wget、`python-urllib`、常見瀏覽器 User-Agent 與空白的 User-Agent。
- 一般 `.php` 路徑的 404。
- `package.json` 的 200。

以上說明掃描器防護中的單一請求條件。相同的請求若符合其他特徵，仍會被該 Jail 偵測。一般 HTTP 請求也可能符合[既有的 HTTP 次數規則]({{< relref "/policies/services.md" >}}#http)。

這些只是收集來源目前採用的規則，**不是適合所有網站的通用建議設定**。若要在自己的服務使用類似規則，請先確認正常業務會用到的路徑與 HTTP 方法。
