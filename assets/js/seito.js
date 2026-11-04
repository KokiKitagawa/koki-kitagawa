/* seito.js — 生徒さん専用の予約ページ（seito.html?k=合言葉）の動き
   生徒さんの情報・残りの回数・空き枠は Apps Script（Googleカレンダー）から読む。
   ?demo=1 を付けると、見本の生徒さんで動きだけ確かめられる（送信はしない）。&out=1 で「今月の回数を使い切った」見本。
   2026-10-25：何日分でも、まとめて選んで1回で予約できる（スタジオもオンラインも、その場で確定。部屋は前の日に北川くんが取る）。
   2026-10-27：使わなかった回は、キャンセルしなくても次の月に回せる（今月2回・来月6回など）。選んだ日ごとに「〇月の何回目」を出す。
     追加（単発）をキャンセルしても「次の月まで使えます」と出さない。LINE がまだの人に「LINE でお知らせを受け取る」ボタン。
   2026-11-04：1画面ずつ進む形に（0 はじめ → 1 受け方 → 2 時間 → 3 日時 → 4 確認）。日時は1回ずつ「決定」して、
     いま何回目を選んでいるかを大きく出す。残りの回数は選ぶたびに変わる。?go=yoyaku で受け方の画面から開く（LINE のメニュー）。 */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = JSON.parse($("ykcfg").textContent);
  const qs = new URLSearchParams(location.search);
  const demo = qs.get("demo") === "1", demoOut = qs.get("out") === "1";
  const key = (qs.get("k") || "").trim();
  const H = 3600e3, TZ = "Asia/Tokyo", W = ["日","月","火","水","木","金","土"];
  const form = $("yk"), days = $("ykDays"), times = $("ykTimes"), picked = $("ykPicked");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
  const yen = n => "¥" + Number(n).toLocaleString("ja-JP");
  const J = t => new Date(t + 9 * H);
  const dayKey = t => J(t).toISOString().slice(0, 10);
  const monKey = t => J(t).toISOString().slice(0, 7);
  const wd = t => W[J(t).getUTCDay()];
  const md = t => (J(t).getUTCMonth() + 1) + "/" + J(t).getUTCDate();
  const hm = t => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(t));
  const full = t => `${J(t).getUTCMonth() + 1}月${J(t).getUTCDate()}日（${wd(t)}）${hm(t)}`;
  const span = (t, h) => `${full(t)}〜${hm(t + h * H)}`;
  const monName = m => Number(m.slice(5, 7)) + "月";

  let me = null, mode = "", hours = 1, day = "", pick = [], cur = 0, step = 0, first = true;

  /* ---------- 回数の数え方（コード.gs の「回数を数える」「月謝にできる数」と同じ） ---------- */
  const USED = ["仮", "確定", "キャンセル（1回分）"];
  const nextM = m => { let y = +m.slice(0, 4), n = +m.slice(5, 7) + 1; if (n > 12) { n = 1; y++; } return y + "-" + String(n).padStart(2, "0"); };
  function count(base, start, ls, want){
    const keys = ls.map(x => x.m).concat(want || []).concat([start]).filter(Boolean).sort(), out = {};
    if (!keys.length) return out;
    let carry = 0;
    for (let m = keys[0]; m <= keys[keys.length - 1]; m = nextM(m)) {
      const b = m >= start ? base : 0;
      const used = ls.filter(x => x.m === m && USED.includes(x.state)).reduce((a, x) => a + x.getsu, 0);
      out[m] = { base: b, carry, used, left: Math.max(0, b + carry - used), over: used > b + carry };
      carry = Math.max(0, b - Math.max(0, used - carry));   // 使わなかった回は次の月まで
    }
    return out;
  }
  function canGetsu(base, start, ls, m, n){
    const nx = nextM(m), before = count(base, start, ls, [m, nx]);
    for (let k = n; k > 0; k--) {
      const s = count(base, start, ls.concat([{ m, state: "仮", getsu: k }]), [m, nx]);
      if ((!s[m].over || before[m].over) && (!s[nx].over || before[nx].over)) return k;
    }
    return 0;
  }

  /* ---------- 見本 ---------- */
  function demoSlots(){
    const out = [], now = Date.now(), start = new Date(dayKey(now) + "T00:00:00+09:00").getTime();
    for (let i = 1; i <= 30; i++) {
      const d0 = start + i * 864e5, w = J(d0).getUTCDay();
      const hrs = w === 3 || w === 4 || w === 5 ? [16,17,18,19,20,21,22] : w === 0 || w === 6 ? [12,13,14,15,16,17,18,19] : [];
      hrs.forEach((h, j) => { if ((i * 7 + j * 3) % 6 === 0) return; const s = d0 + h * H; out.push({ s, st: s - now > 48 * H ? 1 : 0 }); });
    }
    return out;
  }
  function demoMe(){
    const now = Date.now(), m0 = monKey(now), y = +m0.slice(0, 4), n = +m0.slice(5, 7);
    const m1 = n === 12 ? (y + 1) + "-01" : y + "-" + String(n + 1).padStart(2, "0"), sl = demoSlots().filter(s => s.st);
    return { ok: true, name: "山田 花子", plan: "月4回", base: 4, single: cfg.single, max: 4, days: 12,
      months: demoOut ? [{ m: m0, base: 4, carry: 0, used: 4, left: 0 }, { m: m1, base: 4, carry: 0, used: 0, left: 4 }]
                      : [{ m: m0, base: 4, carry: 1, used: 3, left: 2 }, { m: m1, base: 4, carry: 0, used: 0, left: 4 }],
      quota: demoOut ? { [m0]: Array(25).fill(0), [m1]: Array.from({ length: 25 }, (_, n) => Math.min(n, 4)) } : { [m0]: Array.from({ length: 25 }, (_, n) => Math.min(n, 2)), [m1]: Array.from({ length: 25 }, (_, n) => Math.min(n, 4)) },
      lessons: [{ id: "L1", state: "確定", mode: "スタジオ", hours: 2, s: sl[2].s, s2: 0, getsu: 2, tan: 0, free: true, room: "サウンドスタジオM小岩店" },
                { id: "L2", state: "確定", mode: "スタジオ", hours: 1, s: sl[9].s, s2: 0, getsu: 1, tan: 0, free: true, room: "未手配" },
                { id: "L3", state: "確定", mode: "オンライン", hours: 1, s: sl[11].s, s2: 0, getsu: 0, tan: 1, free: true, room: "" }],
      slots: demoSlots(), lineLink: "https://line.me/R/oaMessage/%40557brylm/", cnt: { base: 4, start: m0, ls: [{ m: m0, state: "確定", getsu: demoOut ? 4 : 2 }] } };
  }

  /* ---------- 読み込み ---------- */
  function bad(t, m){ $("skLoad").hidden = true; $("skMain").hidden = true; $("skBad").hidden = false; if (t) $("skBadT").textContent = t; if (m) $("skBadM").textContent = m; }
  function load(){
    $("skLoad").hidden = false;
    const p = demo ? new Promise(r => setTimeout(() => r(demoMe()), 300))
      : fetch(cfg.api + "?a=me&k=" + encodeURIComponent(key), { cache: "no-store" }).then(r => r.json());
    return p.then(r => {
      if (!r.ok) { bad(r.bad ? "このページのURLが正しくありません" : "いまは予約できません", r.msg); return; }
      if (r.cnt) { const c = r.cnt, st = count(c.base, c.start, c.ls, r.months.map(x => x.m));
        // 来月に回した分は、今月の残りから引く（実際に月謝で予約できる数）
        r.months = r.months.map(x => Object.assign({}, x, st[x.m], { left: canGetsu(c.base, c.start, c.ls, x.m, st[x.m].left) })); }
      me = r; $("skLoad").hidden = true; $("skMain").hidden = false; drawMe(); drawList(); drawHours();
      if (first) { first = false; history.replaceState({ sk: 0 }, ""); if (qs.get("go") === "yoyaku") go(1); else go(0, true); } else go(step === 4 && !pick.length ? 3 : step, true);
    }).catch(() => bad("読み込めませんでした", "時間をおいてもう一度開いてください。うまくいかないときは、北川にご連絡ください。"));
  }
  if (!demo && (!cfg.api || !key)) { bad(); return; }
  load();

  /* ---------- 上のカード（お名前・残りの回数） ---------- */
  function drawMe(){
    $("skName").textContent = me.name + " 様";
    $("skPlan").textContent = me.plan;
    $("skMonths").innerHTML = me.months.slice(0, 2).map((x, i) => me.base
      ? `<div class="sk-m${x.left ? "" : " zero"}"><small>${i ? "来月" : "今月"}（${monName(x.m)}）</small><b>あと<em>${x.left}</em>回</b><i>${x.carry ? `${x.base}回＋${i ? "今月から" : "先月から"}${x.carry}回` : `${x.base}回のうち`}</i></div>`
      : `<div class="sk-m"><small>${i ? "来月" : "今月"}（${monName(x.m)}）</small><b>単発で予約</b><i>1回 ${yen(me.single)}</i></div>`).join("");
    $("skOut").hidden = !(me.base && me.months[0].left === 0);
    /* LINE がまだの人に「LINE でお知らせを受け取る」（押すと LINE が開き、文を送るだけで自動でつながる） */
    let ln = $("skLine");
    if (!ln) { ln = document.createElement("div"); ln.id = "skLine"; ln.className = "sk-line"; $("skOut").before(ln); }
    ln.hidden = !me.lineLink;
    if (me.lineLink) ln.innerHTML = `<div><b>お知らせを LINE で受け取る</b><small>ボタンを押すと LINE が開きます。入っている文を、そのまま送ってください。自動でつながります。</small></div>`
      + `<a class="sk-lnb" href="${esc(me.lineLink)}" target="_blank" rel="noopener"><span>LINE</span>LINE を開く</a>`;
  }
  $("skMore").addEventListener("click", () => { $("skOk").checked = true; go(1); });
  $("skGo").addEventListener("click", () => go(1));

  /* ---------- 予約中のレッスン ---------- */
  function drawList(){
    const ls = me.lessons || [];
    $("skListW").hidden = !ls.length;
    $("skList").innerHTML = ls.map(x => {
      const w = t => `<span class="sk-w">${span(t, x.hours)}</span>`;
      const when = x.state === "仮" ? `<em>第1希望</em>${w(x.s)}${x.s2 ? `<em>第2希望</em>${w(x.s2)}` : ""}` : w(x.s);
      const parts = [x.getsu ? `月謝 ${x.getsu}回分` : "", x.tan ? `追加（単発）${x.tan}回` : ""].filter(Boolean).join("＋");
      const room = !x.room ? "" : x.room === "取れず" ? "<i>お部屋が取れませんでした（LINE かメールのお知らせをご覧ください）</i>" : /^(未手配|手配中2?)$/.test(x.room) ? "お部屋は前の日に決まります" : esc(x.room);
      return `<li class="sk-l" data-id="${esc(x.id)}" data-free="${x.free ? 1 : 0}" data-state="${esc(x.state)}" data-getsu="${x.getsu || 0}" data-tan="${x.tan || 0}">
        <span class="chip ${x.state === "確定" ? "gr" : "or"}">${x.state === "確定" ? "確定" : "確定待ち"}</span>
        <span class="sk-lt"><b>${when}</b><small>${esc(x.mode)}・${x.hours}時間・${parts}${room ? `<br>${room}` : ""}</small></span>
        ${x.past ? "" : `<button type="button" class="yk-chg" data-cx>キャンセル</button>`}
        <div class="sk-cx" hidden></div></li>`;
    }).join("");
  }
  $("skList").addEventListener("click", e => {
    const li = e.target.closest(".sk-l"); if (!li) return;
    const box = li.querySelector(".sk-cx");
    if (e.target.closest("[data-cx]")) {
      const free = li.dataset.free === "1", g = +li.dataset.getsu, t = +li.dataset.tan;
      const freeMsg = !g ? "無料でキャンセルできます。追加（単発）の回なので、お支払いはありません。"
        : t ? `無料でキャンセルできます。月謝の${g}回分は、次の月まで使えます（追加（単発）の${t}回分は、お支払いはありません）。`
        : "無料でキャンセルできます。この回は、次の月まで使えます。";
      box.innerHTML = `<p>${li.dataset.state === "仮" ? "このお申し込みを取り消します（回数は減りません）。" : free ? freeMsg : "<b>3日前を過ぎているので、レッスン1回分として扱います。</b>"}</p>
        <div class="sk-cxb"><button type="button" class="btn or sm" data-yes>キャンセルする</button><button type="button" class="btn line sm" data-no>やめる</button></div><p class="err" hidden></p>`;
      box.hidden = false; return;
    }
    if (e.target.closest("[data-no]")) { box.hidden = true; return; }
    const yes = e.target.closest("[data-yes]");
    if (!yes) return;
    yes.disabled = true; yes.textContent = "送っています…";
    const p = demo ? new Promise(r => setTimeout(() => r({ ok: true, msg: "キャンセルしました（見本なので、実際には送っていません）。" }), 500))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify({ a: "lcancel", k: key, id: li.dataset.id }) }).then(r => r.json());
    p.then(r => {
      if (!r.ok) throw r;
      box.innerHTML = `<p class="sk-done">${esc(r.msg)}</p>`;
      if (!demo) setTimeout(load, 1500);
    }).catch(r => { const er = box.querySelector(".err"); er.textContent = (r && r.msg) || "うまくいきませんでした。もう一度お試しください。"; er.hidden = false; yes.disabled = false; yes.textContent = "キャンセルする"; });
  });

  /* ---------- 画面の切りかえ（1つ選んだら次の画面へ。スマホの「戻る」でも1つ前に戻る） ---------- */
  function go(n, quiet){
    step = n;
    $("skHome").hidden = n !== 0; $("skNotes").hidden = n !== 0; form.hidden = n === 0; $("ykDone").hidden = true;
    form.querySelectorAll(".sk-step").forEach(x => { x.hidden = Number(x.dataset.step) !== n; });
    form.querySelectorAll(".sk-dots li").forEach(li => { const d = Number(li.dataset.d); li.className = d === n ? "on" : d < n ? "pa" : ""; });
    if (n === 2) drawHours();
    if (n === 3) { cur = 0; drawDays(); }
    if (n === 4) { drawConf(); drawSplit(); }
    drawLeft();
    if (!quiet) { if (!history.state || history.state.sk !== n) history.pushState({ sk: n }, ""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }
  addEventListener("popstate", e => { const n = e.state && e.state.sk != null ? e.state.sk : 0; if (me) go(n, true); window.scrollTo(0, 0); });
  $("skBack").addEventListener("click", () => { if (history.state && history.state.sk === step && step > 0) history.back(); else go(Math.max(0, step - 1)); });

  /* ---------- 残りの回数（選ぶたびに変わる） ---------- */
  function liveLeft(){
    if (!me.cnt || !me.base) return null;
    const { base, start } = me.cnt, sp = split(), ls = me.cnt.ls.concat(sp ? sp.items.map(x => ({ m: x.m, state: "確定", getsu: x.getsu })) : []);
    const ms = me.months.slice(0, 2).map(x => x.m), st = count(base, start, ls, ms.concat(nextM(ms[ms.length - 1])));
    return ms.map(m => ({ m, left: canGetsu(base, start, ls, m, st[m].left) }));
  }
  function drawLeft(){
    const box = $("skLeft"); if (!me || step === 0) { box.innerHTML = ""; return; }
    const L = liveLeft(), sp = split();
    box.innerHTML = (L ? L.map((x, i) => `<span class="${x.left ? "" : "zero"}">${i ? "来月" : "今月"}（${monName(x.m)}）<b>あと<em>${x.left}</em>回</b></span>`).join("")
      : `<span>追加（単発）<b>1回 ${yen(me.single)}</b></span>`)
      + (sp && sp.tan ? `<span class="tan">追加（単発）<b><em>${sp.tan}</em>回</b></span>` : "");
  }

  /* ---------- 時間の長さ ---------- */
  function drawHours(){
    const max = me.max || 4;
    $("skHours").innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(n => `<label class="opt"><input type="radio" name="hours" value="${n}" ${n === hours && step > 2 ? "checked" : ""}><span>${n}時間</span></label>`).join("");
  }
  $("skHours").addEventListener("change", e => { const h = Number(e.target.value); if (h !== hours) pick = []; hours = h; setTimeout(() => go(3), 160); });

  /* ---------- 受け方 ---------- */
  form.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
    if (r.value !== mode) pick = []; mode = r.value; hideErr(form.querySelector(".yk-mode .err"));
    setTimeout(() => go(2), 160);
  }));
  /* 1画面目に戻ったら、選んでいた受け方にもう一度押せるように（押すと次へ） */
  form.querySelectorAll(".yk-mode .kc").forEach(l => l.addEventListener("click", e => { const r = l.querySelector("input"); if (r.checked && step === 1 && e.target === r) setTimeout(() => go(2), 160); }));
  form.querySelectorAll(".sk-hours").forEach(f => f.addEventListener("click", e => { const r = e.target.closest("input"); if (r && r.checked && Number(r.value) === hours && step === 2) setTimeout(() => go(3), 160); }));

  /* 選んだ時間だけ続けて空いている「始まり」の時間 */
  function avail(){
    const ok = new Set((me.slots || []).filter(s => mode === "online" || s.st).map(s => s.s));
    return (me.slots || []).filter(s => { for (let i = 0; i < hours; i++) if (!ok.has(s.s + i * H)) return false; return true; });
  }
  const maxDays = () => (me && me.days) || 12;
  const clash = t => pick.some(p => p !== t && Math.abs(p - t) < hours * H);   // 決めた時間と重なる

  /* ---------- いま何回目を選んでいるか（大きく） ---------- */
  function nthFor(t){   // t の日に、次の1回を足したら何回目になるか
    if (!me.cnt || !me.base) return { tan: hours, n: pick.length + 1 };
    const { base, start } = me.cnt, sp = split(), m = monKey(t);
    const ls = me.cnt.ls.concat(sp ? sp.items.map(x => ({ m: x.m, state: "確定", getsu: x.getsu })) : []);
    const g = canGetsu(base, start, ls, m, hours), c = count(base, start, ls, [m])[m];
    return { m, getsu: g, tan: hours - g, a: c.used + 1, b: c.used + g, of: c.base + c.carry };
  }
  function drawCount(){
    const el = $("skCount"), t = cur || (day ? new Date(day + "T12:00:00+09:00").getTime() : 0);
    if (!t) { el.innerHTML = ""; return; }
    const x = nthFor(t), done = pick.length ? `<small class="sk-did">決めた日：${pick.length}日</small>` : "";
    if (x.n) { el.innerHTML = `<small>いま選んでいるのは</small><div class="sk-big"><em>${x.n}</em><span>回目</span></div><small>追加（単発）1回 ${yen(me.single)}</small>${done}`; return; }
    const num = x.a === x.b ? `${x.a}` : `${x.a}<i>〜</i>${x.b}`;
    el.innerHTML = `<small>いま選んでいるのは</small>`
      + (x.getsu ? `<div class="sk-big"><span class="m">${monName(x.m)}の</span><em>${num}</em><span>回目</span></div><small>${x.of}回のうち${x.tan ? `　＋ 追加（単発）${x.tan}回` : ""}</small>`
                 : `<div class="sk-big tan"><span class="m">${monName(x.m)}の</span><em>追加</em><span>（単発）</span></div><small>${monName(x.m)}の回数を使い切っています。1回 ${yen(me.single)}</small>`) + done;
  }

  function drawDays(){
    const list = avail(), by = {};
    list.forEach(s => { (by[dayKey(s.s)] = by[dayKey(s.s)] || []).push(s); });
    const keys = Object.keys(by).filter(k => by[k].length).sort();
    if (!keys.includes(day)) day = keys[0] || "";
    days.innerHTML = keys.map(k => { const t = by[k][0].s, n = pick.filter(p => dayKey(p) === k).length;
      return `<button type="button" role="tab" class="yk-day ${k === day ? "on" : ""} w${J(t).getUTCDay()}" data-day="${k}" aria-selected="${k === day}"><small>${wd(t)}</small><b>${md(t)}</b><i>${n ? "✓ 決定" : by[k].length + "枠"}</i></button>`; }).join("");
    if (!keys.length) times.innerHTML = `<p class="small yk-none">いま${hours > 1 ? hours + "時間続けて" : ""}予約できる日時がありません。${hours > 1 ? "時間を短くするか、" : ""}${mode === "studio" ? "オンラインを選ぶか、" : ""}北川にご相談ください。</p>`;
    else drawTimes(by[day] || []);
    drawPicked(); drawCount(); drawBar(); drawLeft();
    const on = days.querySelector(".on"); if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function drawTimes(list){
    const sp = split(), at = t => sp && sp.items.find(x => x.t === t);
    times.innerHTML = list.length ? `<p class="yk-dh">${full(list[0].s).replace(/\d+:\d+$/, "")}</p><div class="opts">` + list.map(s => { const done = pick.includes(s.s), off = !done && clash(s.s), x = done && at(s.s);
      return `<label class="opt${s.s === cur ? " t1" : ""}${done ? " dn" : ""}${off ? " dis" : ""}"><input type="radio" name="t" value="${s.s}" ${s.s === cur ? "checked" : ""} ${off || done ? "disabled" : ""}><span>${hm(s.s)}${hours > 1 ? `<small class="sk-to">〜${hm(s.s + hours * H)}</small>` : ""}${done ? `<em class="yk-tag">${x && x.getsu ? (x.getsu > 1 ? (x.nth + 1) + "〜" + (x.nth + x.getsu) : x.nth + 1) + "回目" : "追加"}</em>` : ""}</span></label>`; }).join("") + "</div>" : "";
  }
  function drawBar(){
    const d = $("skDec"), nx = $("skNext");
    if (cur) { const x = nthFor(cur); d.disabled = false; d.innerHTML = `<span>${md(cur)}（${wd(cur)}）${hm(cur)}〜 を</span><b>${x.n ? x.n + "回目" : x.getsu ? (x.a === x.b ? x.a : x.a + "〜" + x.b) + "回目" : "追加（単発）"}に決定</b>`; }
    else { d.disabled = true; d.textContent = pick.length ? "ほかの日も選べます" : "時間を選んでください"; }
    nx.hidden = !pick.length;
    nx.textContent = `決めた ${pick.length}日で次へ →`;
  }
  days.addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (!b) return; day = b.dataset.day; cur = 0; drawDays(); });
  times.addEventListener("change", e => { cur = Number(e.target.value); hideErr($("ykWhenErr")); drawTimes(avail().filter(s => dayKey(s.s) === day)); drawCount(); drawBar(); });
  /* 決定：その1回を決めて、次の回へ */
  $("skDec").addEventListener("click", () => {
    if (!cur) return;
    if (pick.length >= maxDays()) { showErr($("ykWhenErr"), `1回の申し込みで選べるのは ${maxDays()}日までです。いったん申し込んでから、続けて予約してください。`); return; }
    const t = cur, x = nthFor(t); pick = pick.concat(t).sort((a, b) => a - b); cur = 0;
    drawDays();
    form.querySelectorAll(".sk-flash").forEach(x => x.remove());
    const fl = document.createElement("p"); fl.className = "sk-flash";
    fl.textContent = `✓ ${md(t)}（${wd(t)}）${hm(t)}〜 を${x.n ? x.n + "回目" : x.getsu ? (x.a === x.b ? x.a : x.a + "〜" + x.b) + "回目" : "追加（単発）"}に決めました`;
    $("skCount").before(fl); setTimeout(() => fl.remove(), 2600);
    $("skCount").classList.remove("pop"); void $("skCount").offsetWidth; $("skCount").classList.add("pop");
  });
  $("skNext").addEventListener("click", () => go(4));
  $("skAdd").addEventListener("click", () => go(3));
  function drawPicked(){
    const sp = split(), at = t => sp && sp.items.find(x => x.t === t);
    $("skPickedL").hidden = !pick.length;
    picked.innerHTML = pick.map(t => { const x = at(t), lab = !x || x.nth == null ? monName(monKey(t)) : nthText(x);
      const tag = !x ? `<span class="chip gr">${monName(monKey(t))}</span>` : x.getsu ? `<span class="chip gr">月謝</span>` : `<span class="chip or">追加</span>`;
      return `<li>${tag}<b>${span(t, hours)}<small class="sk-nth">${lab}</small></b><button type="button" class="yk-x" data-rm="${t}" aria-label="取り消す">×</button></li>`; }).join("");
  }
  function drawConf(){
    const sp = split(), at = t => sp && sp.items.find(x => x.t === t);
    $("skConf").innerHTML = pick.map(t => { const x = at(t);
      return `<li><span class="chip ${x && !x.getsu ? "or" : "gr"}">${x && !x.getsu ? "追加" : "月謝"}</span><b>${span(t, hours)}<small class="sk-nth">${mode === "studio" ? "小岩のスタジオ" : "オンライン"}${x && x.nth != null ? "・" + nthText(x) : ""}</small></b><button type="button" class="yk-x" data-rm="${t}" aria-label="取り消す">×</button></li>`; }).join("");
  }
  [picked, $("skConf")].forEach(el => el.addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]"); if (!rm) return;
    pick = pick.filter(x => x !== Number(rm.dataset.rm));
    hideErr($("ykWhenErr"));
    if (step === 4) { if (!pick.length) go(3); else { drawConf(); drawSplit(); drawLeft(); } } else drawDays();
  }));

  /* ---------- 月謝と追加（単発）の分け方 ---------- */
  /* 早い日から順に、その月の回数（月謝）を使う。足りない分は追加（単発）。正しい数はサーバーが数え直す */
  /* 「12月の5回目」「12月の5・6回目」「追加（単発）」 */
  function nthText(x){
    const m = monName(x.m), a = x.nth + 1, b = x.nth + x.getsu;
    const g = x.getsu ? `${m}の${a === b ? a : a + "〜" + b}回目（${x.of}回のうち）` : "";
    const t = x.tan ? `追加（単発）${x.tan}回・${yen(me.single * x.tan)}` : "";
    return [g, t].filter(Boolean).join("＋");
  }
  function split(){
    if (!pick.length || !me) return null;
    if (me.cnt) {   // サーバーと同じ順番（早い日から）で数える
      const { base, start } = me.cnt; let ls = me.cnt.ls.slice();
      const items = pick.map(t => {
        const m = monKey(t), g = canGetsu(base, start, ls, m, hours), c = count(base, start, ls, [m])[m] || { used: 0, base: 0, carry: 0 };
        ls = ls.concat([{ m, state: "確定", getsu: g }]);
        return { t, m, getsu: g, tan: hours - g, nth: c.used, of: c.base + c.carry };
      });
      const sum = k => items.reduce((a, x) => a + x[k], 0);
      return { items, getsu: sum("getsu"), tan: sum("tan") };
    }
    const left = {}, items = pick.map(t => {
      const m = monKey(t), q = (me.quota || {})[m] || [0];
      if (!(m in left)) { const total = pick.filter(p => monKey(p) === m).length * hours; left[m] = q[Math.min(total, q.length - 1)] || 0; }
      const g = Math.min(hours, left[m]); left[m] -= g;
      return { t, m, getsu: g, tan: hours - g };
    });
    const sum = k => items.reduce((a, x) => a + x[k], 0);
    return { items, getsu: sum("getsu"), tan: sum("tan") };
  }
  function drawSplit(){
    const s = split(), box = $("skSplit");
    if (!s) { box.hidden = true; $("skOkW").hidden = true; return; }
    box.hidden = false;
    const months = [...new Set(s.items.map(x => x.m))];
    const per = months.length > 1 ? `<p>${months.map(m => { const xs = s.items.filter(x => x.m === m), g = xs.reduce((a, x) => a + x.getsu, 0), t = xs.reduce((a, x) => a + x.tan, 0);
      return `${monName(m)}：${[g ? `月謝 ${g}回分` : "", t ? `追加 ${t}回` : ""].filter(Boolean).join("＋")}`; }).join("　")}</p>` : "";
    box.innerHTML = `<small>この予約（${s.items.length}日・${hours}時間ずつ）</small><div class="sk-sp">`
      + (s.getsu ? `<span class="chip gr">月謝</span><b>${s.getsu}回分</b>` : "")
      + (s.getsu && s.tan ? `<i>＋</i>` : "")
      + (s.tan ? `<span class="chip or">追加（単発）</span><b>${s.tan}回・${yen(me.single * s.tan)}</b>` : "") + `</div>` + per
      + (s.tan ? `<p>${me.base ? "月の回数を使い切るので、" : ""}${s.tan}回は追加の単発レッスン（1回 ${yen(me.single)}・税込）になります。お支払いは、現金かカード（Square）です。</p>` : "");
    $("skOkW").hidden = !s.tan;
    if (!s.tan) hideErr($("skOkErr"));
  }

  function showErr(el, msg){ el.textContent = msg; el.hidden = false; }
  function hideErr(el){ if (el) el.hidden = true; }

  /* ---------- 送る ---------- */
  form.addEventListener("submit", e => {
    e.preventDefault();
    let bad = null;
    const need = (ok, el, msg, focus) => { if (!ok) { showErr(el, msg); bad = bad || focus; } else hideErr(el); };
    const s = split();
    if (!mode) { go(1); return; }
    if (!pick.length) { go(3); return; }
    need(!s || !s.tan || $("skOk").checked, $("skOkErr"), "追加（単発）になる分があります。よろしければ、チェックを入れてください。", $("skOkW"));
    if (bad) { bad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const data = { a: "lesson", k: key, mode, hours, slots: pick, msg: $("y_q").value, okSingle: $("skOk").checked };
    const btn = $("ykSend"), err = $("ykErr");
    btn.disabled = true; btn.textContent = "送っています…"; hideErr(err);
    const send = demo ? new Promise(r => setTimeout(() => r({ ok: true, mode, getsu: s.getsu, tan: s.tan, items: s.items.map(x => ({ s: x.t, getsu: x.getsu, tan: x.tan })) }), 600))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify(data) }).then(r => r.json());
    send.then(r => {
      if (!r.ok) {
        showErr(err, r.msg || "送信できませんでした。");
        if (r.needOk) { $("skOkW").hidden = false; }
        if (r.gone) { pick = []; load(); }
        return;
      }
      finish(r);
    }).catch(() => showErr(err, "送信できませんでした。通信の状態を確かめて、もう一度お試しください。"))
      .finally(() => { btn.disabled = false; btn.textContent = "この内容で申し込む"; });
  });

  function finish(r){
    const el = $("ykDone");
    const items = r.items || pick.map(t => ({ s: t, getsu: 0, tan: 0 }));
    const list = items.map(x => `<li><span class="chip gr">確定</span><b>${span(x.s, hours)}</b></li>`).join("");
    const parts = [r.getsu ? `月謝 ${r.getsu}回分` : "", r.tan ? `追加（単発）${r.tan}回` : ""].filter(Boolean).join("＋");
    el.innerHTML = `<span class="chip gr">CONFIRMED</span><h3>予約が確定しました（${items.length}日）</h3>`
      + `<p>${mode === "studio" ? `確定の${r.line ? "お知らせを LINE に" : "メールを"}お送りしました。<b>スタジオのお部屋は、レッスンの前の日に北川が予約</b>して、場所を${r.line ? " LINE " : "メール"}でお知らせします。` : `当日の入り口（Google Meet のリンク）を、${r.line ? "LINE" : "メール"}でお送りしました。`}</p>`
      + `<ol class="yk-picked">${list}</ol><p class="small">${hours}時間ずつ（${parts}）${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p><button type="button" class="btn line" id="skAgain">予約のページに戻る</button>`;
    form.hidden = true; $("skHome").hidden = true; el.hidden = false; pick = []; history.replaceState({ sk: 0 }, "");
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
    $("skAgain").addEventListener("click", () => { pick = []; $("y_q").value = ""; $("skOk").checked = false; step = 0; demo ? go(0) : load(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  }
})();
