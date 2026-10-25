/* seito.js — 生徒さん専用の予約ページ（seito.html?k=合言葉）の動き
   生徒さんの情報・残りの回数・空き枠は Apps Script（Googleカレンダー）から読む。
   ?demo=1 を付けると、見本の生徒さんで動きだけ確かめられる（送信はしない）。&out=1 で「今月の回数を使い切った」見本。
   2026-10-25：何日分でも、まとめて選んで1回で予約できる（スタジオもオンラインも、その場で確定。部屋は前の日に北川くんが取る）。 */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = JSON.parse($("ykcfg").textContent);
  const qs = new URLSearchParams(location.search);
  const demo = qs.get("demo") === "1", demoOut = qs.get("out") === "1";
  const key = (qs.get("k") || "").trim();
  const H = 3600e3, TZ = "Asia/Tokyo", W = ["日","月","火","水","木","金","土"];
  const form = $("yk"), days = $("ykDays"), times = $("ykTimes"), picked = $("ykPicked"), hint = $("ykHint"), nowEl = $("ykNow");
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

  let me = null, mode = "", hours = 1, day = "", pick = [];

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
                { id: "L2", state: "確定", mode: "スタジオ", hours: 1, s: sl[9].s, s2: 0, getsu: 1, tan: 0, free: true, room: "未手配" }],
      slots: demoSlots() };
  }

  /* ---------- 読み込み ---------- */
  function bad(t, m){ $("skLoad").hidden = true; $("skMain").hidden = true; $("skBad").hidden = false; if (t) $("skBadT").textContent = t; if (m) $("skBadM").textContent = m; }
  function load(){
    $("skLoad").hidden = false;
    const p = demo ? new Promise(r => setTimeout(() => r(demoMe()), 300))
      : fetch(cfg.api + "?a=me&k=" + encodeURIComponent(key), { cache: "no-store" }).then(r => r.json());
    return p.then(r => {
      if (!r.ok) { bad(r.bad ? "このページのURLが正しくありません" : "いまは予約できません", r.msg); return; }
      me = r; $("skLoad").hidden = true; $("skMain").hidden = false; drawMe(); drawList(); drawHours(); if (mode) drawDays(); drawSplit();
    }).catch(() => bad("読み込めませんでした", "時間をおいてもう一度開いてください。うまくいかないときは、北川にご連絡ください。"));
  }
  if (!demo && (!cfg.api || !key)) { bad(); return; }
  load();

  /* ---------- 上のカード（お名前・残りの回数） ---------- */
  function drawMe(){
    $("skName").textContent = me.name + " 様";
    $("skPlan").textContent = me.plan;
    $("skMonths").innerHTML = me.months.slice(0, 2).map((x, i) => me.base
      ? `<div class="sk-m${x.left ? "" : " zero"}"><small>${i ? "来月" : "今月"}（${monName(x.m)}）</small><b>あと<em>${x.left}</em>回</b><i>${x.base}回${x.carry ? `＋振替${x.carry}回` : ""}のうち</i></div>`
      : `<div class="sk-m"><small>${i ? "来月" : "今月"}（${monName(x.m)}）</small><b>単発で予約</b><i>1回 ${yen(me.single)}</i></div>`).join("");
    $("skOut").hidden = !(me.base && me.months[0].left === 0);
  }
  $("skMore").addEventListener("click", () => { $("skOk").checked = true; form.scrollIntoView({ behavior: "smooth", block: "start" }); });

  /* ---------- 予約中のレッスン ---------- */
  function drawList(){
    const ls = me.lessons || [];
    $("skListW").hidden = !ls.length;
    $("skList").innerHTML = ls.map(x => {
      const w = t => `<span class="sk-w">${span(t, x.hours)}</span>`;
      const when = x.state === "仮" ? `<em>第1希望</em>${w(x.s)}${x.s2 ? `<em>第2希望</em>${w(x.s2)}` : ""}` : w(x.s);
      const parts = [x.getsu ? `月謝 ${x.getsu}回分` : "", x.tan ? `追加（単発）${x.tan}回` : ""].filter(Boolean).join("＋");
      const room = !x.room ? "" : x.room === "取れず" ? "<i>お部屋が取れませんでした（メールをご覧ください）</i>" : /^(未手配|手配中2?)$/.test(x.room) ? "お部屋は前の日に決まります" : esc(x.room);
      return `<li class="sk-l" data-id="${esc(x.id)}" data-free="${x.free ? 1 : 0}" data-state="${esc(x.state)}">
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
      const free = li.dataset.free === "1";
      box.innerHTML = `<p>${li.dataset.state === "仮" ? "このお申し込みを取り消します（回数は減りません）。" : free ? "無料でキャンセルできます。この回は、次の月まで使えます。" : "<b>3日前を過ぎているので、レッスン1回分として扱います。</b>"}</p>
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

  /* ---------- 時間の長さ ---------- */
  function drawHours(){
    const max = me.max || 4;
    $("skHours").innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(n => `<label class="opt"><input type="radio" name="hours" value="${n}" ${n === hours ? "checked" : ""}><span>${n}時間</span></label>`).join("");
  }
  $("skHours").addEventListener("change", e => { hours = Number(e.target.value); pick = []; if (mode) drawDays(); drawSplit(); });

  /* ---------- 受け方 ---------- */
  form.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
    mode = r.value; pick = []; hideErr(form.querySelector(".yk-mode .err"));
    hint.textContent = "受けたい日を、いくつでも選んでください";
    if (me) drawDays(); drawSplit();
  }));

  /* 選んだ時間だけ続けて空いている「始まり」の時間 */
  function avail(){
    const ok = new Set((me.slots || []).filter(s => mode === "online" || s.st).map(s => s.s));
    return (me.slots || []).filter(s => { for (let i = 0; i < hours; i++) if (!ok.has(s.s + i * H)) return false; return true; });
  }
  const maxDays = () => (me && me.days) || 12;
  const clash = t => pick.some(p => p !== t && Math.abs(p - t) < hours * H);   // 選んだ時間と重なる
  function drawDays(){
    const list = avail(), by = {};
    list.forEach(s => { (by[dayKey(s.s)] = by[dayKey(s.s)] || []).push(s); });
    pick.forEach(t => { const k = dayKey(t); if (!by[k]) by[k] = []; });
    const keys = Object.keys(by).filter(k => by[k].length).sort();
    if (!keys.includes(day)) day = keys[0] || "";
    days.innerHTML = keys.map(k => { const t = by[k][0].s, n = pick.filter(p => dayKey(p) === k).length;
      return `<button type="button" role="tab" class="yk-day ${k === day ? "on" : ""} w${J(t).getUTCDay()}" data-day="${k}" aria-selected="${k === day}"><small>${wd(t)}</small><b>${md(t)}</b><i>${n ? "✓ " + n + "つ" : by[k].length + "枠"}</i></button>`; }).join("");
    if (!keys.length) times.innerHTML = `<p class="small yk-none">いま${hours > 1 ? hours + "時間続けて" : ""}予約できる日時がありません。${hours > 1 ? "時間を短くするか、" : ""}${mode === "studio" ? "オンラインを選ぶか、" : ""}北川にご相談ください。</p>`;
    else drawTimes(by[day] || []);
    drawPicked();
  }
  function drawTimes(list){
    times.innerHTML = list.length ? `<p class="yk-dh">${full(list[0].s).replace(/\d+:\d+$/, "")}</p><div class="opts">` + list.map(s => { const on = pick.includes(s.s), off = !on && clash(s.s);
      return `<label class="opt${on ? " t1" : ""}${off ? " dis" : ""}"><input type="checkbox" value="${s.s}" ${on ? "checked" : ""} ${off ? "disabled" : ""}><span>${hm(s.s)}${hours > 1 ? `<small class="sk-to">〜${hm(s.s + hours * H)}</small>` : ""}${on ? `<em class="yk-tag">予約</em>` : ""}</span></label>`; }).join("") + "</div>" : "";
  }
  days.addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (!b) return; day = b.dataset.day; drawDays(); });
  /* 時間を押すと足す。もう一度押すと外れる。何日でも（最大 me.days 日） */
  times.addEventListener("change", e => {
    const t = Number(e.target.value);
    hideErr($("ykWhenErr"));
    if (pick.includes(t)) pick = pick.filter(x => x !== t);
    else if (pick.length >= maxDays()) { e.target.checked = false; showErr($("ykWhenErr"), `1回の申し込みで選べるのは ${maxDays()}日までです。いったん申し込んでから、続けて予約してください。`); return; }
    else pick = pick.concat(t).sort((a, b) => a - b);
    drawDays(); drawSplit();
  });
  function drawPicked(){
    picked.innerHTML = pick.map(t => `<li><span class="chip gr">${monName(monKey(t))}</span><b>${span(t, hours)}</b><button type="button" class="yk-x" data-rm="${t}" aria-label="取り消す">×</button></li>`).join("");
    nowEl.hidden = !pick.length;
    nowEl.innerHTML = pick.length ? `<span class="chip or">${pick.length}日</span>選んでいます。ほかの日も、続けて選べます` : "";
  }
  picked.addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]"); if (!rm) return;
    pick = pick.filter(x => x !== Number(rm.dataset.rm));
    hideErr($("ykWhenErr")); drawDays(); drawSplit();
  });

  /* ---------- 月謝と追加（単発）の分け方 ---------- */
  /* 早い日から順に、その月の回数（月謝）を使う。足りない分は追加（単発）。正しい数はサーバーが数え直す */
  function split(){
    if (!pick.length || !me) return null;
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
    need(!!mode, form.querySelector(".yk-mode .err"), "スタジオかオンラインを選んでください。", form.querySelector(".yk-mode"));
    need(!mode || pick.length > 0, $("ykWhenErr"), "日時を選んでください。", $("ykWhen"));
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
      + `<ol class="yk-picked">${list}</ol><p class="small">${hours}時間ずつ（${parts}）${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p><button type="button" class="btn line" id="skAgain">続けて予約する</button>`;
    form.hidden = true; el.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
    $("skAgain").addEventListener("click", () => { el.hidden = true; form.hidden = false; pick = []; $("y_q").value = ""; $("skOk").checked = false; demo ? (drawDays(), drawSplit()) : load(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  }
})();
