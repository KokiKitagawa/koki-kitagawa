/* seito.js — 生徒さん専用の予約ページ（seito.html?k=合言葉）の動き
   生徒さんの情報・残りの回数・空き枠は Apps Script（Googleカレンダー）から読む。
   ?demo=1 を付けると、見本の生徒さんで動きだけ確かめられる（送信はしない）。&out=1 で「今月の回数を使い切った」見本。 */
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

  let me = null, mode = "", hours = 1, day = "", pick = [], active = 0, skip2 = false;

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
    return { ok: true, name: "山田 花子", plan: "月4回", base: 4, single: cfg.single, max: 4,
      months: demoOut ? [{ m: m0, base: 4, carry: 0, used: 4, left: 0 }, { m: m1, base: 4, carry: 0, used: 0, left: 4 }]
                      : [{ m: m0, base: 4, carry: 1, used: 3, left: 2 }, { m: m1, base: 4, carry: 0, used: 0, left: 4 }],
      quota: demoOut ? { [m0]: [0,0,0,0,0], [m1]: [0,1,2,3,4] } : { [m0]: [0,1,2,2,2], [m1]: [0,1,2,3,4] },
      lessons: [{ id: "L1", state: "確定", mode: "スタジオ", hours: 2, s: sl[2].s, s2: 0, getsu: 2, tan: 0, free: true },
                { id: "L2", state: "仮", mode: "スタジオ", hours: 1, s: sl[9].s, s2: sl[14].s, getsu: 1, tan: 0, free: true }],
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
      return `<li class="sk-l" data-id="${esc(x.id)}" data-free="${x.free ? 1 : 0}" data-state="${esc(x.state)}">
        <span class="chip ${x.state === "確定" ? "gr" : "or"}">${x.state === "確定" ? "確定" : "確定待ち"}</span>
        <span class="sk-lt"><b>${when}</b><small>${esc(x.mode)}・${x.hours}時間・${parts}</small></span>
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
  $("skHours").addEventListener("change", e => { hours = Number(e.target.value); pick = []; active = 0; skip2 = false; if (mode) drawDays(); drawSplit(); });

  /* ---------- 受け方 ---------- */
  form.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
    mode = r.value; pick = []; active = 0; skip2 = false; hideErr(form.querySelector(".yk-mode .err"));
    hint.textContent = mode === "studio" ? "第1希望を選んでください。第2希望は選ばなくても大丈夫です" : "1つ選んでください。その場で予約が決まります";
    $("ykSend").textContent = mode === "studio" ? "この内容で申し込む" : "この日時で予約する";
    if (me) drawDays(); drawSplit();
  }));

  /* 選んだ時間だけ続けて空いている「始まり」の時間 */
  function avail(){
    const ok = new Set((me.slots || []).filter(s => mode === "online" || s.st).map(s => s.s));
    return (me.slots || []).filter(s => { for (let i = 0; i < hours; i++) if (!ok.has(s.s + i * H)) return false; return true; });
  }
  function drawDays(){
    const list = avail(), by = {};
    list.forEach(s => { (by[dayKey(s.s)] = by[dayKey(s.s)] || []).push(s); });
    const keys = Object.keys(by).sort();
    if (!keys.includes(day)) day = keys[0] || "";
    days.innerHTML = keys.map(k => { const t = by[k][0].s, mine = by[k].filter(s => pick.includes(s.s));
      return `<button type="button" role="tab" class="yk-day ${k === day ? "on" : ""} w${J(t).getUTCDay()}" data-day="${k}" aria-selected="${k === day}"><small>${wd(t)}</small><b>${md(t)}</b><i>${mine.length ? "✓ " + (mode === "studio" ? mine.map(s => "第" + (pick.indexOf(s.s) + 1)).sort().join("・") : "選択中") : by[k].length + "枠"}</i></button>`; }).join("");
    if (!keys.length) times.innerHTML = `<p class="small yk-none">いま${hours > 1 ? hours + "時間続けて" : ""}予約できる日時がありません。${hours > 1 ? "時間を短くするか、" : ""}${mode === "studio" ? "オンラインを選ぶか、" : ""}北川にご相談ください。</p>`;
    else drawTimes(by[day] || []);
    drawPicked();
  }
  function drawTimes(list){
    times.innerHTML = list.length ? `<p class="yk-dh">${full(list[0].s).replace(/\d+:\d+$/, "")}</p><div class="opts">` + list.map(s => { const i = pick.indexOf(s.s), tag = i < 0 ? "" : mode === "studio" ? `<em class="yk-tag t${i + 1}">第${i + 1}希望</em>` : `<em class="yk-tag">予約</em>`;
      return `<label class="opt${i >= 0 ? " t" + (i + 1) : ""}"><input type="checkbox" value="${s.s}" ${i >= 0 ? "checked" : ""}><span>${hm(s.s)}${hours > 1 ? `<small class="sk-to">〜${hm(s.s + hours * H)}</small>` : ""}${tag}</span></label>`; }).join("") + "</div>" : "";
  }
  days.addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (!b) return; day = b.dataset.day; drawDays(); });
  const next = () => { active = !pick[0] ? 0 : (!pick[1] && !skip2) ? 1 : -1; };
  times.addEventListener("change", e => {
    const t = Number(e.target.value);
    hideErr($("ykWhenErr"));
    if (mode === "online") pick = e.target.checked ? [t] : [];
    else if (pick.includes(t)) { pick = pick.filter(x => x !== t); next(); }
    else if (active < 0) { e.target.checked = false; showErr($("ykWhenErr"), "第1・第2希望とも選んであります。変えるときは、下の「変える」を押してください。"); return; }
    else { pick[active] = t; pick = pick.filter(Boolean); if (active === 1) skip2 = false; next(); }
    drawDays(); drawSplit();
  });
  function row(i, t){
    const lab = "第" + (i + 1) + "希望";
    return `<li class="yk-slot${active === i ? " now" : ""}"><span class="chip or">${lab}</span><b>${span(t, hours)}</b><span class="yk-acts"><button type="button" class="yk-chg" data-chg="${i}">変える</button><button type="button" class="yk-x" data-rm="${t}" aria-label="${lab}を取り消す">×</button></span></li>`;
  }
  function drawPicked(){
    if (mode !== "studio") {
      picked.innerHTML = pick.map(t => `<li><span class="chip gr">予約する日時</span><b>${span(t, hours)}</b><button type="button" class="yk-x" data-rm="${t}" aria-label="取り消す">×</button></li>`).join("");
      nowEl.hidden = true; return;
    }
    let h = "";
    if (pick[0]) h += row(0, pick[0]);
    if (pick[1]) h += row(1, pick[1]);
    else if (pick[0]) h += skip2
      ? `<li class="yk-slot yk-opt off"><span class="chip">第2希望</span><span class="yk-o"><b>なし</b><small>第1希望だけで申し込みます</small></span><span class="yk-acts"><button type="button" class="yk-chg" data-pick2>やっぱり選ぶ</button></span></li>`
      : `<li class="yk-slot yk-opt${active === 1 ? " now" : ""}"><span class="chip">第2希望</span><span class="yk-o"><b>第2希望も選ぶ（任意）</b><small>上の日時から、もう1つ選べます。2つあると日程が決まりやすくなります</small></span><span class="yk-acts"><button type="button" class="yk-chg" data-skip2>第2希望なしで進む</button></span></li>`;
    picked.innerHTML = h;
    nowEl.hidden = false;
    nowEl.innerHTML = active === 0 ? `<span class="chip or">第1希望</span>を選んでいます`
      : active === 1 ? `<span class="chip">第2希望（任意）</span>を選んでいます`
      : `選び終わりました。変えるときは、下の「変える」を押してください`;
  }
  picked.addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]"), chg = e.target.closest("[data-chg]");
    if (rm) { pick = pick.filter(x => x !== Number(rm.dataset.rm)); if (mode === "studio") next(); }
    else if (chg) { active = Number(chg.dataset.chg); times.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (e.target.closest("[data-skip2]")) { skip2 = true; next(); }
    else if (e.target.closest("[data-pick2]")) { skip2 = false; next(); times.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else return;
    hideErr($("ykWhenErr")); drawDays(); drawSplit();
  });

  /* ---------- 月謝と追加（単発）の分け方 ---------- */
  function split(){
    if (!pick[0] || !me) return null;
    const q = (me.quota || {})[monKey(pick[0])];
    const getsu = q ? Math.min(hours, q[Math.min(hours, q.length - 1)] || 0) : 0;
    return { getsu, tan: hours - getsu };
  }
  function drawSplit(){
    const s = split(), box = $("skSplit");
    if (!s) { box.hidden = true; $("skOkW").hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<small>この予約（${monName(monKey(pick[0]))}・${hours}時間）</small><div class="sk-sp">`
      + (s.getsu ? `<span class="chip gr">月謝</span><b>${s.getsu}回分</b>` : "")
      + (s.getsu && s.tan ? `<i>＋</i>` : "")
      + (s.tan ? `<span class="chip or">追加（単発）</span><b>${s.tan}回・${yen(me.single * s.tan)}</b>` : "") + `</div>`
      + (s.tan ? `<p>${me.base ? `${monName(monKey(pick[0]))}の回数を使い切るので、` : ""}${s.tan}回は追加の単発レッスン（1回 ${yen(me.single)}・税込）になります。お支払いは、現金かカード（Square）です。</p>` : "")
      + (mode === "studio" && pick[1] && monKey(pick[1]) !== monKey(pick[0]) ? `<p>第2希望で決まったときは、${monName(monKey(pick[1]))}の回数で数えます。</p>` : "");
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
    const send = demo ? new Promise(r => setTimeout(() => r({ ok: true, mode, getsu: s.getsu, tan: s.tan }), 600))
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
      .finally(() => { btn.disabled = false; btn.textContent = mode === "studio" ? "この内容で申し込む" : "この日時で予約する"; });
  });

  function finish(r){
    const el = $("ykDone");
    const list = pick.map((t, i) => `<li>${mode === "studio" ? `<span class="chip or">第${i + 1}希望</span>` : ""}<b>${span(t, hours)}</b></li>`).join("");
    const parts = [r.getsu ? `月謝 ${r.getsu}回分` : "", r.tan ? `追加（単発）${r.tan}回` : ""].filter(Boolean).join("＋");
    el.innerHTML = (mode === "studio"
      ? `<span class="chip or">RECEIVED</span><h3>ご予約を受け付けました</h3><p>スタジオのお部屋の空きを確かめて、<b>24時間以内に「日程確定」のメール</b>をお送りします。</p>`
      : `<span class="chip gr">CONFIRMED</span><h3>予約が確定しました</h3><p>当日の入り口（Google Meet のリンク）を、メールでお送りしました。</p>`)
      + `<ol class="yk-picked">${list}</ol><p class="small">${hours}時間（${parts}）${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p><button type="button" class="btn line" id="skAgain">続けて予約する</button>`;
    form.hidden = true; el.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
    $("skAgain").addEventListener("click", () => { el.hidden = true; form.hidden = false; pick = []; active = 0; skip2 = false; $("y_q").value = ""; $("skOk").checked = false; demo ? drawDays() : load(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  }
})();
