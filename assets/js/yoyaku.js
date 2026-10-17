/* yoyaku.js — 体験レッスンの予約ページの動き
   空き枠は Apps Script（Googleカレンダー）から読む。?demo=1 を付けると、見本の空き枠で動きだけ確かめられる（送信はしない）。 */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = JSON.parse($("ykcfg").textContent);
  const demo = /[?&]demo=1/.test(location.search);
  const form = $("yk"), days = $("ykDays"), times = $("ykTimes"), picked = $("ykPicked"), hint = $("ykHint"), load = $("ykLoad");
  const steps = document.querySelectorAll(".yk-steps li");
  const TZ = "Asia/Tokyo", W = ["日","月","火","水","木","金","土"];
  const part = (t, o) => new Intl.DateTimeFormat("ja-JP", Object.assign({ timeZone: TZ }, o)).format(new Date(t));
  const dayKey = t => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const wd = t => W[new Date(t + 9 * 3600e3).getUTCDay()];
  const md = t => { const d = new Date(t + 9 * 3600e3); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); };
  const hm = t => part(t, { hour: "numeric", minute: "2-digit" });
  const full = t => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${wd(t)}）${hm(t)}〜`; };

  let slots = null, mode = "", day = "", pick = [];
  /* スタジオ：いまどちらを選んでいるか（0＝第1希望、1＝第2希望、-1＝選び終わり）。skip2＝第2希望なしで進む */
  let active = 0, skip2 = false;
  const nowEl = $("ykNow");

  /* トップの「体験から始める」で来たとき：気になるプランを出して、申し込みの内容にも入れる */
  const plan = (new URLSearchParams(location.search).get("plan") || "").trim();
  const myPlan = (cfg.plans || []).includes(plan) ? plan : "";
  if (myPlan) { const el = $("ykPlan"); el.innerHTML = `<span class="chip or">気になるプラン</span><b>${myPlan}</b>（体験のあとで、くわしくご案内します）`; el.hidden = false; }

  if (!cfg.api && !demo) { $("ykClosed").hidden = false; form.hidden = true; return; }

  /* 空き枠を読む */
  function demoSlots(){
    const out = [], now = Date.now(), start = new Date(dayKey(now) + "T00:00:00+09:00").getTime();
    for (let i = 1; i <= 30; i++) {
      const d0 = start + i * 864e5, w = new Date(d0 + 9 * 3600e3).getUTCDay();
      const hours = w === 3 || w === 4 || w === 5 ? [16,17,18,19,20,21] : w === 0 || w === 6 ? [12,13,14,15,16,17] : [];
      hours.forEach((h, j) => { if ((i * 7 + j * 3) % 5 === 0) return; const s = d0 + h * 3600e3; out.push({ s, st: s - now > 48 * 3600e3 ? 1 : 0 }); });
    }
    return out;
  }
  function fetchSlots(){
    load.hidden = false;
    const p = demo ? new Promise(r => setTimeout(() => r({ ok: true, slots: demoSlots() }), 400)) : fetch(cfg.api + "?a=slots", { cache: "no-store" }).then(r => r.json());
    return p.then(r => { if (!r.ok) throw 0; slots = r.slots; load.hidden = true; }).catch(() => {
      load.hidden = true; slots = [];
      showErr($("ykWhenErr"), "空いている日時を読み込めませんでした。時間をおいてもう一度開くか、お問い合わせフォームからご連絡ください。");
    });
  }
  const loading = fetchSlots();

  /* 受け方 */
  form.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
    mode = r.value; pick = []; active = 0; skip2 = false; hideErr(form.querySelector(".yk-mode .err"));
    hint.textContent = mode === "studio" ? "第1希望を選んでください。第2希望は選ばなくても大丈夫です" : "1つ選んでください。その場で予約が決まります";
    $("ykSend").textContent = mode === "studio" ? "この内容で申し込む" : "この日時で予約する";
    loading.then(drawDays); mark();
  }));

  const avail = () => (slots || []).filter(s => mode === "online" || s.st);
  function drawDays(){
    const list = avail(), by = {};
    list.forEach(s => { (by[dayKey(s.s)] = by[dayKey(s.s)] || []).push(s); });
    const keys = Object.keys(by).sort();
    if (!keys.includes(day)) day = keys[0] || "";
    days.innerHTML = keys.map(k => { const t = by[k][0].s, n = by[k].filter(s => pick.includes(s.s)).length;
      return `<button type="button" role="tab" class="yk-day ${k === day ? "on" : ""} w${new Date(t + 9 * 3600e3).getUTCDay()}" data-day="${k}" aria-selected="${k === day}"><small>${wd(t)}</small><b>${md(t)}</b><i>${n ? "✓ " + (mode === "studio" ? by[k].filter(s => pick.includes(s.s)).map(s => pick.indexOf(s.s) + 1).sort().map(n => "第" + n).join("・") : "選択中") : by[k].length + "枠"}</i></button>`; }).join("");
    if (slots && !keys.length) times.innerHTML = `<p class="small yk-none">いま予約できる日時がありません。${mode === "studio" ? "オンラインを選ぶか、" : ""}<a href="./#contact">お問い合わせフォーム</a>からご相談ください。</p>`;
    else drawTimes(by[day] || []);
    drawPicked();
  }
  function drawTimes(list){
    times.innerHTML = list.length ? `<p class="yk-dh">${full(list[0].s).replace(/\d+:\d+〜$/, "")}</p><div class="opts">` + list.map(s => { const i = pick.indexOf(s.s), tag = i < 0 ? "" : mode === "studio" ? `<em class="yk-tag t${i + 1}">第${i + 1}希望</em>` : `<em class="yk-tag">予約</em>`;
      return `<label class="opt${i >= 0 ? " t" + (i + 1) : ""}"><input type="checkbox" value="${s.s}" ${i >= 0 ? "checked" : ""}><span>${hm(s.s)}${tag}</span></label>`; }).join("") + "</div>" : "";
  }
  days.addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (!b) return; day = b.dataset.day; drawDays(); });
  /* 時間を押したとき。スタジオは「いま選んでいる方（第1／第2希望）」に入る。選んである時間をもう一度押すと外れる */
  const next = () => { active = !pick[0] ? 0 : (!pick[1] && !skip2) ? 1 : -1; };
  times.addEventListener("change", e => {
    const t = Number(e.target.value);
    hideErr($("ykWhenErr"));
    if (mode === "online") pick = e.target.checked ? [t] : [];
    else if (pick.includes(t)) { pick = pick.filter(x => x !== t); next(); }
    else if (active < 0) { e.target.checked = false; showErr($("ykWhenErr"), "第1・第2希望とも選んであります。変えるときは、下の「変える」を押してください。"); return; }
    else { pick[active] = t; pick = pick.filter(Boolean); if (active === 1) skip2 = false; next(); }
    drawDays(); mark();
  });
  function row(i, t){
    const lab = "第" + (i + 1) + "希望";
    return `<li class="yk-slot${active === i ? " now" : ""}"><span class="chip or">${lab}</span><b>${full(t)}</b><span class="yk-acts"><button type="button" class="yk-chg" data-chg="${i}">変える</button><button type="button" class="yk-x" data-rm="${t}" aria-label="${lab}を取り消す">×</button></span></li>`;
  }
  function drawPicked(){
    if (mode !== "studio") {
      picked.innerHTML = pick.map(t => `<li><span class="chip gr">予約する日時</span><b>${full(t)}</b><button type="button" class="yk-x" data-rm="${t}" aria-label="取り消す">×</button></li>`).join("");
      nowEl.hidden = true; return;
    }
    let h = "";
    if (pick[0]) h += row(0, pick[0]);
    else if (active === 0 && pick.length === 0) h += "";
    if (pick[1]) h += row(1, pick[1]);
    else if (pick[0]) h += skip2
      ? `<li class="yk-slot yk-opt off"><span class="chip">第2希望</span><span class="yk-o"><b>なし</b><small>第1希望だけで申し込みます</small></span><span class="yk-acts"><button type="button" class="yk-chg" data-pick2>やっぱり選ぶ</button></span></li>`
      : `<li class="yk-slot yk-opt${active === 1 ? " now" : ""}"><span class="chip">第2希望</span><span class="yk-o"><b>第2希望も選ぶ（任意）</b><small>上の日時から、もう1つ選べます。2つあると日程が決まりやすくなります。選ばなくても申し込めます</small></span><span class="yk-acts"><button type="button" class="yk-chg" data-skip2>第2希望なしで進む</button></span></li>`;
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
    else if (e.target.closest("[data-skip2]")) { skip2 = true; next(); drawDays(); mark(); document.querySelector(".yk-info").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    else if (e.target.closest("[data-pick2]")) { skip2 = false; next(); times.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else return;
    hideErr($("ykWhenErr")); drawDays(); mark();
  });

  /* 上の 1・2・3 の印 */
  function mark(){
    const done = [!!mode, pick.length > 0, !!($("y_name").value.trim() && $("y_mail").value.trim())];
    steps.forEach((li, i) => li.classList.toggle("ok", done[i]));
  }
  ["y_name","y_mail"].forEach(id => $(id).addEventListener("input", () => { mark(); hideErr($(id).parentNode.querySelector(".err")); }));

  function showErr(el, msg){ el.textContent = msg; el.hidden = false; }
  function hideErr(el){ if (el) el.hidden = true; }

  /* 送る */
  form.addEventListener("submit", e => {
    e.preventDefault();
    let bad = null;
    const need = (ok, el, msg, focus) => { if (!ok) { showErr(el, msg); bad = bad || focus; } else hideErr(el); };
    need(!!mode, form.querySelector(".yk-mode .err"), "スタジオかオンラインを選んでください。", form.querySelector(".yk-mode"));
    need(!mode || pick.length > 0, $("ykWhenErr"), "日時を選んでください。", $("ykWhen"));
    need($("y_name").value.trim(), $("y_name").parentNode.querySelector(".err"), "お名前を入れてください。", $("y_name"));
    need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("y_mail").value.trim()), $("y_mail").parentNode.querySelector(".err"), "メールアドレスを確かめてください。", $("y_mail"));
    if (bad) { bad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const val = n => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(x => x.value);
    const data = { mode, slots: pick, name: $("y_name").value, kana: $("y_kana").value, email: $("y_mail").value.trim(), tel: $("y_tel").value,
      age: $("y_age").value, level: $("y_level").value, guitar: val("guitar")[0] || "", goals: val("goals"), song: $("y_song").value, q: [myPlan ? "【気になるプラン】" + myPlan : "", $("y_q").value].filter(Boolean).join("\n"),
      from: $("y_from").value, website: $("y_web").value };
    const btn = $("ykSend"), err = $("ykErr");
    btn.disabled = true; btn.textContent = "送っています…"; hideErr(err);
    const send = demo ? new Promise(r => setTimeout(() => r({ ok: true, mode }), 700))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify(data) }).then(r => r.json());
    send.then(r => {
      if (!r.ok) {
        showErr(err, r.msg || "送信できませんでした。");
        if (r.gone) { pick = []; slots = null; fetchSlots().then(drawDays); }
        return;
      }
      finish(data);
    }).catch(() => showErr(err, "送信できませんでした。通信の状態を確かめて、もう一度お試しください。うまくいかない場合は、お問い合わせフォームからご連絡ください。"))
      .finally(() => { btn.disabled = false; btn.textContent = mode === "studio" ? "この内容で申し込む" : "この日時で予約する"; });
  });

  function finish(d){
    const el = $("ykDone"), esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
    const list = d.slots.map((t, i) => `<li>${d.mode === "studio" ? `<span class="chip or">第${i + 1}希望</span>` : ""}<b>${full(t)}</b></li>`).join("");
    el.innerHTML = d.mode === "studio"
      ? `<span class="chip or">RECEIVED</span><h3>お申し込みを受け付けました</h3><p>スタジオのお部屋の空きを確かめて、<b>24時間以内に「日程確定」のメール</b>をお送りします。まだ予約は確定していませんので、メールをお待ちください。</p><ol class="yk-picked">${list}</ol>`
      : `<span class="chip gr">CONFIRMED</span><h3>予約が確定しました</h3><p>当日の入り口（Google Meet のリンク）を、メールでお送りしました。</p><ol class="yk-picked">${list}</ol>`;
    el.innerHTML += `<p class="small">確認のメールを <b>${esc(d.email)}</b> にお送りしました。届かないときは、迷惑メールのフォルダもご覧ください。${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p><a class="btn line" href="./">トップへ戻る</a>`;
    form.hidden = true; document.querySelector(".yk-steps").hidden = true; el.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
  }
})();
