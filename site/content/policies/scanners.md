---
title: "スキャナー対策"
weight: 1
description: "一度の一致で永久 BAN する 9 個の Jail と、単独では検知しないリクエスト。"
---

以下の 9 個は、[共通設定](/policies/#スキャナー対策の共通設定)に従い、一度の検知で永久 BAN します。特定のパスや User-Agent へのアクセスも、収集元の運用上の遮断基準として扱います。アクセスがあっただけで、その製品の脆弱性や攻撃の成功を示すものではありません。

## 機密ファイルと VCS

`nginx-scanner-secrets` は、`.env`、`.git/config`、`.svn/entries`、クラウド認証ファイル、秘密鍵、履歴ファイル、設定のバックアップなどへの探索を対象にします。

このフィルターでは `/.well-known/acme-challenge/` を除外します。通常の公開ファイルの存在確認とは区別します。

## HTTP メソッド

`nginx-scanner-method` は、TRACE、CONNECT、指定した WebDAV・拡張メソッド、PRI、指定した壊れた・小文字のメソッドを対象にします。例として PROPFIND、MKCOL、LOCK、`GETT`、`get` などが含まれます。

通常の OPTIONS は CORS プリフライトに使われるため、このメソッド判定には含めません。このフィルターでは `/dav`、`/webdav`、`/remote.php` 配下を除外します。

## パストラバーサル

`nginx-scanner-traversal` は、`../` と指定したエンコード表現、システムのパスワードファイル、プロセス環境情報、Windows の設定ファイル、ヌル文字の探索シグネチャなどを対象にします。

通常の検索文字列に見える場合でも、URI 全体に指定シグネチャが含まれれば一致する条件があります。

## JNDI

`nginx-scanner-jndi` は、URI に含まれる `${jndi:` と指定したパーセントエンコード表現を対象にします。User-Agent や任意のヘッダー全体を網羅するルールではありません。

## SQL インジェクションのシグネチャ

`nginx-scanner-sqli` は、クエリー文字列がある URI を対象にします。`UNION SELECT`、`information_schema`、`sleep(...)`、`benchmark(...)`、ファイル入出力を狙う指定表現、指定した恒真条件などを検知します。

指定した区切りやパーセントエンコードを考慮します。SQL インジェクション全般を検知するものでも、アプリケーションの入力検証を代替するものでもありません。

## 製品・機器固有の探索パス

`nginx-scanner-cve` は、PHPUnit、Ignition、Actuator、Solr、VPN 装置、メール製品、管理コンソール、CGI、WordPress、診断用ページなどの指定パスへのアクセスを対象にします。

例として、PHPUnit の `eval-stdin.php`、`/_ignition/execute-solution`、`/actuator/env`、`/manager/html`、`/server-status`、`/xmlrpc.php` が含まれます。このフィルターでは Actuator の `/health`・`/info` を除外します。

これらの機能を正当に公開しているサービスでは正常なアクセスもあり得るため、パスだけを一般的な悪意の根拠にはできません。

## User-Agent

`nginx-scanner-ua` は、nikto、sqlmap、Nmap Scripting Engine、masscan、zgrab、Nuclei、WPScan、gobuster、ffuf、Nessus など、指定したスキャナー名を User-Agent 内で検知します。語の境界を考慮して照合します。

一般的な HTTP クライアントである curl、wget、`python-urllib` や、空の User-Agent は、それだけではこの条件に一致しません。User-Agent は自己申告なので、ツールの利用者や悪意を確定する情報にはなりません。

## バックドア名と応答コード

`nginx-scanner-backdoor` は、`shell`、`cmd`、`upload`、`alfa` など指定したファイル名と、PHP・ASP・JSP・CGI などの指定拡張子の組み合わせを対象にし、応答が **200 または 403** の場合に一致します。

PHP サイト以外を前提にしています。任意の `.php` への 404 を一律に BAN する条件ではありません。

## 認証パスの異常リクエスト

`nginx-auth-garbage` は、`/login`、`/signin`、`/api/auth` など指定した認証パスに対する 400、405、411、413、414、415、422、431、501 を対象にします。指定した認証パスへの PUT、DELETE、PATCH、PROPFIND も別条件で対象にします。

通常の POST `/login` に対する 401 は、この Jail の対象にしません。列挙したエラー応答は正常なクライアントでも発生し得るため、これも収集元の運用上の基準です。

## 単独では BAN 条件にしないもの

- 通常の OPTIONS、HEAD、PATCH。
- 通常の POST `/login` に対する 401。
- curl、wget、`python-urllib`、一般的なブラウザーの UA、空の UA。
- 通常の `.php` に対する 404。
- `package.json` に対する 200。

これはスキャナー対策における単独条件の説明です。同じリクエストが別のシグネチャに一致すれば、その Jail で検知されます。通常の HTTP リクエストでも、[既存の HTTP 回数判定](/policies/services/#http)に一致する場合があります。
