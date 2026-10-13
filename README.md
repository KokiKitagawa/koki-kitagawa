# 北川弘喜 ポートフォリオ

ギタリスト／作編曲家・北川弘喜のポートフォリオサイト（1ページ完結・静的）。
依存パッケージはゼロ。`data/` の JSON を直してビルドすると `index.html` が出る。

## 中身

```
site/
├─ CLAUDE.md              Claude Code に守らせるルール
├─ docs/
│   ├─ SPEC.md            実装仕様（設計書の本体）
│   ├─ CONTENT.md         文言の正
│   └─ QUESTIONS.md       本人に確認したいことの一覧
├─ data/                  ここを直すのが唯一の更新方法
│   ├─ profile.json       名前・肩書き・本文・レッスン・SNS・公開URL
│   ├─ credits.json       楽曲クレジット（楽曲提供／ギター参加／カラオケ音源）
│   ├─ live.json          ライブ・フェス
│   ├─ media.json         TV・舞台
│   └─ images.json        写真の代替テキストと sizes
├─ src/
│   ├─ template.html      ページの雛形（<!-- @works --> のような差込口）
│   ├─ render.mjs         データ → HTML 断片（入出力を持たない）
│   └─ pipeline.mjs       読み込んだ文字列 → 書き出す文字列
├─ assets/
│   ├─ css/kk-design-system.css  デザインシステム（触らない）
│   ├─ css/site.css              このページ固有の組み方だけ
│   ├─ js/main.js                4機能だけ・約4KB
│   └─ img/                      WebP 書き出し済み ＋ manifest.json
├─ tools/
│   ├─ build-images.py    元JPG → WebP（幅 640/1200/2000）＋ OGP画像
│   ├─ build.sh           Node が無い Mac 用のビルド
│   └─ build.jsc.mjs      同上（中身は build.mjs と共通）
├─ build.mjs              data + template → index.html
├─ index.html             生成物。手で編集しない
└─ robots.txt             生成物
```

## 更新のしかた

1. `data/` の JSON を直す（曲を足す、年を入れる、担当を入れる）
2. ビルドする

```bash
node build.mjs
```

Node が入っていない Mac では、macOS 同梱の JavaScriptCore で同じものを作れる。

```bash
sh tools/build.sh
```

3. `index.html` が更新される。ブラウザで 1280px と 390px を目で見る
4. コミットして push すると GitHub Pages に反映される

### ビルドが止まるとき

`build.mjs` はデータがおかしいと**黙って空を出さずにエラーで止まる**。

- `credits[3] の category が不正` … `compose` / `guitar` / `karaoke` のどれかにする
- `生成物の自己点検で不合格: 『要確認』が画面に出ている` … 未確認の値を画面に出そうとしている。
  JSON の値を `null` か `"要確認"` のままにしておけば、その項目は画面から外れる

## 写真を差し替える

元の JPG を `北川弘喜PF/05_写真と動画/以前の写真/` に置き、`tools/build-images.py` の `SOURCES` を直して実行する。

```bash
python3 tools/build-images.py
```

WebP を3サイズ書き出し、`assets/img/manifest.json`（実寸）と OGP画像を作り直す。
代替テキストは `data/images.json` に書く。

## 公開

GitHub Pages（`main` ブランチのルート）。
`data/profile.json` の `siteUrl` に公開URLを入れて再ビルドすると、
`sitemap.xml` と OGP の絶対URLが出る。**URLが決まるまでは捏造せず作らない。**
