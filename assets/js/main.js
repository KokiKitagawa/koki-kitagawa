/* main.js — ページの動き（中身の文章は index.html に書き出し済み。ここは操作だけ） */
(() => {
const CFG = JSON.parse(document.getElementById("cfg").textContent);
/* 申し込みボタン → フォームへ（種別を選んだ状態で） */
const menu = document.getElementById("menu"), menuBtn = document.getElementById("menuBtn");
function closeMenu(){ menu.hidden = true; menuBtn.setAttribute("aria-expanded","false"); document.body.style.overflow=""; }
menuBtn.addEventListener("click", () => { menu.hidden = false; menuBtn.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; document.getElementById("menuX").focus(); });
document.getElementById("menuX").addEventListener("click", closeMenu);
menu.addEventListener("click", e => { if(e.target.closest("a")) closeMenu(); });
document.addEventListener("keydown", e => { if(e.key==="Escape" && !menu.hidden) closeMenu(); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-open]"); if(!b) return;
  closeMenu(); setKind(b.dataset.open);
  if(b.dataset.plan){ document.getElementById("f_plan").value = b.dataset.plan; }
  document.getElementById("contact").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
  setTimeout(() => document.getElementById("f_name").focus({preventScroll:true}), 600);
});
/* ご用件のカード */
const kindEl = document.getElementById("f_kind");
/* ご用件で、下の入力欄を切り替える（レッスン／お仕事／その他） */
const PH = {"レッスン":"ご質問や、レッスンで弾けるようになりたい曲など（なくても大丈夫です）","お仕事":"曲の雰囲気、尺、使い道など（なくても大丈夫です）","その他":"ご用件をお書きください"};
function applyKind(v){ kindEl.value = v;
  document.querySelectorAll(".xf").forEach(x => x.classList.toggle("on", x.dataset.for===v));
  document.getElementById("f_msg").placeholder = PH[v] || "ご希望の内容、日程、納期など";
  document.getElementById("msgReq").hidden = v==="レッスン" || v==="お仕事";
  const sb = document.getElementById("send"); sb.classList.toggle("or", v==="レッスン"); sb.classList.toggle("gr", v!=="レッスン");
  document.getElementById("f_sub").placeholder = v==="お仕事" ? "例：楽曲制作のご相談" : v==="レッスン" ? "例：体験レッスンの希望日について" : "例：取材のご依頼";
}
function setKind(v){ document.querySelectorAll('input[name="kind"]').forEach(r => r.checked = r.value===v); applyKind(v); }
document.querySelectorAll('input[name="kind"]').forEach(r => r.addEventListener("change", () => applyKind(r.value)));
/* 絞り込みチップ */
document.querySelectorAll(".filters").forEach(g => g.addEventListener("click", e => {
  const b = e.target.closest(".fchip"); if(!b) return;
  g.querySelectorAll(".fchip").forEach(x => x.setAttribute("aria-pressed", x===b));
  const all = b.dataset.f==="ALL";
  document.querySelectorAll(`#${g.dataset.grid} > li, #${g.dataset.grid}2 > li`).forEach(li => li.hidden = !(all || li.dataset.k===b.dataset.f));
  const more = document.getElementById(g.dataset.grid + "More");
  if(more){ if(!all){ more.dataset.was = more.open ? "1" : ""; more.open = true; more.classList.add("filtered"); } else if(more.classList.contains("filtered")){ more.classList.remove("filtered"); more.open = more.dataset.was === "1"; } }
}));
/* 横スクロールの矢印 */
document.querySelectorAll(".arw").forEach(b => b.addEventListener("click", () => { const el = document.getElementById(b.dataset.for); el.scrollBy({left: el.clientWidth*.8*Number(b.dataset.dir), behavior:"smooth"}); }));
/* WORKS のタブ（楽曲／ライブ・TV） */
const tabs = [...document.querySelectorAll('.seg [role="tab"]')];
function showTab(name){ tabs.forEach(t => { const on = t.dataset.tab===name; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute("aria-controls")).classList.toggle("on", on); }); }
tabs.forEach(t => { t.addEventListener("click", () => showTab(t.dataset.tab));
  t.addEventListener("keydown", e => { if(e.key!=="ArrowRight" && e.key!=="ArrowLeft") return; const i = (tabs.indexOf(t) + (e.key==="ArrowRight"?1:-1) + tabs.length) % tabs.length; tabs[i].focus(); showTab(tabs[i].dataset.tab); }); });
document.querySelectorAll("[data-tab-go]").forEach(a => a.addEventListener("click", () => showTab(a.dataset.tabGo)));

/* ジャケットの再生ボタン：1タップで再生、別の曲を押すと前の曲は止まる（Spotify の埋め込みを1つだけ使う） */
const arts = [...document.querySelectorAll(".art[data-track]")], host = document.getElementById("spHost");
let ctrl = null, cur = null, wantPlay = false, apiAsked = false, apiFailed = false, lastPlay = 0;
const setUI = (b, playing) => { arts.forEach(x => { const on = x===b && playing; x.closest(".song").classList.toggle("playing", on); x.setAttribute("aria-pressed", on); }); };
function loadApi(){
  if(apiAsked || !arts.length) return; apiAsked = true;
  window.onSpotifyIframeApiReady = api => api.createController(document.getElementById("spEmbed"), {uri:"spotify:track:"+arts[0].dataset.track, width:"100%", height:80}, c => {
    ctrl = c;
    c.addListener("playback_update", e => { const d = e.data; if(!cur) return;
      if(!d.isPaused){ wantPlay = false; host.classList.remove("show"); }
      setUI(cur, !d.isPaused);
      const bar = cur.querySelector(".bar i"); if(bar && d.duration) bar.style.transform = `scaleX(${Math.min(1, d.position/d.duration)})`; });
    if(wantPlay && cur) start(cur);
  });
  const sc = document.createElement("script"); sc.src = "https://open.spotify.com/embed/iframe-api/v1"; sc.async = true; sc.onerror = () => { apiFailed = true; if(cur) setUI(cur, false); }; document.head.appendChild(sc);
}
function start(b){
  if(!ctrl){ wantPlay = true; loadApi(); setTimeout(() => { if(!ctrl && cur===b) setUI(b, false); }, 6000); return; }
  ctrl.loadUri("spotify:track:"+b.dataset.track); ctrl.play(); lastPlay = Date.now(); wantPlay = true;
  /* 少し待っても鳴らないとき（ブラウザが自動再生を止めた等）は、プレイヤーを下に出して押してもらう */
  /* スマホは、Spotify の決まりで「プレイヤーの再生ボタン」を押さないと鳴らないことが多いので、すぐにプレイヤーを出す */
  if(matchMedia("(hover:none)").matches){ host.classList.add("show"); return; }
  setTimeout(() => { if(wantPlay && cur===b && Date.now()-lastPlay >= 2400) host.classList.add("show"); }, 2500);
}
arts.forEach(b => b.addEventListener("click", () => {
  if(apiFailed){ window.open("https://open.spotify.com/track/"+b.dataset.track, "_blank", "noopener"); return; }   // 埋め込みが読めないときは Spotify を開く
  if(cur===b && ctrl){ ctrl.togglePlay(); return; }
  arts.forEach(x => { const bar = x.querySelector(".bar i"); if(bar) bar.style.transform = "scaleX(0)"; });
  cur = b; setUI(b, true); start(b);
}));
const featEl = document.getElementById("feat");
if(featEl && "IntersectionObserver" in window){ const o = new IntersectionObserver(es => { if(es.some(e=>e.isIntersecting)){ loadApi(); o.disconnect(); } }, {rootMargin:"600px 0px"}); o.observe(featEl); }
/* 横スクロールの点（すぐ後ろの「横にスワイプ」と連動） */
document.querySelectorAll(".hs").forEach(el => {
  const sw = el.nextElementSibling; if(!sw || !sw.classList.contains("swipe")) return;
  const dots = sw.querySelectorAll(".dots i");
  const upd = () => { const w = el.scrollWidth - el.clientWidth; const i = w>0 ? Math.round(el.scrollLeft/w*(dots.length-1)) : 0; dots.forEach((d,j)=>d.classList.toggle("on",i===j)); };
  el.addEventListener("scroll", upd, {passive:true}); upd();
});
/* 料金はスマホでは「人気No.1」（月4回）が見える位置から */
const plansEl = document.getElementById("plans"), rec = plansEl && plansEl.querySelector(".rec");
if(rec && matchMedia("(max-width:820px)").matches) plansEl.scrollLeft = rec.offsetLeft - parseFloat(getComputedStyle(plansEl).paddingLeft);

/* アコーディオンの開閉を、高さがスッと伸び縮みするように */
const reduce = matchMedia("(prefers-reduced-motion:reduce)");
document.querySelectorAll("details").forEach(d => {
  const s = d.querySelector(":scope > summary"); if(!s) return;
  s.addEventListener("click", e => {
    if(reduce.matches || d.classList.contains("filtered")) return;
    e.preventDefault();
    if(d._a){ d._a.cancel(); }
    const start = d.offsetHeight, opening = !d.open;
    if(opening) d.open = true;
    const end = opening ? d.scrollHeight + (d.offsetHeight - d.clientHeight) : s.offsetHeight + (d.offsetHeight - d.clientHeight);
    d.style.overflow = "hidden";
    d._a = d.animate({height:[start+"px", end+"px"]}, {duration:280, easing:"cubic-bezier(.2,.7,.2,1)"});
    d._a.onfinish = () => { d._a = null; d.style.overflow = ""; if(!opening) d.open = false; };
    d._a.oncancel = () => { d._a = null; d.style.overflow = ""; };
  });
});
/* PCでは アコーディオンを開いた状態にする（スマホだけ たためる） */
const mq = matchMedia("(min-width:821px)");
function syncAcc(){ document.querySelectorAll("details.pc-open").forEach(d => { if(mq.matches) d.open = true; }); }
syncAcc(); mq.addEventListener("change", syncAcc);

/* ヘッダー・現在地・下のボタン */
const hd = document.getElementById("hd"), dock = document.getElementById("dock"), navA = [...document.querySelectorAll("#nav a")];
let inContact = false; const heroEl = document.getElementById("top");
const onScroll = () => { hd.classList.toggle("solid", scrollY > 40); dock.classList.toggle("hide", inContact || scrollY < heroEl.offsetHeight * .7); };
addEventListener("scroll", onScroll, {passive:true}); onScroll();
if("IntersectionObserver" in window){
  const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ const id = e.target.id; navA.forEach(a => a.classList.toggle("on", a.getAttribute("href")==="#"+id)); } }), {rootMargin:"-45% 0px -50% 0px"});
  document.querySelectorAll("#main > section").forEach(s => io.observe(s));
  const ct = new IntersectionObserver(es => es.forEach(e => { inContact = e.isIntersecting; onScroll(); }), {threshold:.08});
  ct.observe(document.getElementById("contact"));
  const rv = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ const t = e.target; t.classList.add("in"); rv.unobserve(t);
    if(t.classList.contains("rv")) setTimeout(() => { t.style.transitionDelay = ""; t.classList.add("settled"); }, 1200); } }), {rootMargin:"0px 0px -8% 0px"});
  document.querySelectorAll(".reveal").forEach(x => rv.observe(x));
  document.querySelectorAll("#main .card").forEach(c => { const i = [...c.parentElement.children].indexOf(c); c.classList.add("rv"); c.style.transitionDelay = `${(i%6)*70}ms`; rv.observe(c); });
} else document.querySelectorAll(".reveal").forEach(x => x.classList.add("in"));

/* 背景の真空管：スクロールに合わせて少しだけずらす（奥行き） */
const pbgs = [...document.querySelectorAll(".pbg i")];
if(pbgs.length && !reduce.matches){
  let tick = false;
  const par = () => { tick = false; const vh = innerHeight;
    pbgs.forEach(i => { const r = i.parentElement.getBoundingClientRect(); if(r.bottom < -200 || r.top > vh + 200) return;
      i.style.setProperty("--py", ((r.top + r.height/2 - vh/2) * -0.18).toFixed(1) + "px"); }); };
  addEventListener("scroll", () => { if(!tick){ tick = true; requestAnimationFrame(par); } }, {passive:true}); par();
}

/* 動画：押したときだけ YouTube を読み込む（ページを軽く・勝手に通信しない） */
document.querySelectorAll(".pv-frame[data-yt]").forEach(b => b.addEventListener("click", () => {
  const f = document.createElement("iframe"); f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0`;
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.title = b.getAttribute("aria-label");
  b.replaceChildren(f); b.style.cursor = "default";
}, {once:true}));
/* 予約カレンダー：その場で開く（Googleカレンダーの予約ページ） */
const bk = document.getElementById("bk");
if(bk){
  const fr = bk.querySelector("iframe");
  const closeBk = () => { bk.hidden = true; document.body.style.overflow = ""; };
  document.addEventListener("click", e => {
    if(e.target.closest("[data-book]")){ closeMenu(); if(!fr.src) fr.src = fr.dataset.src; bk.hidden = false; document.body.style.overflow = "hidden"; bk.querySelector(".x").focus(); }
    else if(e.target.closest("[data-book-close]") || e.target === bk) closeBk();
  });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !bk.hidden) closeBk(); });
}

/* フォーム：Googleフォームへ送る */
const from = (new URLSearchParams(location.search).get("from")||"").toLowerCase();
document.getElementById("f_from").value = ({ig:"Instagram",x:"X",yt:"YouTube",sp:"Spotify"})[from] || "";
document.getElementById("form").addEventListener("submit", e => {
  e.preventDefault(); let ok = true, first = null;
  const check = (id, test, msg) => { const el = document.getElementById(id), er = el.closest("div,fieldset").querySelector(".err"); const bad = !test(el.value.trim());
    er.hidden = !bad; er.textContent = bad ? msg : ""; el.setAttribute("aria-invalid", bad); if(bad){ ok = false; first = first || el; } };
  check("f_name", v => v, "お名前を入れてください");
  check("f_mail", v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "メールアドレスの形を確かめてください（例：name@example.com）");
  check("f_kind", v => v, "ご用件を選んでください");
  const kind = kindEl.value;
  if(kind==="レッスン") check("f_plan", v => v, "希望プランを選んでください");
  if(kind==="お仕事"){ check("f_company", v => v, "会社名・団体名を入れてください（個人の方は「個人」）"); check("f_budget", v => v, "ご予算を選んでください"); }
  if(kind==="お仕事"){ const box = document.getElementById("f_jobs"), er = box.querySelector(".err"), none = !box.querySelector("input:checked");
    er.hidden = !none; er.textContent = none ? "ご依頼の内容を1つ以上選んでください" : ""; if(none){ ok = false; first = first || box.querySelector("input"); } }
  if(kind!=="レッスン" && kind!=="お仕事") check("f_msg", v => v, "メッセージを入れてください");
  if(!ok){ (first.type==="hidden" ? document.querySelector('input[name="kind"]') : first).focus(); return; }
  /* Googleフォームへ送る（届いた内容はスプレッドシートにたまり、メールでお知らせが来る） */
  const F = CFG.form, v = id => document.getElementById(id).value.trim(), btn = document.getElementById("send");
  /* 追加の項目は「メッセージ」の頭にまとめて送る（Googleフォームの設定はそのまま） */
  const sel = n => [...document.querySelectorAll(`input[name="${n}"]:checked`)].map(x => x.value).join("、");
  const extra = kind==="レッスン" ? [["希望プラン",v("f_plan")],["ギター歴",v("f_level")],["受ける場所",sel("f_place")],["希望の曜日・時間",v("f_when")]]
    : kind==="お仕事" ? [["会社名・団体名",v("f_company")],["ご依頼の内容",sel("f_job")],["使い道",v("f_use")],["ご予算",v("f_budget")],["納期",v("f_due")],["参考音源",v("f_ref")]] : [];
  const head = extra.filter(x => x[1]).map(x => `【${x[0]}】${x[1]}`).join("\n");
  const msg = [head, v("f_msg")].filter(Boolean).join("\n\n");
  const sub = v("f_sub") || (kind==="レッスン" ? `レッスンの申し込み（${v("f_plan")}）` : kind==="お仕事" ? `お仕事のご相談（${sel("f_job")}）` : "");
  const body = new URLSearchParams({[F.kind]:v("f_kind"),[F.name]:v("f_name"),[F.email]:v("f_mail"),[F.subject]:sub,[F.message]:msg,[F.from]:v("f_from")});
  btn.disabled = true; btn.textContent = "送信中…"; document.getElementById("sendErr").hidden = true;
  fetch(F.action, {method:"POST", mode:"no-cors", body})
    .then(() => { document.getElementById("form").querySelectorAll("input,textarea,button,select").forEach(x => x.disabled = true); btn.textContent = "送信しました"; document.getElementById("done").hidden = false; })
    .catch(() => { btn.disabled = false; btn.textContent = "この内容で送る"; document.getElementById("sendErr").hidden = false; });
});
})();

/* 曲の横並び：PC の矢印ボタンで1曲ずつ送る */
document.querySelectorAll("[data-rail]").forEach(b => b.addEventListener("click", () => {
  const el = document.getElementById("feat"); if(!el) return;
  const card = el.querySelector(".song"); const step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap||0) : el.clientWidth*.8;
  el.scrollBy({left: step * Number(b.dataset.rail), behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth"});
}));
