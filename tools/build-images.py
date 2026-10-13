#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
元 JPG → WebP（幅 640 / 1200 / 2000）書き出し。

SPEC.md 8章の実装。npm のライブラリは使わない（依存ゼロ方針）。
cwebp が入っていない・sips は webp を書けない環境だったため、
macOS の python3 に同梱されている Pillow を使う。サイトの依存ではなく、
画像を作り直すときだけ動かす道具。

  python3 tools/build-images.py

出力：assets/img/<role>-<幅>.webp と assets/img/manifest.json
      assets/img/ogp.jpg（1200x630・OGP用）
"""
import json, os, sys
from PIL import Image

HERE   = os.path.dirname(os.path.abspath(__file__))
SITE   = os.path.dirname(HERE)
SRCDIR = os.path.join(os.path.dirname(os.path.dirname(SITE)), "05_写真と動画", "以前の写真")  # 北川弘喜PF/05_写真と動画/以前の写真
OUT    = os.path.join(SITE, "assets", "img")

WIDTHS  = [640, 1200, 2000]
QUALITY = 80
LIMIT_KB      = 300      # 1枚あたりの目標
LIMIT_KB_HERO = 500      # ヒーローだけ許容を上げる

# role -> 元ファイル。どの写真を何に使うかは docs/CONTENT.md の割り当てに従う。
SOURCES = {
    "hero":     "9155DAB3-F6A0-4832-9408-3E7D872923AB.JPG",
    "portrait": "IMG_5091.jpg",
    "about-1":  "IMG_9585.JPG",
    "about-2":  "IMG_9583.JPG",
    "about-3":  "IMG_9573.JPG",
    "live-1":   "IMG_9593.JPG",
}

# 役割ごとに書き出す幅を変えたいときだけ書く。
# portrait は元が 875px しか無い。引き伸ばさずに、この幅までで使い切る
# （site.css で表示幅を 440px に抑えてあるので、875px で 2倍密度に届く）。
WIDTHS_BY_ROLE = {
    "portrait": [640, 875],
}

# 元画像の切り出し（left, top, right, bottom / 元のピクセル）。
# 顔が切れる切り方はしない。床や機材ケースのように、写真の主役でない下側だけを落とす。
CROP = {
    "portrait": (0, 0, 875, 1010),   # 元 875x1335。足元の床と黒い台を外す
}

def encode(img, path, quality):
    img.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest, warn = {}, []

    for role, fname in SOURCES.items():
        src = os.path.join(SRCDIR, fname)
        if not os.path.exists(src):
            sys.exit("元画像が見つからない: " + src)

        im = Image.open(src)
        im = im.convert("RGB")
        if role in CROP:
            im = im.crop(CROP[role])
        ow, oh = im.size
        limit = LIMIT_KB_HERO if role == "hero" else LIMIT_KB
        entry = {"source": fname, "widths": [], "w": 0, "h": 0}

        for w in WIDTHS_BY_ROLE.get(role, WIDTHS):
            if w > ow:                      # 元より大きく引き伸ばさない
                continue
            h = round(oh * w / ow)
            resized = im.resize((w, h), Image.LANCZOS)
            path = os.path.join(OUT, f"{role}-{w}.webp")
            q = QUALITY
            size = encode(resized, path, q)
            while size > limit * 1024 and q > 55:   # 目標に入るまで品質を下げる
                q -= 5
                size = encode(resized, path, q)
            if size > limit * 1024:
                warn.append(f"{role}-{w}.webp が {size//1024}KB（目標 {limit}KB）")
            entry["widths"].append(w)
            entry["w"], entry["h"] = w, h            # 最大幅の実寸を持たせる
            print(f"  {role}-{w}.webp  {size//1024}KB  q{q}  {w}x{h}")

        manifest[role] = entry

    # OGP 1200x630（ヒーロー写真の中央切り出し。文字はページ側で語る）
    hero = Image.open(os.path.join(SRCDIR, SOURCES["hero"])).convert("RGB")
    tw, th = 1200, 630
    scale = max(tw / hero.width, th / hero.height)
    hero = hero.resize((round(hero.width * scale), round(hero.height * scale)), Image.LANCZOS)
    left, top = (hero.width - tw) // 2, (hero.height - th) // 2
    hero.crop((left, top, left + tw, top + th)).save(
        os.path.join(OUT, "ogp.jpg"), "JPEG", quality=82, optimize=True)
    print(f"  ogp.jpg  {os.path.getsize(os.path.join(OUT,'ogp.jpg'))//1024}KB  1200x630")

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    for w in warn:
        print("警告: " + w)
    print("画像 OK")

main()
