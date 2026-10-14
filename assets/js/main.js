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
  if(b.dataset.plan){ document.getElementById("f_sub").value = `レッスンの申し込み（${b.dataset.plan}）`; }
  document.getElementById("contact").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
  setTimeout(() => document.getElementById("f_name").focus({preventScroll:true}), 600);
});
/* ご用件のカード */
const kindEl = document.getElementById("f_kind");
function setKind(v){ kindEl.value = v; document.querySelectorAll('input[name="kind"]').forEach(r => r.checked = r.value===v); }
document.querySelectorAll('input[name="kind"]').forEach(r => r.addEventListener("change", () => { kindEl.value = r.value; }));
/* 絞り込みチップ */
document.querySelectorAll(".filters").forEach(g => g.addEventListener("click", e => {
  const b = e.target.closest(".fchip"); if(!b) return;
  g.querySelectorAll(".fchip").forEach(x => x.setAttribute("aria-pressed", x===b));
  document.querySelectorAll(`#${g.dataset.grid} > li`).forEach(li => li.hidden = !(b.dataset.f==="ALL" || li.dataset.k===b.dataset.f));
}));
/* 横スクロールの矢印 */
document.querySelectorAll(".arw").forEach(b => b.addEventListener("click", () => { const el = document.getElementById(b.dataset.for); el.scrollBy({left: el.clientWidth*.8*Number(b.dataset.dir), behavior:"smooth"}); }));
/* WORKS のカテゴリ → 全実績を開く */
document.querySelectorAll(".cat").forEach(b => b.addEventListener("click", () => { const d = document.getElementById("credits"); d.open = true; d.scrollIntoView({behavior:"smooth",block:"start"}); }));

/* Spotify ミニプレイヤー（1つだけ） */
document.querySelectorAll(".art[data-track]").forEach(b => b.addEventListener("click", () => {
  const pl = document.getElementById("player");
  document.querySelectorAll(".song.on").forEach(x => x.classList.remove("on")); b.closest(".song").classList.add("on");
  pl.innerHTML = `<iframe title="Spotify プレイヤー" src="https://open.spotify.com/embed/track/${b.dataset.track}?utm_source=generator&theme=0" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  pl.scrollIntoView({behavior:"smooth",block:"nearest"});
}));
const feEl = document.getElementById("feat"), dots = document.querySelectorAll(".swipe .dots i");
feEl.addEventListener("scroll", () => { const w = feEl.scrollWidth - feEl.clientWidth; const i = w>0 ? Math.round(feEl.scrollLeft/w*(dots.length-1)) : 0; dots.forEach((d,j)=>d.classList.toggle("on",i===j)); }, {passive:true});

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
  check("f_msg", v => v, "メッセージを入れてください");
  if(!ok){ (first.type==="hidden" ? document.querySelector('input[name="kind"]') : first).focus(); return; }
  /* Googleフォームへ送る（届いた内容はスプレッドシートにたまり、メールでお知らせが来る） */
  const F = CFG.form, v = id => document.getElementById(id).value.trim(), btn = document.getElementById("send");
  const body = new URLSearchParams({[F.kind]:v("f_kind"),[F.name]:v("f_name"),[F.email]:v("f_mail"),[F.subject]:v("f_sub"),[F.message]:v("f_msg"),[F.from]:v("f_from")});
  btn.disabled = true; btn.textContent = "送信中…"; document.getElementById("sendErr").hidden = true;
  fetch(F.action, {method:"POST", mode:"no-cors", body})
    .then(() => { document.getElementById("form").querySelectorAll("input,textarea,button").forEach(x => x.disabled = true); btn.textContent = "送信しました"; document.getElementById("done").hidden = false; })
    .catch(() => { btn.disabled = false; btn.textContent = "この内容で送る"; document.getElementById("sendErr").hidden = false; });
});
})();
