# Herdr TTJ Mod

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="mods/ttj/assets/app-icon.png">
  <img src="mods/ttj/assets/app-icon-light.png" alt="TTJ" width="96" height="96">
</picture>

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
4. 標準接続はCoreの初期化・起動・接続を自動で行います。標準接続ではinit・serveを手動実行したり、profileを指定したりする必要はありません。接続できない場合は設定アイコンから実行ファイルや接続先を確認します。

## 使い方ガイド

[画像付き使い方ガイド](docs/usage-guide.md)で、横配置・下配置・別タブ・pane分割・別ウインドウで開く方法と、Project・Task・Ticket・Jobの操作を説明しています。

[App icon](docs/app-icon.md)は、ライト用・ダーク用・単色の黒・白を用意した512×512 pxの透過PNGです。

## フォルダ構造

配布対象を`tree /A`で表示した構成です。ファイルまで含む一覧は[folder-structure.txt](docs/folder-structure.txt)を参照してください。`.git`とローカルの生成物は含みません。

```text
herdr-mods-TTJ/
+---.github
|   \---workflows
+---docs
|   \---assets
|       \---guide
+---layouts
+---mods
|   \---ttj
|       +---assets
|       |   \---octicons
|       \---icons
+---scripts
+---skills
|   \---herdr-ttj
\---tests
```

## 開発

Coreのinterfaceは[TTJCore protocol](https://github.com/northwest-systems/TTJCore/blob/bf3efeffb76265910407c33b5489bcfb767a2d67/skills/ttjcore/references/protocol.md)、LLM向けの入口は[skills/herdr-ttj/SKILL.md](skills/herdr-ttj/SKILL.md)です。

テストはNode.js 24以降の標準runnerを使い、npm installは不要です。Herdrのcheckは生成した型定義を使ってModを確認します。

```sh
node --test
herdr-app check mods/ttj
```

## ライセンス

[Apache-2.0](LICENSE)。同梱アイコンには[第三者のライセンス・ブランド条件](THIRD_PARTY_NOTICES.txt)が適用されます。
