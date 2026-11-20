---
name: herdr-ttj
description: Herdr TTJ Modの導入、Project選択、timeline・canvas・listの利用、Task・TicketのCRUD、接続・theme・Jobのicon設定を案内する。Herdr上のTTJ UIを使う場合に使う。
---

# Herdr TTJ Mod

TTJCore 0.1.1とHerdr 0.1.15以降を使用する。Modリポジトリで、PowerShellはscripts/install.ps1、Linux・macOSはscripts/install.shを使う。標準接続ではCoreの初期化・起動をModが行う。手動のinit・serveを日常操作の前提にしない。

ユーザーの目的に合わせて操作を案内する。

- ProjectタブはCoreのProject名。右上の＋でProjectを作成し、ツールバーからTask、所属Taskを1つ選んでTicketと順序付きJobを作る。IDの手入力は不要。
- canvasはTaskが先頭でTicketへ分岐し、同じノードから出る線は共通の幹を使う。背景のdrag・wheelで移動し、＋／−・修飾キー付きwheelで拡大縮小する。表示・位置はProjectごとに保持する。
- canvas・listのフィルターアイコンは、未着手・作業中・障害のTicketへ至る前提経路に絞る。完了・待機・中止・保留の中間点と未終了TicketのTaskを残し、終了・待機の末尾と未終了の末端がすべて保留のbranchを省略する。再度押すと全表示に戻り、選択はProjectごとに保持する。timelineの履歴は全件表示する。
- カードやlistの行を開いて詳細を読む。Ticket詳細のJobは全件を実行順に並べる。Jobをクリックするとcriteria・instructions・result・Runを確認できる。nametagはhoverでID、クリックでコピー。
- 編集・statusの変更・削除は詳細の右上。TaskはカードとTask一覧にも削除ボタンがある。Task自身と配下がcompletedまたはcanceledの場合だけ、理由不要の確認モーダルから全配下を物理削除する。要約履歴とProjectのKnowledgeは残し、他TaskのTicketから参照中なら拒否する。操作者は設定し、Task削除以外の変更はreasonを入力する。Project・Ticketは論理削除。conflict時は最新内容を読み直す。
- ProjectのKnowledgeは本のアイコンから開く。TicketのhandoffsはTicket詳細、resumeも同じ詳細で確認する。
- 設定では標準／custom接続、操作者、theme、iconとファイルの対応を扱う。Jobごとにjob・github・custom.starなどのkeyを指定する。任意keyはSVG／PNGのpathへ対応付け、提供元の利用条件に従う。

タブバーは単色アイコン＋TTJボタンで開閉し、隣の矢印から右側・下側・pane右／下分割・別OSウインドウを選ぶ。paneは分割元を選択してから開き、同じタブに既存TTJ paneがある場合はそこへ移動する。未着手はグレー、中止はピンク系で区別し、凡例をフッターに示す。

横配置は`herdr-app do layout.switch --name ttj-side`、下配置は`--name ttj-bottom`、専用画面は`--name ttj`も使える。別OSウインドウのボタンはHerdr設定フォルダー内のttj-windowへModを配置して起動し、初回に接続・表示設定をコピーする。次回以降はウインドウ側の設定を保持する。HerdrのSpace・terminalとTTJCoreのデータは共有し、ウインドウを閉じてもCoreは止めない。

LLMがCoreのrecord・eventを扱うときは、[TTJCore protocol](https://github.com/northwest-systems/TTJCore/blob/b43abe9bc699345b966904f25b50c9c101209f5b/skills/ttjcore/references/protocol.md)を読む。Task削除はtask.purge対応Coreを使う。TTJCore CLI／RPCへ直接接続し、UIから状態を取得しない。実行側がCoreに記録した変更がModへ反映される。
