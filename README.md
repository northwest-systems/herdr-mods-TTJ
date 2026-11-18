# Herdr TTJ Mod

Projectを選択し、タイムライン・Task／Ticketツリー・リストのいずれかをウインドウ全体に表示するHerdr Modです。リストはTask／Ticketを切り替えられます。表示形式とリストの種類はProjectごとに保持します。

行には目標・種類・状態など最小限の情報を表示し、クリックすると詳細モーダルを開きます。Ticketの詳細からJobも確認できます。操作ボタンはアイコンとツールチップを使い、横並びのボタン・チップは種類ごとに等幅です。Project選択には名前を表示します。

常駐する[TTJCore](https://github.com/northwest-systems/TTJCore)から変更通知を待ち受け、履歴や実行状態を更新します。作成・編集・状態変更はCoreのCLIで行います。

Herdr 0.1.15のネイティブGPUIを使用します。Windows・Linux・macOSが対象です。Webサーバーやブラウザー、JavaScriptのランタイム依存パッケージは不要です。

## 準備

1. TTJCoreをビルドし、実行ファイルをPATHから起動できるようにします。
2. TTJCoreのREADMEに従ってDBを初期化し、ttjcore serveを起動しておきます。別の端末からCoreのCLIでProject・Task・Ticketを作成します。
3. TTJCORE_HOMEを指定する場合は、serve・CLI・Herdrで同じ値を使います。Herdrが必要なのはCoreへの接続設定で、DB接続URLはserveにだけ設定します。

ModはHerdrのexec APIでTTJCore CLIを起動し、JSON-RPC応答を標準出力から受け取ります。外部プログラムを実行するModなので、信頼できるTTJCoreを指定してください。

## インストール

設定フォルダーはHERDR_APP_HOME、XDG_CONFIG_HOME/herdr-app、$HOME/.config/herdr-appの順で選びます。既存のttj Modやレイアウトがある場合は、内容を確認してから更新してください。

PowerShell:

~~~powershell
$herdrAppHome = if ($env:HERDR_APP_HOME) {
    $env:HERDR_APP_HOME
} elseif ($env:XDG_CONFIG_HOME) {
    Join-Path $env:XDG_CONFIG_HOME 'herdr-app'
} else {
    Join-Path $HOME '.config/herdr-app'
}
New-Item -ItemType Directory -Force -Path (Join-Path $herdrAppHome 'mods'), (Join-Path $herdrAppHome 'layouts') | Out-Null
Copy-Item -LiteralPath 'mods/ttj' -Destination (Join-Path $herdrAppHome 'mods/ttj') -Recurse
Copy-Item -LiteralPath 'layouts/ttj.json' -Destination (Join-Path $herdrAppHome 'layouts/ttj.json')
herdr-app check (Join-Path $herdrAppHome 'mods/ttj')
herdr-app do layout.switch --name ttj
~~~

Linux・macOS:

~~~sh
herdr_app_home="$HERDR_APP_HOME"
if [ -z "$herdr_app_home" ]; then
    if [ -n "$XDG_CONFIG_HOME" ]; then
        herdr_app_home="$XDG_CONFIG_HOME/herdr-app"
    else
        herdr_app_home="$HOME/.config/herdr-app"
    fi
fi
mkdir -p "$herdr_app_home/mods" "$herdr_app_home/layouts"
cp -R mods/ttj "$herdr_app_home/mods/ttj"
cp layouts/ttj.json "$herdr_app_home/layouts/ttj.json"
herdr-app check "$herdr_app_home/mods/ttj"
herdr-app do layout.switch --name ttj
~~~

## 接続設定

レイアウトのcontent.propsで次を指定できます。

| 項目 | 既定値 | 用途 |
|---|---|---|
| command | ttjcore | 実行ファイル名またはそのパス |
| args | [] | callより前に渡す固定引数 |
| project | 未指定 | 初期表示するProject ID |

commandとargsは別々に渡し、シェルを介して実行しません。TTJCORE_HOMEを変更した場合はHerdrをその環境で再起動してください。WindowsからWSL上のCoreへ接続する場合は、commandをwsl.exeにし、argsで実行ディレクトリ・TTJCORE_HOME・Coreの実行ファイルを明示します。

~~~json
{
  "content": {
    "mod": "ttj",
    "props": {
      "command": "/path/to/ttjcore",
      "args": [],
      "project": "demo-project"
    }
  }
}
~~~

Coreに接続できない場合はエラーを表示します。まずserveの起動状態とTTJCORE_HOMEの一致を確認してください。同じProjectの取得済みデータはエラー表示とともに残し、別Projectを選ぶと取得済みデータを消して読み直します。削除済み作業はツリー・リストから除外され、履歴には残ります。

Modはevents.waitで変更を待ち、通知があったときにスナップショットを更新します。詳細モーダルも更新対象です。LLM側の監視・通知受信はCoreのevents.wait／events.subscribeを直接使ってください。UIからLLMへ状態を転送する機能はありません。

## 開発・検証

テストにはNode.js 24以降の標準テストランナーを使います。npm installは不要です。

~~~sh
node --test
herdr-app check mods/ttj
~~~

接続のない初期画面のチェックに加え、TTJCoreに接続したHerdr画面でProjectごとの表示切り替え、Task／Ticketリスト、折り畳み、詳細モーダル、履歴、CLI更新の反映、接続エラーを確認してください。

## ライセンス

[Apache-2.0](LICENSE)。[Herdr Modの仕様](https://github.com/herdrdev/herdr-app/blob/master/docs/mods.md)に従います。