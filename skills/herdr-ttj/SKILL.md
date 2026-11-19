---
name: herdr-ttj
description: Herdr TTJ Modの導入、Project選択、タイムライン・キャンバス・リストの利用、Task・TicketのCRUD、接続・テーマ・Jobアイコンキーの設定を案内する。Herdr上のTTJ画面を使う場合に使う。
---

# Herdr TTJ Mod

[README](../../README.md)のクイックスタートでCore 0.1.0とModを導入する。PowerShellはscripts/install.ps1、Linux・macOSはscripts/install.shで配置する。標準接続ではCoreの初期化・起動はModが行う。手動のinit・serveを日常の前提にしない。

ユーザーの目的に合わせて操作を案内する。

- ProjectタブはCoreのProject名。右上の＋でProjectを作成し、ツールバーからTask、所属Taskを1つ選んでTicketと順序付きJobを作る。IDの手入力は不要。
- キャンバスはTaskが先頭でTicketへ分岐する。背景ドラッグ・ホイールで移動し、＋／−・修飾キー付きホイール・ピンチで拡大縮小する。表示・位置はProjectごとに保持する。
- カードやリスト行を開いて詳細を読む。Ticket詳細のJob一覧は全件を順番に並べ、Jobをクリックすると条件・手順・結果・実行履歴が分かる。nametagはホバーでID、クリックでコピー。
- 編集・状態変更・削除は詳細の右上。操作者は設定、変更理由は操作ごとに入力する。削除は配下を完了または中止してから行う。競合時は最新内容を再読込する。
- Projectの記録は本のアイコンからknowledgeへ、Ticketの申し送りはTicket詳細へ進む。
- 設定は標準／カスタム接続、操作者、テーマ、アイコン対応。Jobごとにjob・github・custom.starや任意のキーを指定する。任意キーは設定でSVG／PNGパスへ対応付け、提供元の利用条件に従う。

横配置はttj-side、下配置はttj-bottom、専用画面はttjレイアウトを使う。別OSウインドウは別HERDR_APP_HOMEで起動し、同じCoreプロファイルへ接続する。手順はREADMEの「Herdrと並べて開く」を読む。

LLMが作業状態を読む・変更する場合はTTJCore CLI／RPCを直接使う。UIから取得したり、UIを介して稼働中エージェントの端末へ命令を送ったりしない。実行側がCoreに記録した変更がModへ反映される。
