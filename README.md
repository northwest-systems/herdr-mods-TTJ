# Herdr TTJ Mod

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="mods/ttj/assets/app-icon.png">
  <img src="mods/ttj/assets/app-icon-light.png" alt="TTJ" width="96" height="96">
</picture>

## 概要

TTJCore 0.1.0を使い、Projectごとのタイムライン・TaskからTicketへ分岐するキャンバス・Task／Ticketリストを切り替えるHerdr Modです。バージョンは0.1.0です。Windows・Linux・macOSのHerdr 0.1.15以降を対象にします。

Project・Task・Ticketの作成・参照・編集・論理削除、状態変更、ProjectのKnowledge作成・参照に対応します。IDはCoreが自動発行します。Ticketは1つのTaskに所属し、Jobの構成・順序はTicket作成後に固定されます。

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

キャンバス・リストは、ヘッダーのフィルターアイコンで「作業対象のみ」と全表示を切り替えられます。作業対象は未着手・作業中のTask／Ticketです。表示条件はProjectごとに保持します。

## 使い方ガイド

[画像付き使い方ガイド](docs/usage-guide.md)で、横配置・下配置・別タブ・pane分割・別ウインドウで開く方法と、Project・Task・Ticket・Jobの操作を説明しています。

[App icon](docs/app-icon.md)は、ライト用・ダーク用・単色の黒・白を用意した512×512 pxの透過PNGです。

## フォルダ構造

Linuxの`tree`形式で、配布対象のフォルダと末端ファイルを示します。`.git`とローカルの生成物は含みません。[folder-structure.txt](docs/folder-structure.txt)にも同じ一覧を記載しています。

```text
herdr-mods-TTJ/                         # Herdr用TTJ Mod
├── .github/                            # GitHubの設定
│   └── workflows/                      # GitHub Actions
│       └── ci.yml                      # ビルド・テストのCI
├── docs/                               # 使い方・配布資料
│   ├── assets/                         # ドキュメント用画像
│   │   └── guide/                      # 表示方法の配置図
│   │       ├── open-bottom.png         # 下配置の配置図
│   │       ├── open-bottom.svg         # 下配置の配置図ソース
│   │       ├── open-pane.png           # pane分割の配置図
│   │       ├── open-pane.svg           # pane分割の配置図ソース
│   │       ├── open-side.png           # 横配置の配置図
│   │       ├── open-side.svg           # 横配置の配置図ソース
│   │       ├── open-tab.png            # 別タブの配置図
│   │       ├── open-tab.svg            # 別タブの配置図ソース
│   │       ├── open-window.png         # 別ウインドウの配置図
│   │       └── open-window.svg         # 別ウインドウの配置図ソース
│   ├── app-icon.md                     # 共通アイコンの一覧
│   ├── folder-structure.txt            # コメント付きの全ファイル構造
│   └── usage-guide.md                  # 画像付き使い方ガイド
├── layouts/                            # Herdrのレイアウト
│   ├── ttj-bottom.json                 # Herdrの下に表示
│   ├── ttj-side.json                   # Herdrの横に表示
│   └── ttj.json                        # TTJ専用画面
├── mods/                               # Herdr Mod
│   └── ttj/                            # TTJのUI
│       ├── assets/                     # 配布する共通アイコン・Octicons
│       │   ├── octicons/               # GitHubのOcticons
│       │   │   ├── checklist-16.svg    # Jobの標準アイコン
│       │   │   ├── LICENSE             # OcticonsのMITライセンス
│       │   │   ├── mark-github-16.svg  # GitHubのマーク
│       │   │   ├── SOURCES.json        # Octiconsの取得元
│       │   │   ├── star-16.svg         # starアイコン
│       │   │   └── tag-16.svg          # ID用のnametag
│       │   ├── app-icon-black.png      # 単色・黒の透過PNG
│       │   ├── app-icon-light.png      # ライト用の透過PNG
│       │   ├── app-icon-white.png      # 単色・白の透過PNG
│       │   └── app-icon.png            # ダーク用の透過PNG
│       ├── icons/                      # 操作・表示用のSVGアイコン
│       │   ├── arrowhead.svg           # キャンバスの矢じりのアイコン
│       │   ├── back.svg                # 戻るのアイコン
│       │   ├── book.svg                # Project Knowledgeのアイコン
│       │   ├── close.svg               # 閉じるのアイコン
│       │   ├── edit.svg                # 編集のアイコン
│       │   ├── filter.svg              # 作業対象の表示切替アイコン
│       │   ├── folder.svg              # Projectの詳細のアイコン
│       │   ├── list.svg                # リスト表示のアイコン
│       │   ├── minus.svg               # 縮小のアイコン
│       │   ├── plus.svg                # 追加・拡大のアイコン
│       │   ├── refresh.svg             # 再接続のアイコン
│       │   ├── reset.svg               # 表示をリセットのアイコン
│       │   ├── save.svg                # 保存のアイコン
│       │   ├── settings.svg            # 設定のアイコン
│       │   ├── status.svg              # status変更のアイコン
│       │   ├── task.svg                # Task作成のアイコン
│       │   ├── ticket.svg              # Ticket作成のアイコン
│       │   ├── timeline.svg            # タイムライン表示のアイコン
│       │   ├── trash.svg               # 論理削除のアイコン
│       │   └── tree.svg                # キャンバス表示のアイコン
│       ├── client.js                   # Coreへの接続・呼び出し
│       ├── main.js                     # 画面・詳細・CRUD・テーマ連動
│       ├── mod.json                    # Herdr Modの設定
│       └── model.js                    # タイムライン・キャンバス・Job表示の計算
├── scripts/                            # インストーラー
│   ├── install.ps1                     # Windows用インストーラー
│   └── install.sh                      # Linux・macOS用インストーラー
├── skills/                             # LLM向け利用スキル
│   └── herdr-ttj/                      # Herdr Modの利用スキル
│       └── SKILL.md                    # LLM向けの導入・操作手順
├── tests/                              # 自動テスト
│   └── viewer.test.js                  # client・表示計算のテスト
├── .gitignore                          # Gitの除外設定
├── LICENSE                             # Apache-2.0ライセンス
├── package.json                        # package情報・Node.jsのテストコマンド
├── README.md                           # 概要・クイックスタート・フォルダ構造
└── THIRD_PARTY_NOTICES.txt             # 同梱アイコンのライセンス・ブランド条件
```

## 開発

Coreのinterfaceは[TTJCore protocol](https://github.com/northwest-systems/TTJCore/blob/fa6da9588148c2c70590b17eacd93945165a420a/skills/ttjcore/references/protocol.md)、LLM向けの入口は[skills/herdr-ttj/SKILL.md](skills/herdr-ttj/SKILL.md)です。

テストはNode.js 24以降の標準runnerを使い、npm installは不要です。Herdrのcheckは生成した型定義を使ってModを確認します。

```sh
node --test
herdr-app check mods/ttj
```

## ライセンス

[Apache-2.0](LICENSE)。同梱アイコンには[第三者のライセンス・ブランド条件](THIRD_PARTY_NOTICES.txt)が適用されます。
