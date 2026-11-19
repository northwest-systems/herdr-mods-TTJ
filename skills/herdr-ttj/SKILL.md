---
name: herdr-ttj
description: Herdr TTJ Modの導入、Project選択、timeline・canvas・listの利用、Task・TicketのCRUD、接続・theme・Jobのicon設定を案内する。Herdr上のTTJ UIを使う場合に使う。
---

# Herdr TTJ Mod

TTJCore 0.1.0とHerdr 0.1.15以降を使用する。Modリポジトリで、PowerShellはscripts/install.ps1、Linux・macOSはscripts/install.shを使う。標準接続ではCoreの初期化・起動をModが行う。手動のinit・serveを日常操作の前提にしない。

ユーザーの目的に合わせて操作を案内する。

- ProjectタブはCoreのProject名。右上の＋でProjectを作成し、ツールバーからTask、所属Taskを1つ選んでTicketと順序付きJobを作る。IDの手入力は不要。
- canvasはTaskが先頭でTicketへ分岐する。背景のdrag・wheelで移動し、＋／−・修飾キー付きwheel・pinchで拡大縮小する。表示・位置はProjectごとに保持する。
- カードやlistの行を開いて詳細を読む。Ticket詳細のJobは全件を実行順に並べる。Jobをクリックするとcriteria・instructions・result・Runを確認できる。nametagはhoverでID、クリックでコピー。
- 編集・statusの変更・削除は詳細の右上。操作者は設定、reasonは操作ごとに入力する。削除は配下をcompletedまたはcanceledにしてから行う。conflict時は最新内容を読み直す。
- ProjectのKnowledgeは本のアイコンから開く。TicketのhandoffsはTicket詳細、resumeも同じ詳細で確認する。
- 設定では標準／custom接続、操作者、theme、iconとファイルの対応を扱う。Jobごとにjob・github・custom.starなどのkeyを指定する。任意keyはSVG／PNGのpathへ対応付け、提供元の利用条件に従う。

別タブはタブを表示するlayoutで`herdr-app do tab.new --name TTJ --mod ttj`、同じタブの右側paneは`herdr-app do pane.split --direction right --mod ttj`を使う。

横配置は`herdr-app do layout.switch --name ttj-side`、下配置は`--name ttj-bottom`、専用画面は`--name ttj`を使う。別のOSウインドウは別HERDR_APP_HOMEへModを配置して起動し、同じTTJCore profileへ接続する。HERDR_APP_HOMEの変更はHerdrのSpace・terminalの隔離を意味しない。

LLMがCoreのrecord・eventを扱うときは、[TTJCore protocol](https://github.com/northwest-systems/TTJCore/blob/fa6da9588148c2c70590b17eacd93945165a420a/skills/ttjcore/references/protocol.md)を読む。TTJCore CLI／RPCへ直接接続し、UIから状態を取得しない。実行側がCoreに記録した変更がModへ反映される。
