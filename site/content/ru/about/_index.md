---
title: "О сервисе"
weight: 4
description: "Как устроены сбор, хранение и публикация данных, а также исходный код и лицензии."
---

На этой странице описано, как собираются, хранятся и публикуются данные, а также приведены исходный код и лицензии.

## Архитектура

```text
Fail2ban (FreeBSD / PF, Linux / nftables)
  → f2b-report: HTML + JSON
  → submission queue: HTTPS, retries, heartbeat when nothing changed
  → f2b-ingest Worker: input validation, normalization, diff application
  → Cloudflare D1: per-jail collection state and IP observation history
  → f2b-api Worker: public GET API and this static site
```

Worker сбора и публичный Worker разделены и используют одну и ту же базу данных D1. Публичный API не может отправлять данные или управлять межсетевым экраном какого-либо сервера.

Сайт доступен на японском, английском, русском языках, а также на упрощённом и традиционном китайском. Запросы к корню направляются в `/ja/`, `/en/`, `/ru/`, `/zh-cn/` или `/zh-tw/` в зависимости от сохранённой настройки, языка браузера и страны подключения. Выбор языка в навигационной панели сохраняет предпочтение в cookie.

Существующие HTML-отчёты продолжают формироваться. Этот сайт описывает API и публичные политики и ссылается на сами отчёты.

## Исходный код

- [f2b-api](https://github.com/haturatu/f2b-api): API, спецификация OpenAPI и этот сайт Hugo.
- [f2b-report](https://github.com/haturatu/f2b-report): разбор состояния Fail2ban и вывод HTML/JSON.

Содержимое Hugo и конфигурация темы находятся в `f2b-api/site/`. Сборка сайта и логика доставки Worker управляются в одном репозитории.

## Лицензия

Исходный код f2b-api и оригинальная документация распространяются по [лицензии BSD 2-Clause](https://github.com/haturatu/f2b-api/blob/master/LICENSE). Copyright (c) 2026, haturatu

Поиск по сайту использует FlexSearch, распространяемый по [лицензии Apache 2.0](/licenses/flexsearch.txt). Текст лицензии и уведомление об авторских правах сохраняются в поставляемых ресурсах.
