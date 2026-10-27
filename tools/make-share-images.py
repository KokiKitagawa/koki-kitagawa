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

# ---------- レッスンのページの共有画像 1200×630（img/ogp-lesson.jpg） ----------
# 2026-10-27：レッスンのページ（lesson.html）・予約ページを LINE などで送ったとき、ひと目でレッスンの案内と分かるように。
#   写真は img/lesson-900.webp（レッスンのページの1画面目と同じ）。文字はレッスンのページの1画面目と同じ。料金は data/site.json から。
import json
trial = json.load(open("data/site.json", encoding="utf-8"))["lessonPlans"]["trial"]["price"]
src = Image.open("img/lesson-900.webp").convert("RGB")
PW = 640; ph = Image.Image.resize(src, (PW, round(src.height * PW / src.width)), Image.LANCZOS).crop((0, 0, PW, Hh))
# 下地：同じ写真を大きくぼかして敷く（レッスンのページの .hero-blur と同じ考え方）
bg = src.resize((W, round(src.height * W / src.width)), Image.LANCZOS).crop((0, 120, W, 120 + Hh)).filter(ImageFilter.GaussianBlur(40))
b = np.asarray(bg).astype(np.float32) * .2 + np.array(BG) * .8
img = Image.fromarray(b.clip(0, 255).astype(np.uint8))
# 写真は右に。左のふちをなめらかに消す
m = np.clip(np.linspace(0, 1, PW) / .38, 0, 1) ** 1.6
mask = Image.fromarray((np.tile(m, (Hh, 1)) * 255).astype(np.uint8))
img.paste(ph, (W - PW, 0), mask)
a = np.asarray(img).astype(np.float32)
y = np.linspace(0, 1, Hh)[:, None, None]
bot = np.clip((y - .78) / .22, 0, 1) ** 1.5 * .5
a = a * (1 - bot) + np.array(BG) * bot
img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
f_catch = font(52)
spaced(d, (L, 72), "GUITAR LESSON", f_small, SUB, 5)
y1, y2 = 140, 214
pre = "あなたの"; wkw = d.textlength("ギター", font=f_catch); x_kw = L + d.textlength(pre, font=f_catch)
img = glow(img, (x_kw - 30, y2 - 6, x_kw + wkw + 30, y2 + 80), OR)
d = ImageDraw.Draw(img)
d.text((L, y1), "現場で培った経験を、", font=f_catch, fill=INK)
d.text((L, y2), "あなたのギターへ。", font=f_catch, fill=INK)
d.text((L, 330), "北川弘喜のギターレッスン", font=font(26), fill=INK)
d.text((L, 372), "小岩のスタジオ・オンライン｜初心者からプロ志向まで", font=font(19, bold=False), fill=SUB)
d.rounded_rectangle((L, 470, L + 4, 548), 2, fill=OR)
d.text((L + 22, 468), "体験レッスン  60分  ¥{:,}".format(trial), font=font(26), fill=INK)
d.text((L + 22, 512), "空いている日時から、そのまま予約できます", font=font(19, bold=False), fill=SUB)
img.save("img/ogp-lesson.jpg", quality=86, optimize=True, progressive=True)
print("img/ogp-lesson.jpg", img.size)

# ---------- アイコン（ホーム画面・タブ） ----------
# 2026-10-15：本人がギターを弾くイラスト（北川くんが ChatGPT で作成。元は 05_写真と動画/AI生成_参考/アイコン用イラスト_1_文字なし.png）。
#   少し寄って切り出す（ギターの先まで入れて、顔を少し大きく）。元の絵は読むだけで上書きしない。
ILL = os.path.join(H, "..", "..", "05_写真と動画", "AI生成_参考", "アイコン用イラスト_1_文字なし.png")
src = Image.open(ILL).convert("RGB")
s0 = src.width / 1254   # 切り出す位置は 1254px の元絵で決めたもの
ic = src.crop(tuple(round(v * s0) for v in (150, 30, 1254, 1134)))
for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("favicon-48.png", 48)]:
    ic.resize((size, size), Image.LANCZOS).save("assets/" + name, optimize=True)
print("assets/ のアイコン 4つ")
