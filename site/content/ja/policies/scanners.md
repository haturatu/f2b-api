---
title: "スキャナー対策"
weight: 1
description: "一度の一致で永久 BAN にする 9 つの Jail と、誤検知を避けるための除外条件。"
---

スキャナー対策の Jail には、**指定した特徴に 1 回一致すると永久 BAN する**ものがあります。

SSH の認証失敗を何回か数える方式とは違い、特定のファイルを探すアクセスや、スキャンツールの User-Agent などを対象にしています。

ただし、ログに一致したからといって、実際に攻撃が成功したことまで分かるわけではありません。正当なリクエストと重なる条件もあるので、収集元の運用に合わせて除外しています。

共通の `maxretry = 1`、`bantime = -1` などの設定は[遮断ポリシー]({{< relref "/policies/_index.md" >}}#スキャナー対策の共通設定)を参照してください。

## 機密ファイルと VCS

`nginx-scanner-secrets` は、公開されていると困るファイルを探すリクエストを対象にします。

例えば `.env`、`.git/config`、`.svn/entries`、クラウドの認証情報、秘密鍵、履歴ファイル、設定のバックアップなどです。

`/.well-known/acme-challenge/` は証明書の取得・更新に使うので、この条件から除外しています。通常の公開ファイルの存在確認と、こうしたファイルの探索は分けて扱っています。

## HTTP メソッド

`nginx-scanner-method` は、TRACE、CONNECT、指定した WebDAV・拡張メソッド、PRI、壊れたメソッド名や小文字のメソッドを対象にします。

例えば PROPFIND、MKCOL、LOCK、`GETT`、`get` などです。

ただし、OPTIONS は CORS のプリフライトに普通に使われるため対象にしていません。また、WebDAV を正当に使うサービスもあるので、`/dav`、`/webdav`、`/remote.php` 配下は除外しています。

## パストラバーサル

`nginx-scanner-traversal` は、`../` とそのエンコード表現など、ファイルパスをたどろうとする特徴を検知します。

システムのパスワードファイル、プロセスの環境情報、Windows の設定ファイル、ヌル文字なども対象です。

URI 全体を見る条件もあるので、正常な検索文字列の一部に同じパターンが入れば一致する可能性があります。

## JNDI

`nginx-scanner-jndi` は URI 内の `${jndi:` と、指定したパーセントエンコード表現を検知します。

ログに残るすべての HTTP ヘッダーを調べているわけではありません。例えば User-Agent に含まれるあらゆる JNDI 表現を網羅するルールではなく、**対象は URI に限定**しています。

## SQL インジェクションのシグネチャ

`nginx-scanner-sqli` は、クエリー文字列が付いた URI から SQL インジェクションによく見られる表現を検知します。

`UNION SELECT`、`information_schema`、`sleep(...)`、`benchmark(...)`、ファイルの読み書きを狙う表現、恒真条件などを対象にしています。区切り文字や一部のパーセントエンコードも考慮しています。

もちろん、SQL インジェクションをすべて検知できるわけではありません。アプリケーション側の入力検証やパラメーター化した SQL の代わりにもなりません。

## 製品・機器固有の探索パス

`nginx-scanner-cve` は、PHPUnit、Ignition、Actuator、Solr、VPN 装置、メール製品、管理コンソール、CGI、WordPress などの指定パスを対象にします。

例えば以下のようなものです。

- `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php` に類する PHPUnit の `eval-stdin.php`
- `/_ignition/execute-solution`
- `/actuator/env`
- `/manager/html`、`/server-status`、`/xmlrpc.php`

Actuator の `/health` と `/info` は通常の監視にも使うため除外しています。

特定の URL にアクセスしただけで、脆弱性を悪用した証拠になるわけではありません。対象製品を正当に公開している場合は誤検知の可能性があります。

## User-Agent

`nginx-scanner-ua` は、nikto、sqlmap、Nmap Scripting Engine、masscan、zgrab、Nuclei、WPScan、gobuster、ffuf、Nessus など、指定したスキャンツール名を User-Agent から検知します。

単に文字列がどこかに含まれるかだけではなく、語の境界も考慮しています。

一方、curl、wget、`python-urllib`、空の User-Agent などは、それだけではこの Jail の検知条件になりません。

そもそも User-Agent は自由に名乗れるものです。名前が一致しても、そのツールを使っている人が誰なのかまでは分かりません。

## バックドア名と応答コード

`nginx-scanner-backdoor` は、`shell`、`cmd`、`upload`、`alfa` などの名前と、PHP・ASP・JSP・CGI などの拡張子の組み合わせを対象にします。

さらに、**応答が 200 または 403 の場合**に一致します。任意の `.php` への 404 を片っ端から BAN する条件ではありません。

この Jail は PHP サイト以外を想定した設定なので、PHP を普通に公開している環境へそのまま持ち込むべきではありません。

## 認証パスの異常リクエスト

`nginx-auth-garbage` は、`/login`、`/signin`、`/api/auth` など指定した認証パスへの異常なリクエストを対象にします。

応答コードでは 400、405、411、413、414、415、422、431、501 が対象です。また、同じ認証パスへの PUT、DELETE、PATCH、PROPFIND も別条件で検知します。

ただし、通常の `POST /login` が 401 を返しただけでは、この Jail の対象にはなりません。エラー応答自体は正常なクライアントでも起こるので、あくまで運用上の基準です。

## 何でも BAN しているわけではない

誤検知しやすいものは、単独ではスキャナー扱いしないようにしています。

- 通常の OPTIONS、HEAD、PATCH
- 通常の `POST /login` に対する 401
- curl、wget、`python-urllib`、ブラウザー、空の User-Agent
- 通常の `.php` への 404
- `package.json` に対する 200

ただし、別のシグネチャにも一致した場合は、その Jail で BAN されることがあります。通常の HTTP アクセスであっても、[HTTP の回数判定]({{< relref "/policies/services.md" >}}#http)の条件に入る場合があります。

ここで紹介した条件は、収集元で採用しているルールの説明です。**一般的なサイトすべてに対する推奨ルールではありません。**
