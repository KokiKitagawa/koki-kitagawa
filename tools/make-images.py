# tools/make-images.py — ページの写真（img/）を書き出す。元の写真は読むだけで、上書きしない。
# 使い方：サイト本体のフォルダで  python3 tools/make-images.py   （Pillow と numpy が必要）
# 元の写真：北川弘喜PF/05_写真と動画/撮影_20261005_紫の照明（本人）・AI生成_参考（人の写らないAI画像）・HP用の元画像（ステージ写真など）
# 顔が写る3枚（0738・0663・0732）は、ひげ処理済みの「HP用の元画像/ひげ処理済み」を使う（処理は tools/retouch.py）
import os, sys, subprocess, shutil, numpy as np
from PIL import Image, ImageOps, ImageEnhance
H=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(H)
PH=os.path.join(H,"..","..","05_写真と動画")
SHOOT=os.path.join(PH,"撮影_20261005_紫の照明"); AI=os.path.join(PH,"AI生成_参考"); BASE=os.path.join(PH,"HP用の元画像"); RET=os.path.join(BASE,"ひげ処理済み")
os.makedirs(RET,exist_ok=True); os.makedirs("img",exist_ok=True)
for n in ["0738","0663","0732"]:
    if not os.path.exists(os.path.join(RET,f"DSC0{n}_retouch.jpg")): subprocess.run([sys.executable,os.path.join(H,"tools","retouch.py"),n],check=True,cwd=RET)
def grade(im, warm=1.0, vig=.18, grain=1.6, seed=1, sat=.72):
    # 2026-10-14 v4.4：暗すぎたので持ち上げる／紫を少し抜く／少し温かく
    a=np.asarray(im).astype(np.float32)/255
    a=a**0.78
    l=(.2126*a[...,0]+.7152*a[...,1]+.0722*a[...,2])[...,None]
    a=l+(a-l)*sat
    a=a*np.array([1.0+.04*warm,1.0,1.0-.06*warm])
    a=np.clip((a-.5)*1.08+.52,0,1)
    h,w=a.shape[:2]; y,x=np.ogrid[:h,:w]; d=np.sqrt(((x-w/2)/(w/2))**2+((y-h*.42)/(h/2))**2)
    a*=(1-vig*np.clip(d-.55,0,1)**1.6)[...,None]; a+=np.random.default_rng(seed).normal(0,grain/255,(h,w,1))
    return Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8))
def src(n,ret=False):
    p=os.path.join(RET,f"DSC0{n}_retouch.jpg") if ret else f"{SHOOT}/DSC0{n}.JPG"
    return ImageOps.exif_transpose(Image.open(p)).convert("RGB")
def out(im,name,widths,q=78,g=True,warm=1.0,vig=.18):
    for w in widths:
        r=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS) if im.width>w else im
        (grade(r,warm=warm,seed=w,vig=vig) if g else r).save(f"img/{name}-{w}.webp","WEBP",quality=q,method=6)
im=src("0738",True); print("0738",im.size)
out(im.crop((0,240,6000,3615)),"hero-pc",[2000],vig=.12)
out(im.crop((1450,0,4650,4000)),"hero-sp",[900])
im=src("0732",True); print("0732",im.size); out(im.crop((0,0,im.width,round(im.width*1.25))),"profile",[900])
im=src("0663",True); out(im.crop((1700,250,4700,4000)),"lesson",[900],warm=1.15)
im=src("0724"); out(im.crop((0,150,6000,3900)),"hands",[1400])
im=src("0681"); w,h=im.size; out(im.crop(((w-h*4//3)//2,0,(w+h*4//3)//2,h)),"guitar",[900])
im=src("0724"); w,h=im.size; out(im.crop((0,(h-w*9//16)//2,w,(h+w*9//16)//2)),"play",[1400])
im=src("0670"); w,h=im.size; out(im.crop(((w-h*4//3)//2,0,(w+h*4//3)//2,h)),"guitars",[900],warm=.6)
out(Image.open(BASE+"/live-720.webp").convert("RGB"),"live",[720],warm=.3,vig=.05)
for a,b,w in [("studio",AI+"/works-bg.png",1600),("desk",AI+"/profile-v2.jpg",900),("strings",AI+"/contact-bg-v2.jpg",1600)]:
    out(Image.open(b).convert("RGB"),a,[w],g=False)
for a,b,w in [("stage",BASE+"/about-2-2000.webp",1600),("pedal",BASE+"/about-1-2000.webp",1200)]:
    out(Image.open(b).convert("RGB"),a,[w],warm=.3,vig=.1)
# SNSで共有したときの画像（1200×630）
im=Image.open("img/hero-pc-2000.webp").convert("RGB"); w,h=im.size; nh=round(w*630/1200)
im.crop((0,(h-nh)//2,w,(h-nh)//2+nh)).resize((1200,630)).save("img/ogp.jpg",quality=85)
print("ok")
