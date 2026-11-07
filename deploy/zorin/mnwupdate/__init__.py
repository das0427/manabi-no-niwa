# -*- coding: utf-8 -*-
"""まなびのにわ 更新の仕組み（serve.py の中で動く。Python 3.10 以上・標準ライブラリだけ）

設計: docs/expansion/updater-design.md

  common    エラー・置き場（Layout）・時刻・JSON の読み書き・設定
  manifest  版の情報（manabi-no-niwa-update.json）と部品の印（parts/<kind>.json）の確かめ・計画
  fetch     取得先（GitHub／試験用）・転送先の確認・版の情報と zip の取得
  install   zip の検査と展開・中身の確かめ・自己検査・入れ替え・片付け
  service   状態・設定・自動の確認の予定・更新の作業（別スレッド）・再起動の合図
  api       窓口（/__manabi/update/…）の振り分けと守り

外へ通信するのは fetch だけ。置き場の外には書かない（設計 2 章）。
"""

__all__ = ["common", "manifest", "fetch", "install", "service", "api"]
