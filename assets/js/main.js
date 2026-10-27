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
  /* レッスンのページ（フォームがないページ）では、トップのフォームへ移る */
  if(!document.getElementById("contact")){ location.href = "./#contact"; return; }
  closeMenu(); setKind(b.dataset.open);
  const fp = document.getElementById("f_plan"); if(b.dataset.plan && fp){ fp.value = b.dataset.plan; trialGo(); }
  document.getElementById("contact").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
  setTimeout(() => document.getElementById("f_name").focus({preventScroll:true}), 600);
});
/* 希望プランで「体験レッスン」を選んだら、予約ページへの案内を出す */
function trialGo(){ const g = document.getElementById("trialGo"), fp = document.getElementById("f_plan"); if(g && fp) g.hidden = fp.value !== "体験レッスン"; }
if(document.getElementById("f_plan")) document.getElementById("f_plan").addEventListener("change", trialGo);
/* ご用件のカード */
const kindEl = document.getElementById("f_kind");
/* ご用件で、下の入力欄を切り替える（レッスン／お仕事／その他） */
const PH = {"レッスンのご質問":"体験の前に聞きたいこと、生徒さんのご連絡など","レッスン":"ご質問や、レッスンで弾けるようになりたい曲など（なくても大丈夫です）","お仕事":"曲の雰囲気、尺、使い道など（なくても大丈夫です）","その他":"ご用件をお書きください"};
function applyKind(v){ kindEl.value = v;
  document.querySelectorAll(".xf").forEach(x => x.classList.toggle("on", x.dataset.for===v));
  document.getElementById("f_msg").placeholder = PH[v] || "ご希望の内容、日程、納期など";
  document.getElementById("msgReq").hidden = v==="レッスン" || v==="お仕事";
  const les = /^レッスン/.test(v), sb = document.getElementById("send"); sb.classList.toggle("or", les); sb.classList.toggle("gr", !les);
  document.getElementById("f_sub").placeholder = v==="お仕事" ? "例：楽曲制作のご相談" : v==="レッスンのご質問" ? "例：オンラインのレッスンについて" : v==="レッスン" ? "例：体験レッスンの希望日について" : "例：取材のご依頼";
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
/* すべての制作実績：「もっと見る」を開いたら（絞り込んだときも自動で開く）、スマホで隠していた5〜8枚目も出す */
{ const cm = document.getElementById("cgridMore"), cw = document.getElementById("credits");
  if(cm && cw) cm.addEventListener("toggle", () => cw.classList.toggle("all", cm.open)); }
/* 横スクロールの矢印 */
document.querySelectorAll(".arw").forEach(b => b.addEventListener("click", () => { const el = document.getElementById(b.dataset.for); el.scrollBy({left: el.clientWidth*.8*Number(b.dataset.dir), behavior:"smooth"}); }));
/* WORKS のタブ（楽曲／ライブ・TV） */
const tabs = [...document.querySelectorAll('.seg [role="tab"]')];
function showTab(name){ tabs.forEach(t => { const on = t.dataset.tab===name; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute("aria-controls")).classList.toggle("on", on); }); }
tabs.forEach(t => { t.addEventListener("click", () => showTab(t.dataset.tab));
  t.addEventListener("keydown", e => { if(e.key!=="ArrowRight" && e.key!=="ArrowLeft") return; const i = (tabs.indexOf(t) + (e.key==="ArrowRight"?1:-1) + tabs.length) % tabs.length; tabs[i].focus(); showTab(tabs[i].dataset.tab); }); });
document.querySelectorAll("[data-tab-go]").forEach(a => a.addEventListener("click", () => showTab(a.dataset.tabGo)));

/* ジャケットの再生ボタン：どの曲も1回押せば切り替わる。別の曲を押すと前の曲は止まる（Spotify の埋め込みを1つだけ使う）
   2026-10-17 直し：前は「曲の読み込み（loadUri）が終わる前に再生の合図（play）を送っていた」ため、合図が空振りして
   止まったままになり、もう1回押さないと鳴らなかった。いまは読み込みが終わった合図（ready）を待ってから再生する。
   読み込み中に前の曲の「止まった」知らせが来ても、ボタンの見た目を戻さない（押した曲だけが光る）。
   押したかどうかは click だけで決める（ホバーの見た目には頼らない）ので、iPhone でも1回のタップで動く。 */
const arts = [...document.querySelectorAll(".art[data-track]")], host = document.getElementById("spHost");
let heard = false;
/* 鳴らせなかったときの小さな案内（下に数秒だけ）。押すと Spotify でその曲を開く */
const tip = document.createElement("a"); tip.className = "sp-tip"; tip.target = "_blank"; tip.rel = "noopener"; tip.hidden = true; document.body.appendChild(tip);
let tipT = 0;
function hideTip(){ tip.classList.remove("on"); clearTimeout(tipT); tipT = setTimeout(() => tip.hidden = true, 300); }
function noPlay(b){ setUI(b, false);
  tip.href = "https://open.spotify.com/track/" + b.dataset.track; tip.innerHTML = "<b>Spotify で聴く</b><span>この画面では再生できませんでした ↗</span>";
  clearTimeout(tipT); tip.hidden = false; requestAnimationFrame(() => tip.classList.add("on")); tipT = setTimeout(hideTip, 5000); }
tip.addEventListener("click", () => setTimeout(hideTip, 100));
let ctrl = null, cur = null, apiAsked = false, apiFailed = false, loading = false, loadedUri = "", playTimer = 0, showTimer = 0;
const uriOf = b => "spotify:track:" + b.dataset.track;
const touchUI = matchMedia("(hover:none)");
const setUI = (b, playing) => { arts.forEach(x => { const on = x===b && playing; x.closest(".song").classList.toggle("playing", on); x.setAttribute("aria-pressed", on); });
  /* 制作実績のレコード：鳴っている曲のレコードだけ回す */
  document.querySelectorAll(".vinyl[data-rtrack]").forEach(v => { const on = playing && b && v.dataset.rtrack===b.dataset.track; v.classList.toggle("spin", on); v.setAttribute("aria-pressed", on); }); };
function loadApi(){
  if(apiAsked || !arts.length) return; apiAsked = true;
  window.onSpotifyIframeApiReady = api => api.createController(document.getElementById("spEmbed"), {uri:uriOf(arts[0]), width:"100%", height:80}, c => {
    ctrl = c; loadedUri = uriOf(arts[0]);
    /* 読み込みが終わったら、待っていた曲を鳴らす */
    c.addListener("ready", () => { if(loading && cur){ loading = false; clearTimeout(playTimer); c.play(); } });
    c.addListener("playback_update", e => { const d = e.data || {}; if(!cur) return;
      if(d.playingURI && d.playingURI !== uriOf(cur)) return;   // 前の曲の知らせは無視する
      if(loading && d.isPaused) return;                         // 読み込み中の「止まった」は無視する
      if(!d.isPaused){ loading = false; heard = true; clearTimeout(showTimer); hideTip(); }
      setUI(cur, !d.isPaused);
      const bar = cur.querySelector(".bar i"); if(bar && d.duration) bar.style.transform = `scaleX(${Math.min(1, d.position/d.duration)})`; });
    if(cur) start(cur);
  });
  const sc = document.createElement("script"); sc.src = "https://open.spotify.com/embed/iframe-api/v1"; sc.async = true; sc.onerror = () => { apiFailed = true; if(cur) setUI(cur, false); }; document.head.appendChild(sc);
}
function start(b){
  clearTimeout(playTimer); clearTimeout(showTimer);
  if(!ctrl){ loadApi(); setTimeout(() => { if(!ctrl && cur===b) setUI(b, false); }, 6000); return; }
  const uri = uriOf(b);
  if(uri === loadedUri){ loading = false; ctrl.play(); }        // もう読み込んである曲は、そのまま鳴らす
  else {
    loading = true; loadedUri = uri; ctrl.loadUri(uri);
    /* ready の合図が来ないときの保険：少し待ってから再生の合図を送る */
    playTimer = setTimeout(() => { if(loading && cur===b){ loading = false; ctrl.play(); } }, 1500);
  }
  /* 2026-10-27：下に Spotify のプレイヤーの窓は出さない（北川くん）。
     少し待っても鳴らないとき（スマホで Spotify が自動の再生を止めた等）だけ、小さな「Spotify で聴く」の案内を出す */
  heard = false;
  showTimer = setTimeout(() => { if(cur===b && !heard) noPlay(b); }, touchUI.matches ? 2600 : 3600);
}
/* 押したら鳴らす（上のジャケットと、上に並んでいない曲のレコードの両方で使う） */
function press(b){
  if(apiFailed){ window.open("https://open.spotify.com/track/"+b.dataset.track, "_blank", "noopener"); return; }   // 埋め込みが読めないときは Spotify を開く
  if(cur===b && ctrl && !loading){ ctrl.togglePlay(); return; }   // 同じ曲をもう一度押したら 止める／また鳴らす
  arts.forEach(x => { const bar = x.querySelector(".bar i"); if(bar) bar.style.transform = "scaleX(0)"; });
  cur = b; setUI(b, true); start(b);
}
arts.forEach(b => b.addEventListener("click", () => press(b)));
const featEl = document.getElementById("feat");
if(featEl && "IntersectionObserver" in window){ const o = new IntersectionObserver(es => { if(es.some(e=>e.isIntersecting)){ loadApi(); o.disconnect(); } }, {rootMargin:"600px 0px"}); o.observe(featEl); }
/* 制作実績のレコード：押すと上の再生ボタンと同じしくみで鳴らす（1回で切り替わる）。ジャケットのない作品は回るだけ */
/* Step 3：再生中のレコード（と、つかんで回しているレコード）から ♪ がふわっと飛び出す。音は出さない。「視差効果を減らす」の人には出さない */
const NOTE_SVG = [
  '<svg viewBox="0 0 20 28"><path d="M13 3v17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M13 3c3 1.5 5.5 3.5 4.5 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="9" cy="21" rx="4.6" ry="3.5" transform="rotate(-20 9 21)" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 30 28"><path d="M9 21V5l16-3v16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 5l16-3v4L9 9z" fill="currentColor"/><ellipse cx="5.5" cy="21.5" rx="4.4" ry="3.3" transform="rotate(-20 5.5 21.5)" fill="currentColor"/><ellipse cx="21.5" cy="18.5" rx="4.4" ry="3.3" transform="rotate(-20 21.5 18.5)" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 20 28"><path d="M13 3v17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="9" cy="21" rx="4.6" ry="3.5" transform="rotate(-20 9 21)" fill="currentColor"/></svg>'
];
function popNote(v){
  if(reduce.matches) return;
  const li = v.closest(".vrec"); if(!li) return;
  const n = document.createElement("i"); n.className = "vnote c" + (Math.random()*3|0); n.setAttribute("aria-hidden","true");
  n.innerHTML = NOTE_SVG[Math.random()*NOTE_SVG.length|0];
  const w = v.offsetWidth, a = (-150 + Math.random()*120) * Math.PI/180;   // 上半分の、ふちのあたりから出す
  n.style.left = (v.offsetLeft + w/2 + Math.cos(a)*w*.42) + "px"; n.style.top = (v.offsetTop + w/2 + Math.sin(a)*w*.42) + "px";
  n.style.setProperty("--dx", (Math.cos(a)*w*.35 + (Math.random()-.5)*20).toFixed(0) + "px");
  n.style.setProperty("--dy", (-w*.35 - Math.random()*w*.25).toFixed(0) + "px");
  n.style.setProperty("--r", ((Math.random()-.5)*50).toFixed(0) + "deg");
  n.style.setProperty("--s", (.75 + Math.random()*.5).toFixed(2));
  li.appendChild(n); n.addEventListener("animationend", () => n.remove());
}
setInterval(() => { if(document.hidden) return; document.querySelectorAll(".vrec .vinyl.spin:not(.grab)").forEach(v => { const r = v.getBoundingClientRect(); if(r.bottom > 0 && r.top < innerHeight) popNote(v); }); }, 650);

/* Step 2：レコードを指やマウスでつかんで回せる（スクラッチ）。少しだけ動かしたときは「押した」として再生、回したときは再生しない。
   離すと勢いで少し回り続けて止まる。回っている（再生中の）レコードは、つかんでいるあいだ自動の回転を止める */
document.querySelectorAll(".vrec .vinyl").forEach(v => {
  const pp = v.querySelector(".vpp"); let rot = 0, last = 0, lastT = 0, vel = 0, drag = null, moved = false, raf = 0;
  const setRot = d => { rot = d; v.style.rotate = rot + "deg"; if(pp) pp.style.rotate = (-rot) + "deg"; };
  const ang = e => { const r = v.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height/2), e.clientX - (r.left + r.width/2)) * 180 / Math.PI; };
  v.addEventListener("pointerdown", e => { if(e.button > 0) return; cancelAnimationFrame(raf); drag = e.pointerId; moved = false; last = ang(e); lastT = performance.now(); vel = 0;
    v.setPointerCapture(e.pointerId); v.classList.add("grab"); });
  v.addEventListener("pointermove", e => { if(drag !== e.pointerId) return;
    let a = ang(e), d = a - last; if(d > 180) d -= 360; if(d < -180) d += 360;
    if(!moved && Math.abs(d) < 4) return; moved = true;
    const t = performance.now(); vel = d / Math.max(8, t - lastT); last = a; lastT = t; setRot(rot + d);
    if(t - (v._np||0) > 160 && Math.abs(d) > 3){ v._np = t; popNote(v); } });   // 回しているあいだも ♪ が飛ぶ
  const end = e => { if(drag !== e.pointerId) return; drag = null; v.classList.remove("grab");
    if(moved){ v.dataset.dragged = "1"; setTimeout(() => delete v.dataset.dragged, 50);
      if(!reduce.matches){ let w = vel * 16; const step = () => { w *= .94; if(Math.abs(w) < .2) return; setRot(rot + w); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); } } };
  v.addEventListener("pointerup", end); v.addEventListener("pointercancel", end);
});
document.querySelectorAll(".vinyl").forEach(v => v.addEventListener("click", e => { if(v.dataset.dragged){ e.preventDefault(); return; }
  const id = v.dataset.rtrack;
  if(id){ const art = arts.find(x => x.dataset.track===id); if(art) art.click(); else { v.dataset.track = id; loadApi(); press(v); } return; }
  const on = !v.classList.contains("spin"); v.classList.toggle("spin", on); v.setAttribute("aria-pressed", on);
}));
/* 横スクロールの点（すぐ後ろの「横にスワイプ」と連動） */
document.querySelectorAll(".hs").forEach(el => {
  const sw = el.nextElementSibling; if(!sw || !sw.classList.contains("swipe")) return;
  const dots = sw.querySelectorAll(".dots i");
  const upd = () => { const w = el.scrollWidth - el.clientWidth; const i = w>0 ? Math.round(el.scrollLeft/w*(dots.length-1)) : 0; dots.forEach((d,j)=>d.classList.toggle("on",i===j)); };
  el.addEventListener("scroll", upd, {passive:true}); upd();
});
/* 料金はスマホでは「人気No.1」（月4回）が見える位置から */
const plansEl = document.getElementById("plans"), rec = plansEl && plansEl.querySelector(".rec");
if(rec && matchMedia("(max-width:820px)").matches) plansEl.scrollLeft = rec.offsetLeft - (plansEl.clientWidth - rec.offsetWidth) / 2;   // 人気No.1 を真ん中に

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
    d.classList.toggle("closing", !opening);
    d._a.onfinish = () => { d._a = null; d.style.overflow = ""; d.classList.remove("closing"); if(!opening) d.open = false; };
    d._a.oncancel = () => { d._a = null; d.style.overflow = ""; d.classList.remove("closing"); };
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
  const ctEl = document.getElementById("contact"); if(ctEl) ct.observe(ctEl);
  const show = t => { t.classList.add("in"); if(t.classList.contains("rv")) setTimeout(() => { t.style.transitionDelay = ""; t.classList.add("settled"); }, 1200); };
  const rv = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ const t = e.target; rv.unobserve(t); [t].concat(t._rv || []).forEach(show); } }), {rootMargin:"0px 0px -8% 0px"});
  /* 横に並んだカードの列（料金・はじめるまで・生徒さんの声など）は、列が画面に入ったら全部いっしょに出す
     （1枚ずつだと、横の見えていないカードが下にずれたまま残り、スワイプしたときに縦に動いて見えるため）2026-10-27 */
  const rowOf = c => c.closest(".hs, .feat, .shelf");
  document.querySelectorAll(".reveal").forEach(x => rv.observe(x));
  /* できることのカードは、画面に入った順に1枚ずつ出る（同時に入ったときは少しずつずらす） */
  document.querySelectorAll("#main .card").forEach(c => { const i = [...c.parentElement.children].indexOf(c); c.classList.add("rv");
    const ms = c.classList.contains("sk3") ? i*180 : c.closest("#lesson") ? (i%6)*130 : (i%6)*70; c.style.transitionDelay = `${ms}ms`; if(c.classList.contains("sk3")) c.style.setProperty("--cd", ms+"ms");
    const row = rowOf(c); if(row){ if(!row._rv){ row._rv = []; rv.observe(row); } row._rv.push(c); } else rv.observe(c); });
} else document.querySelectorAll(".reveal").forEach(x => x.classList.add("in"));

/* Profile の3枚のイラスト：触る（マウスを乗せる・指で触る）と少し動く */
document.querySelectorAll(".sk3").forEach(c => {
  const play = () => { if(reduce.matches || c.classList.contains("play")) return; c.classList.add("play"); setTimeout(() => c.classList.remove("play"), 1400); };
  c.addEventListener("pointerenter", play); c.addEventListener("touchstart", play, {passive:true});
});

/* 五線譜リボン（2026-10-27 作り直し・北川くん）
   ・音符は五線のカーブに乗って流れる（1つのループで動かす。見えているときだけ）
   ・触ったところを中心に、ギターの弦のように揺れて、だんだんおさまる（5本が少しずつずれて揺れる）
   ・「視差効果を減らす」の人には動かさない（render.mjs が書き出した止まった形のまま） */
document.querySelectorAll(".ribbon.wave").forEach(r => {
  const R1 = n => Math.round(n*10)/10;
  const S = [...r.querySelectorAll("svg.staffs")].map(sv => {
    const RW = +sv.dataset.rw, rev = sv.dataset.rev === "1";
    const xs = []; for(let x=-160; x<=RW+160; x+=10) xs.push(x); if(rev) xs.reverse();
    const layers = [...sv.querySelectorAll(".st-layer")].map(g => { const [c,a,k,ph] = g.dataset.f.split(",").map(Number);
      return { front: g.classList.contains("st-front"), c, a, k, ph, s: +g.dataset.s, dur: +g.dataset.dur,
        lines: [...g.querySelectorAll(".ln")], notes: [...g.querySelectorAll(".nt")], still: true }; });
    return { sv, RW, rev, xs, layers, pl: [] };
  });
  /* 揺れ（2026-10-27 北川くん「もっとゆっくり、水の波紋みたいに」）：
     触った点から、ゆっくりした波が左右へ広がっていく。遠くへ行くほど・時間がたつほど小さくなる */
  const RP = { f: 1.15, lam: 230, tau: 1.25, far: 520, edge: 90 };   // 1秒に約1回ゆれる／波の長さ／おさまる速さ／届く距離／波の先のぼかし
  const disp = (st, x, t, lag, amp) => { let y = 0; const v = RP.lam * RP.f;
    for(const p of st.pl){ const u = t - p.t0 - lag; if(u <= 0) continue;
      const r = Math.abs(x - p.x), front = v * u - r; if(front <= 0) continue;
      const fade = Math.min(1, front / RP.edge), m = fade * fade * (3 - 2 * fade);   // 波の先はなめらかに
      y += p.a * amp * m * Math.exp(-u / RP.tau) * Math.exp(-r / RP.far) * Math.sin(2 * Math.PI * (RP.f * u - r / RP.lam)); }
    return y; };
  const fy = (L, x) => L.c + L.a * Math.sin(L.k*x + L.ph), fd = (L, x) => L.a * L.k * Math.cos(L.k*x + L.ph);
  function drawLines(st, L, t){
    const amp = L.front ? 1 : .45, base = L.front ? 0 : .12;
    L.lines.forEach((el, j) => { const d = (j - 2) * L.s, lag = base + j * .03;
      el.setAttribute("d", "M" + st.xs.map(x => { const dy = fd(L, x), n = Math.hypot(1, dy);
        return R1(x - d*dy/n) + " " + R1(fy(L, x) + d/n + disp(st, x, t, lag, amp)); }).join(" L")); });
  }
  function drawNotes(st, L, t){
    const n = L.notes.length, span = st.RW + 320, amp = L.front ? 1 : .45, lag = (L.front ? 0 : .12) + .06;
    L.notes.forEach((el, i) => { const u = ((t / L.dur) + i / n) % 1, x = st.rev ? st.RW + 160 - span*u : -160 + span*u;
      const y = fy(L, x) + disp(st, x, t, lag, amp), a = Math.atan(fd(L, x)) * 57.2958;
      el.setAttribute("transform", `translate(${R1(x)} ${R1(y)}) rotate(${R1(a)})`); });
  }
  let seen = false, raf = 0, t0 = 0;
  const now = () => (performance.now() - t0) / 1000;
  const live = st => st.sv.getClientRects().length > 0;
  /* 軽くする（2026-10-27）：揺れていないときは、音符の位置の書きかえを1秒に約30回にする（ゆっくり流れているので見た目は変わらない）。
     スクロール中のスマホが重くならないように */
  let tick = 0;
  function frame(){
    raf = 0; if(!seen || reduce.matches) return;
    const t = now(), busy = S.some(st => st.pl.length);
    if(!busy && (tick++ & 1)){ raf = requestAnimationFrame(frame); return; }
    S.forEach(st => { if(!live(st)) return;
      st.pl = st.pl.filter(p => t - p.t0 < 5);
      const moving = st.pl.length > 0;
      st.layers.forEach(L => { if(moving || !L.still){ drawLines(st, L, t); L.still = !moving; } drawNotes(st, L, t); }); });
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if(!raf && seen && !reduce.matches) raf = requestAnimationFrame(frame); };
  t0 = performance.now();
  /* 触ったところ（画面の位置 → 五線の中の位置）で弾く。マウスが通ったら軽く、押したら強く */
  function pluck(st, e, a){
    if(reduce.matches) return;
    const m = st.sv.getScreenCTM(); if(!m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), t = now();
    if(st.pl.some(p => t - p.t0 < .35 && Math.abs(p.x - pt.x) < 80)) return;
    st.pl.push({ x: pt.x, t0: t, a }); if(st.pl.length > 5) st.pl.shift(); run();
  }
  S.forEach(st => { const h = st.sv.querySelector(".hit");
    h.addEventListener("pointerenter", e => pluck(st, e, e.pointerType === "mouse" ? 14 : 20));
    h.addEventListener("pointerdown", e => pluck(st, e, 24)); });
  if("IntersectionObserver" in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; run(); }, {rootMargin:"100px 0px"}).observe(r); else { seen = true; run(); }
  reduce.addEventListener("change", run);
});

/* お仕事のご依頼「進め方」：1つずつ順番に出す（同時に画面に入ったときは 0.18秒ずつずらす） */
const sts = [...document.querySelectorAll(".steps .st")];
if(sts.length && "IntersectionObserver" in window && !reduce.matches){
  let q = 0, t0 = 0;
  const io3 = new IntersectionObserver(es => es.filter(e => e.isIntersecting).forEach(e => { const now = performance.now(); if(now - t0 > 400) q = 0; t0 = now;
    const el = e.target; setTimeout(() => el.classList.add("in"), (q++) * 180); io3.unobserve(el); }), {rootMargin:"0px 0px -12% 0px"});
  sts.forEach(x => io3.observe(x));
} else sts.forEach(x => x.classList.add("in"));

/* B5：料金カードを触ると、キラッと光る */
document.querySelectorAll(".glint").forEach(g => { const c = g.parentElement;
  const go = () => { if(reduce.matches || c.classList.contains("shine")) return; c.classList.add("shine"); };
  c.addEventListener("pointerenter", go); c.addEventListener("touchstart", go, {passive:true});
  g.addEventListener("animationend", () => c.classList.remove("shine"));
});
/* B6：年表。画面の真ん中に来た年の行に印をつける（スクロールの位置で反応。PC もスマホも同じ） */
const tl = document.querySelector(".tl");
if(tl && "IntersectionObserver" in window){
  const rows = [...tl.querySelectorAll(".tly")];
  const setLive = () => tl.classList.toggle("live", !reduce.matches);
  setLive(); reduce.addEventListener("change", setLive);
  const io2 = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting) rows.forEach(r => r.classList.toggle("now", r===e.target)); }), {rootMargin:"-45% 0px -45% 0px"});
  rows.forEach(r => io2.observe(r));
}

/* 背景の真空管：スクロールに合わせて少しだけずらす（奥行き） */
const pbgs = [...document.querySelectorAll(".pbg i")];
/* スマホ（指で触る画面）は CSS だけで動かす（JS で毎回ずらすと iPhone でカクつくため） */
const touchBg = matchMedia("(max-width:820px), (pointer:coarse)");
if(pbgs.length && !reduce.matches){
  let tick = false;
  const par = () => { tick = false; const vh = innerHeight;
    if(touchBg.matches){ pbgs.forEach(i => i.style.removeProperty("--py")); return; }
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
if(document.getElementById("form")){
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
  const sub = v("f_sub") || (kind==="レッスンのご質問" ? "レッスンのご質問" : kind==="レッスン" ? `レッスンの申し込み（${v("f_plan")}）` : kind==="お仕事" ? `お仕事のご相談（${sel("f_job")}）` : "");
  const body = new URLSearchParams({[F.kind]:v("f_kind"),[F.name]:v("f_name"),[F.email]:v("f_mail"),[F.subject]:sub,[F.message]:msg,[F.from]:v("f_from")});
  btn.disabled = true; btn.textContent = "送信中…"; document.getElementById("sendErr").hidden = true;
  fetch(F.action, {method:"POST", mode:"no-cors", body})
    .then(() => { document.getElementById("form").querySelectorAll("input,textarea,button,select").forEach(x => x.disabled = true); btn.textContent = "送信しました"; document.getElementById("done").hidden = false; })
    .catch(() => { btn.disabled = false; btn.textContent = "この内容で送る"; document.getElementById("sendErr").hidden = false; });
});
}
})();

/* 曲の横並び：PC の矢印ボタンで1曲ずつ送る */
document.querySelectorAll("[data-rail]").forEach(b => b.addEventListener("click", () => {
  const el = document.getElementById("feat"); if(!el) return;
  const card = el.querySelector(".song"); const step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap||0) : el.clientWidth*.8;
  el.scrollBy({left: step * Number(b.dataset.rail), behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth"});
}));
