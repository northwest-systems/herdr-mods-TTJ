# Herdr TTJ Mod

## 概要

TTJCore 0.1.0を使い、Projectごとのタイムライン・TaskからTicketへ分岐するキャンバス・Task／Ticketリストを切り替えるHerdr Modです。バージョンは0.1.0です。Windows・Linux・macOSのHerdr 0.1.15以降を対象にします。

Project・Task・Ticketの作成・参照・編集・論理削除、状態変更、Projectのknowledge作成・参照に対応します。IDはCoreが自動発行します。Ticketは1つのTaskに所属し、Jobの構成・順序はTicket作成後に固定されます。

Coreが確定した変更を待ち受け、カード・一覧・開いている詳細に反映します。Coreとの通信はローカルIPCです。Webサーバーやブラウザー、npmの実行時依存パッケージは使用しません。

## クイックスタート

1. [TTJCoreのクイックスタート](https://github.com/northwest-systems/TTJCore#クイックスタート)に従ってCore 0.1.0をインストールし、Herdrから`ttjcore`を起動できるPATHを用意します。インストール時にはRust・Cコンパイラーを使いますが、Modの利用時には不要です。
2. Herdrをインストールし、次のコマンドでModを配置します。インストールスクリプトはこのリポジトリのModと3つのレイアウトをHerdrの設定フォルダーへコピーします。パッケージのダウンロードは行いません。同名のファイルは更新されます。

```sh
git clone https://github.com/northwest-systems/herdr-mods-TTJ.git
cd herdr-mods-TTJ
git checkout v0.1.0
```

PowerShell 7:

```powershell
pwsh -File scripts/install.ps1
herdr-app do layout.switch --name ttj
```

Linux・macOS:

```sh
sh scripts/install.sh
herdr-app do layout.switch --name ttj
```

設定フォルダーは`HERDR_APP_HOME`、`XDG_CONFIG_HOME/herdr-app`、`$HOME/.config/herdr-app`の順で選びます。CoreをPATHへ追加する代わりに、PowerShellでは`-CorePath /path/to/ttjcore.exe`、shでは第1引数にCore実行ファイルを指定すると、Modのbinへ同梱できます。

3. 右上の＋でProjectを作り、Projectを選択します。ツールバーのTask作成・Ticket作成アイコンから計画を登録します。操作者は設定画面で変更できます。変更操作には理由を入力します。
4. 標準接続はCoreの初期化・起動・接続を自動で行います。Coreのinit・serve・プロファイルの知識は日常操作に必要ありません。接続できない場合は設定アイコンから実行ファイルや接続先を確認します。

## フォルダ構造

```text
mods/ttj/
  main.js     Herdrの画面・入力・詳細モーダル
  model.js    キャンバス配置・Jobの表示範囲・履歴表示
  client.js   Coreの自動起動とJSON-RPC呼び出し
  icons/      操作用アイコン
  assets/octicons/  Job・GitHub・nametagの例とライセンス
  mod.json    Herdr Modの設定
layouts/
  ttj.json        TTJ専用ウインドウ向け
  ttj-side.json   Herdrの横にTTJ
  ttj-bottom.json Herdrの下にTTJ
scripts/      PowerShell・shのインストール処理
skills/herdr-ttj/ LLM向け利用スキル
tests/        接続・履歴・配置・Job表示のテスト
```

## 画面の使い方

| 操作 | 表示・動作 |
|---|---|
| Projectタブ | CoreのProject名を表示。表示形式・リスト種別・キャンバス位置をProjectごとに保持 |
| タイムライン | 実行・状態変更の履歴。行をクリックすると操作者・理由・変更内容 |
| キャンバス | Taskが先頭ノードとなり、Ticketの依存関係を矢印で表示 |
| リスト | Task／Ticketを切り替え。行をクリックして詳細 |
| カード／行 | タイトル・概要・状態を簡潔に表示。詳細は固定サイズのモーダルでスクロール |
| Jobアイコン | 状態色の太いリング。クリックで手順・条件・結果・実行履歴 |
| nametag | ホバーでID、クリックでコピー |
| 本のアイコン | 選択Projectのknowledge。Ticketの申し送りはTicket詳細 |
| 設定 | 操作者、接続、テーマ、アイコンキーとファイルの対応 |

Task・Ticketカードは内容にかかわらず同じ幅・高さです。キャンバスは背景のドラッグ・ホイールで移動し、＋／−、Ctrlまたはプラットフォーム修飾キー付きホイール、ピンチで拡大縮小します。リセットで初期表示に戻ります。

Jobは左詰めで最大8個です。8個を超える場合、作業中のJobと最大6個の前工程、次の1個を表示します。最後のJobが作業中なら7個です。作業中がなければ最初の非終端Job、全て終端なら最後を基準にします。Job詳細一覧には全件を上から実行順に表示します。

Taskの目標・完了条件・期限、Ticketの担当・依存・申し送り・再開条件・優先度を編集できます。Ticketの目標とJob計画は固定です。概要・JobアイコンキーはTTJ記録本体とは別の表示情報です。並行する変更と競合した場合は最新内容を読み直します。削除するには対象と配下の作業を完了または中止してください。削除後もCoreに履歴と依存参照が残ります。

## 接続・テーマ・アイコン

標準接続は、同梱した`mods/ttj/bin/ttjcore`（Windowsは.exe）、次にPATHの`ttjcore`を使います。カスタム接続では実行ファイル・固定引数のJSON配列・プロファイル・自動起動の有無を指定します。引数はシェルを介さず渡します。任意のPostgreSQLはCore側で設定し、ModはそのCoreのプロファイルへ接続します。

テーマはHerdrに従う／ライト／ダークを選べます。ライトのアクセントは濃い緑、ダークは明るい黄緑です。テーマ・接続・操作者・アイコン対応はHerdrアプリ内の共通設定です。

Jobごとに`job`、`github`、`custom.star`などのキーを指定します。設定のJSONで任意キーをSVG／PNGのパスへ対応付けられます。相対パスはHerdrの設定フォルダーから参照します。

```json
{"custom.build":"mods/ttj/assets/build.svg"}
```

同梱例はOcticonsのchecklist・GitHubマーク・star・tagです。GitHubマークはGitHub関連のJobを示し、PR専用アイコンではありません。キー`id.copy`はコピーアイコンに使用します。ライセンスとGitHubブランド上の扱いは[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)を参照してください。追加するアイコンの利用条件は各提供元に従ってください。

## Herdrと並べて開く

`herdr-app do layout.switch --name ttj-side`で横、`--name ttj-bottom`で下、`--name ttj`で専用画面に切り替えます。レイアウトの`ttj-panel`をリサイズできます。

別のOSウインドウで使う場合は、そのウインドウ用の`HERDR_APP_HOME`へModを配置してHerdrを起動します。同じOSユーザー・Coreプロファイルなら、作業側のHerdrと同じCoreへ接続できます。

```powershell
$env:HERDR_APP_HOME = Join-Path $HOME '.config/herdr-ttj'
pwsh -File scripts/install.ps1
herdr-app
```

```sh
HERDR_APP_HOME="$HOME/.config/herdr-ttj" sh scripts/install.sh
HERDR_APP_HOME="$HOME/.config/herdr-ttj" herdr-app
```

別ウインドウでも初回はttjレイアウトを選んでください。異なるHerdrアプリ設定フォルダー間では表示設定を共有しません。

## LLMとの連携・開発

LLMはCoreの`events.wait`で監視するか、`rpc`の`events.subscribe`で通知を受け取ります。UIから取得する必要はありません。実行エージェントが`run.start`・`run.finish`・`status.set`で状態を記録するとModへ反映されます。CoreはCodex・Claude Codeのプロセスを自動で検出・操作しません。

利用スキルは[skills/herdr-ttj/SKILL.md](skills/herdr-ttj/SKILL.md)です。テストはNode.js 24以降の標準ランナーを使い、npm installは不要です。Herdrのcheckは生成した型定義を使ってModを確認します。

```sh
node --test
herdr-app check mods/ttj
```

## ライセンス

[Apache-2.0](LICENSE)。同梱アイコンには[第三者のライセンス・ブランド条件](THIRD_PARTY_NOTICES.txt)が適用されます。
