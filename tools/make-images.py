# tools/make-images.py — ページの写真（img/）を書き出す。元の写真は読むだけで、上書きしない。
# 使い方：サイト本体のフォルダで  python3 tools/make-images.py   （Pillow と numpy が必要）
# 2026-10-15：現場・部屋の写真は表示サイズに合わせて小さく（ページを速く）
# 2026-10-14 v5：写真を「HP用_追加素材」（本人の新しい撮影）と「LINEで届いた写真」（現場・部屋・真空管）に差し替え。
#   新しい撮影はひげが目立たないので、ひげ処理（tools/retouch.py）はしない。
import os, numpy as np
from PIL import Image, ImageOps
H=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(H)
PH=os.path.join(H,"..","..","05_写真と動画")
ADD=os.path.join(PH,"HP用_追加素材"); LINE=os.path.join(PH,"LINEで届いた写真"); BASE=os.path.join(PH,"HP用の元画像")
os.makedirs("img",exist_ok=True)

def grade(im, gamma=1.0, sat=.9, warm=0.0, vig=.14, grain=1.4, seed=1, lift=0.0):
    # 色を整える：少し落ち着かせる（彩度）・周りを少し暗く（周辺減光）・粒子を少し
    a=np.asarray(im).astype(np.float32)/255
    a=a**gamma
    l=(.2126*a[...,0]+.7152*a[...,1]+.0722*a[...,2])[...,None]
    a=l+(a-l)*sat
    a=a*np.array([1.0+.04*warm,1.0,1.0-.06*warm])
    a=a*(1-lift)+lift
    h,w=a.shape[:2]; y,x=np.ogrid[:h,:w]; d=np.sqrt(((x-w/2)/(w/2))**2+((y-h*.42)/(h/2))**2)
    a*=(1-vig*np.clip(d-.55,0,1)**1.6)[...,None]; a+=np.random.default_rng(seed).normal(0,grain/255,(h,w,1))
    return Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8))
def src(folder,name): return ImageOps.exif_transpose(Image.open(os.path.join(folder,name))).convert("RGB")
def out(im,name,w,q=80,**g):
    r=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS) if im.width>w else im
    grade(r,seed=w,**g).save(f"img/{name}-{w}.webp","WEBP",quality=q,method=6)
    print(name,w,r.size)

# 本人（紫のカーテンの前で弾く）— 明るく写っているので、少しだけ締める
P=dict(gamma=1.12,sat=.88)
im=src(ADD,"IMG_7342.JPG").crop((0,0,6000,3375))   # 横顔で弾く
# PCは文字が左に乗るので、左にカーテンを足して本人を右に寄せる（左端の帯を反転して足す。カーテンなので、つなぎ目は目立たない）
ext=2400; wide=Image.new("RGB",(6000+ext,3375)); wide.paste(im,(ext,0))
c=im.crop((0,0,1200,3375)); wide.paste(c,(0,0)); wide.paste(ImageOps.mirror(c),(1200,0))   # 左端1200pxはカーテンだけ。そのまま→反転→本体の順に並べると、つなぎ目が連続する
out(wide,"hero-pc",2000,vig=.1,**P)
im=src(ADD,"IMG_7341.JPG"); out(im.crop((900,0,4100,4000)),"hero-sp",900,**P)            # スマホは縦に切る
im=src(ADD,"IMG_7306.JPG"); out(im.crop((1650,0,4850,4000)),"profile",900,**P)           # こちらを見ている1枚
im=src(ADD,"IMG_7321.JPG"); out(im.crop((1250,0,4450,4000)),"lesson",900,gamma=1.05,sat=.9,warm=.6)  # やわらかい光
im=src(ADD,"IMG_7342.JPG"); out(im.crop((1000,1700,6000,4000)),"hands",1400,**P)         # 手元とギター
im=src(ADD,"IMG_7313.JPG"); out(im.crop((0,1125,6000,4000)),"play",1400,**P)
im=src(ADD,"IMG_7351.JPG"); out(im.crop((0,2400,4000,5400)),"guitar",900,gamma=1.05)      # ギターだけ（ボディ）
im=src(ADD,"IMG_7351.JPG"); out(im.crop((0,500,4000,3500)),"guitars",900,gamma=1.05)      # ギターだけ（ネック）
# 現場・部屋（LINEで届いた写真）
im=src(LINE,"IMG_3336.JPG"); out(im,"stage",1000,sat=.95,vig=.1,q=74)        # ステージに立てたギター
im=src(LINE,"IMG_9593.JPG"); out(im,"pedal",1200,sat=.95,vig=.1)        # ステージのエフェクターボード
im=src(LINE,"IMG_9717.JPG"); out(im,"venue",1200,sat=.95,vig=.1,q=74)        # 本番前のホール
im=src(LINE,"IMG_6212.JPG"); out(im,"studio",1000,sat=.9,vig=.12,q=74)       # 作曲部屋（ギターと机）
im=src(LINE,"IMG_6604.jpeg"); out(im,"desk",900,sat=.9,vig=.12)         # 作曲部屋（モニターと鍵盤）
# セクションの背景（真空管）— スクロールで動かす
im=src(LINE,"IMG_1711.jpeg"); out(im,"tubes-blue",1600,sat=1.0,vig=.0,grain=1.0)
im=src(LINE,"IMG_1713.jpeg"); out(im,"tubes-amber",1600,sat=1.0,vig=.0,grain=1.0,gamma=.9)
# ライブ写真（前のまま）
out(Image.open(BASE+"/live-720.webp").convert("RGB"),"live",720,warm=.3,vig=.05)
# SNSで共有したときの画像（1200×630）
im=Image.open("img/hero-pc-2000.webp").convert("RGB"); w,h=im.size; nw=round(h*1200/630)   # 本人が入るよう右側を切り出す
im.crop((w-nw-60,0,w-60,h)).resize((1200,630)).save("img/ogp.jpg",quality=85)
print("ok")
