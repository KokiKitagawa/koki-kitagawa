# tools/make-share-images.py — SNSで共有したときの画像（img/ogp.jpg）と、ホーム画面・タブのアイコンを書き出す。
# 使い方：サイト本体のフォルダで  python3 tools/make-share-images.py   （Pillow と numpy が必要）
# 2026-10-15：共有画像に名前とキャッチを入れた（LINE・X・Facebookで送られたとき、だれのページか一目で分かるように）。
#   写真は img/hero-pc-2000.webp（トップと同じ）。色はトップの光（オレンジ・水色）と同じ。新しい色は足していない。
import os, sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) > 1: H = sys.argv[1]
os.chdir(H)

OR = (255, 116, 23); BLUE = (92, 200, 245); INK = (243, 245, 249); SUB = (180, 189, 205); BG = (8, 11, 19)

def font(size, bold=True):
    names = (["NotoSansCJK-Black.ttc", "NotoSansCJK-Bold.ttc"] if bold else ["NotoSansCJK-Medium.ttc", "NotoSansCJK-Regular.ttc"])
    dirs = ["/usr/share/fonts/opentype/noto", "/System/Library/Fonts", "/Library/Fonts"]
    for d in dirs:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p): return ImageFont.truetype(p, size, index=0)   # index 0 = JP
    for p in ["/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc" if bold else "/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc"]:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    raise SystemExit("日本語の書体が見つかりません")

def glow(base, box, color, strength=.85, blur=34):
    # 文字の後ろに、ぼんやりした光を置く（トップのキャッチと同じ考え方）
    layer = Image.new("L", base.size, 0); d = ImageDraw.Draw(layer)
    d.ellipse(box, fill=int(255 * strength)); layer = layer.filter(ImageFilter.GaussianBlur(blur))
    col = Image.new("RGB", base.size, color)
    return Image.composite(col, base, layer.point(lambda v: int(v * .75)))

def spaced(d, xy, text, f, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill); x += d.textlength(ch, font=f) + track
    return x

# ---------- 共有画像 1200×630 ----------
W, Hh = 1200, 630
src = Image.open("img/hero-pc-2000.webp").convert("RGB"); sw, sh = src.size
nw = round(sh * W / Hh); x0 = sw - nw - 60
img = src.crop((x0, 0, x0 + nw, sh)).resize((W, Hh), Image.LANCZOS)
# 左を暗く（文字を読みやすく）。本人の顔にはかからない
a = np.asarray(img).astype(np.float32)
x = np.linspace(0, 1, W)[None, :, None]
shade = np.clip(1 - (x - .02) / .5, 0, 1) ** 1.3 * .78
a = a * (1 - shade) + np.array(BG) * shade
y = np.linspace(0, 1, Hh)[:, None, None]
bot = np.clip((y - .72) / .28, 0, 1) ** 1.5 * .55
a = a * (1 - bot) + np.array(BG) * bot
img = Image.fromarray(a.clip(0, 255).astype(np.uint8))

d = ImageDraw.Draw(img)
L = 64
f_small = font(19, bold=False); f_catch = font(58); f_name = font(30); f_en = font(20, bold=False); f_tag = font(22)
spaced(d, (L, 70), "GUITARIST / COMPOSER", f_small, SUB, 5)
# キャッチ（2行）。「書ける」の後ろにオレンジ、「弾ける」の後ろに水色の光
y1, y2 = 146, 222
w1 = d.textlength("書ける", font=f_catch); w2 = d.textlength("弾ける", font=f_catch)
img = glow(img, (L - 30, y1 - 4, L + w1 + 20, y1 + 86), OR)
img = glow(img, (L + 40, y2 - 4, L + 70 + w2 + 20, y2 + 86), BLUE)
d = ImageDraw.Draw(img)
d.text((L, y1), "書けるギタリスト、", font=f_catch, fill=INK)
d.text((L + 58, y2), "弾ける作曲家。", font=f_catch, fill=INK)
d.text((L, 352), "北川弘喜", font=f_name, fill=INK)
spaced(d, (L + d.textlength("北川弘喜", font=f_name) + 18, 362), "KOKI KITAGAWA", f_en, INK, 4)
# 下：レッスンの案内（オレンジの線）
d.rounded_rectangle((L, 470, L + 4, 548), 2, fill=OR)
d.text((L + 22, 470), "ギターレッスン", font=f_tag, fill=INK)
d.text((L + 22, 508), "小岩・オンライン｜体験レッスン受付中", font=font(20, bold=False), fill=SUB)
img.save("img/ogp.jpg", quality=86, optimize=True, progressive=True)
print("img/ogp.jpg", img.size)

# ---------- アイコン（ホーム画面・タブ） ----------
# 夜の色の地に、ギターの弦3本。真ん中はオレンジ、右は水色に光る（キャッチの2色）
def icon(size, pad=0.0):
    s = 4 * size  # 大きく描いて縮める（線をなめらかに）
    im = Image.new("RGB", (s, s), (10, 18, 34))
    # 地：上が少し明るい紺
    g = np.linspace(0, 1, s)[:, None, None]
    top = np.array((26, 37, 57)); bot = np.array((8, 11, 19))
    im = Image.fromarray((top * (1 - g) + bot * g + np.zeros((s, s, 3))).astype(np.uint8))
    inner = s * (1 - 2 * pad); o = s * pad
    xs = [o + inner * r for r in (.30, .50, .70)]
    cols = [INK, OR, BLUE]; widths = [.034, .05, .042]
    for xx, c, wr in zip(xs, cols, widths):
        if c != INK:
            im = glow(im, (xx - inner * .16, o + inner * .1, xx + inner * .16, o + inner * .9), c, .9, blur=s * .05)
    d = ImageDraw.Draw(im)
    for xx, c, wr in zip(xs, cols, widths):
        w = inner * wr
        d.rounded_rectangle((xx - w / 2, o + inner * .17, xx + w / 2, o + inner * .83), w / 2, fill=c if c == INK else tuple(min(255, int(v * .55 + 255 * .45)) for v in c))
    return im.resize((size, size), Image.LANCZOS)

icon(180, .06).save("assets/apple-touch-icon.png", optimize=True)
icon(192, .06).save("assets/icon-192.png", optimize=True)
icon(512, .06).save("assets/icon-512.png", optimize=True)
icon(48).save("assets/favicon-48.png", optimize=True)
print("assets/ のアイコン 4つ")
