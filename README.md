# kuro-app

サキちゃんとくろのスマホアプリ（PWA）。開くと「くろの絵日記」がホーム画面。メニューから「ひとこと」で Vault の inbox にメモを送れる。画面右下のちびくろから「くろとおはなし」（チャット）も開ける。

- このリポジトリは公開。**日記などの中身は入れない**（コードとアイコンだけ）
- `index.html` は Vault の `.diary-app/template.html` から `kuro_app_page.py` で書き出したもの。直接直さない
- Vaultの中身は、アプリを開いたときに GitHub API で Vault（非公開）の `app-data` ブランチから取得する
- トークン・APIキー・ブリッジの合言葉は各端末の localStorage にだけ保存する。コード・コミットには書かない
- iPhone: SafariでURLを開く → 共有 → ホーム画面に追加

## くろとおはなし（チャット）の つなぎ先
「せってい」の「つなぎ先」で切りかえる。

- **Claude API**: アプリから直接 Claude API を呼ぶ（APIキーは各端末に入れる）。Vault は読めない
- **Mac の Claude Code（ブリッジ）**: 下の `bridge/` を Mac で動かし、アプリからそこへつなぐ。Vault を読める。Mac が起きていて、ブリッジが動いているときだけ使える

## bridge/（くろブリッジ）
Mac の Claude Code（`claude -p`）をアプリから呼ぶための、小さな中継サーバー（Node 18 以上・依存なし）。

```bash
node bridge/server.mjs
```

- 起動のたびに6けたの合言葉が画面に出る。合言葉がないと使えない（5回まちがえると止まる）
- 外（iPhone など）から使うときは、ブリッジは `127.0.0.1` のまま、Tailscale の `serve` を入口にする（https・自分の端末だけ）
- ブリッジが配るページ `/app/` を開くか、ホーム画面のアプリの「せってい」でブリッジの URL と合言葉を入れる
- Vault は `VAULT_DIR`（既定は `~/Documents/GitHub/kuro-second-brain/kuro-second-brain`）。Vault のフォルダで Claude Code を起動する
- くろができること
  - Vault を読む（Read・Glob・Grep）
  - `inbox/` と `daily/` の中に書く（Write・Edit）。ほかのフォルダには書けない。消す・コマンド・ネットはできない
  - 書いたファイルは、返事のあとにブリッジが自動でコミットして push する（Vault が `main` のときだけ）。今ある行が消えた・変わったファイルはコミットしない
- 環境変数
  - `WRITABLE=0` … 読むだけにする
  - `AUTO_COMMIT=0` … 自動コミット・push を止める（書くのはそのまま）
  - `VAULT_DIR` … Vault の場所
  - `PORT` / `HOST` … 待ちうけ（既定は `127.0.0.1:8787`）
  - `ALLOW_ORIGINS` … 呼び出しを通す別サイト（既定はこのアプリの GitHub Pages）
- ブリッジが動いているあいだ、Mac は眠らない（`caffeinate`）。ふたは開けたまま、電源につないで使う
