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
- **Cloudflare（くろクラウド）**: 下の `worker/` を Cloudflare Workers に置き、アプリからそこへつなぐ。Vault を読み書きでき、ネット検索（Shanone）もできる。Mac は寝ていていい。Claude API の従量課金

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

## worker/（くろクラウド）
くろブリッジのかわりに、Cloudflare Workers で「くろとおはなし」を動かす（依存なし・`worker/worker.js` の1ファイル）。返事の形はブリッジと同じ。

- くろができること: Vault を探す・読む・一覧（GitHub の main）／`inbox` `daily` `notes` `people` `projects` `shops` `kuro` に**足す・新しく作るだけ**（今ある行を変える・消すことはコードで止めている）。書いたらその場で1コミット（`daily: 2026-10-19（クラウドのくろから）`）／ネット検索（Shanone の `tavily_search` だけ。ほかの Shanone の道具は渡さない。足すときは `SHANONE_TOOLS`）
- 今ある文を直すときは、ブリッジと同じく直し案（アプリの編集画面でサキちゃんが保存）
- 絵を描く（`/draw`）: くろの「🎨 絵を描いていい？」でサキちゃんが「描く」を押したときだけ、アプリが呼ぶ（つなぎ先がブリッジ・Claude API でも、絵はここで描く）。OpenAI の画像生成（1枚・low・JPEG）。くろ・サキちゃんが出る絵は、Vault のプロフィール画像を Worker が読んで参考画像にする（鍵つき URL は外に出さない）。描いた絵はチャットに出るだけで、貼るのは「日記に入れとく？」などで
- キーはぜんぶ Cloudflare の secret。iPhone には URL と合言葉だけ
- 料金: Claude API の従量課金（Vault を探すと1回 約1万〜2万トークン）＋ 検索1回 Tavily 1クレジット・Shanone のツール1回分。Workers は無料プランで足りる見込み

### 置きかた（Mac のターミナル）
```bash
cd ~/Documents/GitHub/kuro-app/worker
npx wrangler login                        # はじめてだけ。ブラウザで Cloudflare にログイン
npx wrangler secret put ANTHROPIC_API_KEY # Claude API のキー（sk-ant-…）
npx wrangler secret put GITHUB_TOKEN      # kuro-second-brain だけ・Contents の Read and write の Fine-grained トークン
npx wrangler secret put KURO_CODE         # 合言葉。24文字以上（例: openssl rand -base64 24 で作る）
npx wrangler secret put SHANONE_API_KEY   # なくても動く（検索なし）
npx wrangler secret put SHANONE_ORG_ID
npx wrangler secret put OPENAI_API_KEY    # なくても動く（絵なし）。Images だけの権限のキー
npx wrangler deploy                       # → https://kuro-cloud.（名前）.workers.dev が出る
```
- アプリの「せってい」→「つなぎ先」を「Cloudflare（くろクラウド）」にして、URL と合言葉を入れて「保存してテスト」
- 動きのログ（トークン数・書いたファイル）は Cloudflare のダッシュボードの Workers → kuro-cloud → Logs（または `npx wrangler tail`）
- 止めるとき: ダッシュボードで Worker を消すか、`KURO_CODE` を変える（アプリから呼べなくなる）
