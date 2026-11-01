---
title: "扫描器缓解"
weight: 1
description: "单次命中即永久封禁的九个 jail，以及本身不会触发封禁的请求。"
---

这九个扫描器相关的 jail 可以在**一条日志匹配后就永久封禁 IP**。与 SSH 的多次失败计数不同，它们主要检测常见的扫描请求特征。

不过，正常客户端也可能访问相同的路径、使用相同的 HTTP 方法或 User-Agent，所以排除条件同样重要。**匹配规则不等于攻击成功，更不能据此确定访问者的身份。**

九个 jail 均采用[共用设置]({{< relref "/policies/_index.md" >}}#shared-scanner-settings)。下面分别说明检测范围和特意排除的情况。

## 敏感文件与版本控制

`nginx-scanner-secrets` 针对对 `.env`、`.git/config`、`.svn/entries`、云凭据文件、私钥、历史文件以及配置备份的探测。

该过滤规则排除 `/.well-known/acme-challenge/`。以此将这些探测与确认公开文件是否存在的常规检查区分开来。

## HTTP 方法

`nginx-scanner-method` 针对 TRACE、CONNECT、配置的 WebDAV 与扩展方法、PRI，以及配置的畸形或小写方法。示例包括 PROPFIND、MKCOL、LOCK、`GETT` 和 `get`。

普通的 OPTIONS 用于 CORS 预检，不属于此方法检查的范围。该过滤规则排除 `/dav`、`/webdav` 和 `/remote.php` 下的路径。

## 路径穿越

`nginx-scanner-traversal` 针对 `../`、配置的编码形式、系统密码文件、进程环境信息、Windows 配置文件以及空字节探测特征。

即使某个字符串看起来像普通的搜索词，只要配置的特征出现在 URI 中的任意位置，也可能命中。

## JNDI

`nginx-scanner-jndi` 针对 URI 中的 `${jndi:` 以及配置的百分号编码形式。该规则并不覆盖整个 User-Agent 或任意请求头。

## SQL 注入特征

`nginx-scanner-sqli` 针对带有查询字符串的 URI。它会检测 `UNION SELECT`、`information_schema`、`sleep(...)`、`benchmark(...)`、配置的试图进行文件输入或输出的表达式，以及配置的恒真表达式。

评估时会考虑配置的分隔符与百分号编码。它并不能检测所有 SQL 注入，也不能替代应用程序中的输入校验。

## 特定产品与设备的探测路径

`nginx-scanner-cve` 针对对 PHPUnit、Ignition、Actuator、Solr、VPN 设备、邮件产品、管理控制台、CGI、WordPress 以及诊断页面的配置路径的访问。

示例包括 PHPUnit 的 `eval-stdin.php`、`/_ignition/execute-solution`、`/actuator/env`、`/manager/html`、`/server-status` 和 `/xmlrpc.php`。该过滤规则排除 Actuator 的 `/health` 与 `/info`。

合法提供这些功能的服务也可能收到正常请求，因此仅凭路径无法作为判断恶意的一般依据。

## User-Agent

`nginx-scanner-ua` 检测 User-Agent 中配置的扫描器名称，例如 nikto、sqlmap、Nmap Scripting Engine、masscan、zgrab、Nuclei、WPScan、gobuster、ffuf 和 Nessus。匹配遵循单词边界。

curl、wget、`python-urllib` 等常见 HTTP 客户端，或空 User-Agent，本身不会命中该条件。User-Agent 由客户端自行声明，因此不能据此确定工具的使用者或任何恶意意图。

因此，即使 User-Agent 中有扫描器名称，也不能据此准确识别请求者。

## 后门文件名与响应码

`nginx-scanner-backdoor` 针对 `shell`、`cmd`、`upload`、`alfa` 等配置的文件名与配置的 PHP、ASP、JSP、CGI 扩展名的组合，并在响应为 **200 或 403** 时命中。

该规则假定站点并非基于 PHP。它并非对任意 `.php` 路径的 404 一律封禁的条件。

## 对认证路径的异常请求

`nginx-auth-garbage` 针对配置的认证路径（如 `/login`、`/signin` 和 `/api/auth`）上返回 400、405、411、413、414、415、422、431 和 501 的响应。配置的认证路径上的 PUT、DELETE、PATCH 和 PROPFIND 也会在单独的条件下被针对。

对 `/login` 的普通 POST 返回 401 不属于此 jail。列出的错误响应也可能由正常客户端产生，因此这同样是采集源的运行标准。

## 本身不会触发封禁的情况

- 普通的 OPTIONS、HEAD 和 PATCH。
- 对 `/login` 的普通 POST 返回 401。
- curl、wget、`python-urllib`、常见浏览器 User-Agent，以及空 User-Agent。
- 普通 `.php` 路径返回 404。
- `package.json` 返回 200。

以上说明的是扫描器缓解中的单次请求条件。若同一请求还命中其他特征，则会由相应的 jail 检测。普通 HTTP 请求也可能命中[现有的 HTTP 频率规则]({{< relref "/policies/services.md" >}}#http)。

这些只是采集源当前采用的规则，**不是适用于所有站点的通用推荐配置**。在自己的服务上使用类似规则前，应先检查正常业务需要访问的路径和 HTTP 方法。
