# ひげ処理：口の上とあごだけ、暗い粒（ひげの青み）を周りの肌の明るさに寄せる
import numpy as np, sys
from PIL import Image, ImageOps, ImageFilter, ImageDraw
import os; S=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","..","05_写真と動画","撮影_20261005_紫の照明")  # サイト本体/tools から見た撮影フォルダ
JOBS={"0738":((2017,650),[(430,322,115,42),(450,548,150,60)]),
      "0663":((2583,800),[(490,402,135,34),(470,592,150,60)]),
      "0732":((1950,900),[(440,372,155,44),(440,640,175,90)])}
def run(n):
    (ox,oy),ells=JOBS[n]
    im=ImageOps.exif_transpose(Image.open(f"{S}/DSC0{n}.JPG")).convert("RGB")
    crop=im.crop((ox,oy,ox+900,oy+900))
    m=Image.new("L",(900,900),0); d=ImageDraw.Draw(m)
    for cx,cy,rx,ry in ells: d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill=255)
    m=m.filter(ImageFilter.GaussianBlur(22))
    ref=crop.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(18))
    a=np.asarray(crop).astype(np.float32); r=np.asarray(ref).astype(np.float32)
    soft=np.asarray(crop.filter(ImageFilter.GaussianBlur(5))).astype(np.float32)
    k=np.asarray(m).astype(np.float32)[...,None]/255
    # 暗い所だけ持ち上げる（明るい所は触らない）＋ 細かい粒を少しならす
    lift=np.clip(r*0.97-a,0,None)
    out=a+k*(0.85*lift) ; out=out*(1-0.55*k)+ (soft+k*0.85*np.clip(r*0.97-soft,0,None))*0.55*k
    # 元の粒子感を少しだけ戻す
    noise=np.random.default_rng(1).normal(0,1.6,a.shape[:2])[...,None]*k
    out=np.clip(out+noise,0,255).astype(np.uint8)
    res=im.copy(); res.paste(Image.fromarray(out),(ox,oy))
    res.save(f"DSC0{n}_retouch.jpg",quality=95)
    w=Image.new("RGB",(1200,600)); w.paste(crop.resize((600,600)),(0,0)); w.paste(Image.fromarray(out).resize((600,600)),(600,0)); w.save(f"ba{n}.jpg",quality=88)
for n in sys.argv[1:]: run(n)
