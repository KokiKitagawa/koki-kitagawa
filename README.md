# 北川弘喜 公式サイト

ギタリスト・作曲家 北川弘喜の公式サイト（1ページ・静的）。公開先：https://kokikitagawa.github.io/koki-kitagawa/
依存パッケージはゼロ。`data/` の JSON を直して `node build.mjs` を実行すると `index.html` ができる。

```
build.mjs                 ビルド（Node 標準ライブラリだけ）
src/
├─ template.html          ページの雛形（<!--@main--> などの差込口）
└─ render.mjs             データ → HTML（文章・カードはすべて静的に書き出す）
data/
├─ profile.json           名前・紹介文・機材・レッスン・SNS・公開URL
├─ credits.json           楽曲（提供・ギター参加・カラオケ音源）
├─ live.json / media.json ライブ・フェス／TV・舞台
├─ site.json              料金・レッスン実績・年表・フォームの送り先・アイコン
└─ images.json            写真の置き場所
assets/
├─ css/kk-design-system.css  色・書体・余白の決まり
├─ css/site.css              ページの組み方
├─ js/main.js                ボタンの動き（絞り込み・メニュー・フォーム送信）
└─ favicon.svg
img/                      ページで使う写真（tools/make-images.py で書き出す）
tools/
├─ build.sh / build.jsc.mjs  Node が無い Mac 用のビルド
├─ make-images.py            写真の書き出し
└─ retouch.py                顔写真のひげ処理
v2/index.html             旧スマホ版のアドレス → トップへ転送
docs/                     手元だけの資料（公開しない）
```

更新の流れ：データを直す → `node build.mjs`（または `sh tools/build.sh`）→ 見た目を確かめる → GitHub Desktop で Commit → Push。
