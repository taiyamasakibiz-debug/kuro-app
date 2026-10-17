# kuro-app

サキちゃんとくろのスマホアプリ（PWA）。開くと「くろの絵日記」がホーム画面。メニューから「ひとこと」で Vault の inbox にメモを送れる。

- このリポジトリは公開。**日記などの中身は入れない**（コードとアイコンだけ）
- `index.html` は Vault の `.diary-app/template.html` から `kuro_app_page.py` で書き出したもの。直接直さない
- Vaultの中身は、アプリを開いたときに GitHub API で Vault（非公開）の `app-data` ブランチから取得する
- トークンは各端末の localStorage にだけ保存する。コード・コミットには書かない
- iPhone: SafariでURLを開く → 共有 → ホーム画面に追加
