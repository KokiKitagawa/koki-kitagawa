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
    mode = r.value; pick = []; hideErr(form.querySelector(".yk-mode .err"));
    hint.textContent = mode === "studio" ? "候補を2つまで選べます（2つあると決まりやすいです）" : "1つ選んでください。その場で予約が決まります";
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
      return `<button type="button" role="tab" class="yk-day ${k === day ? "on" : ""} w${new Date(t + 9 * 3600e3).getUTCDay()}" data-day="${k}" aria-selected="${k === day}"><small>${wd(t)}</small><b>${md(t)}</b><i>${n ? "✓ 選択中" : by[k].length + "枠"}</i></button>`; }).join("");
    if (slots && !keys.length) times.innerHTML = `<p class="small yk-none">いま予約できる日時がありません。${mode === "studio" ? "オンラインを選ぶか、" : ""}<a href="./#contact">お問い合わせフォーム</a>からご相談ください。</p>`;
    else drawTimes(by[day] || []);
    drawPicked();
  }
  function drawTimes(list){
    times.innerHTML = list.length ? `<p class="yk-dh">${full(list[0].s).replace(/\d+:\d+〜$/, "")}</p><div class="opts">` + list.map(s => `<label class="opt"><input type="checkbox" value="${s.s}" ${pick.includes(s.s) ? "checked" : ""}><span>${hm(s.s)}</span></label>`).join("") + "</div>" : "";
  }
  days.addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (!b) return; day = b.dataset.day; drawDays(); });
  times.addEventListener("change", e => {
    const t = Number(e.target.value);
    if (e.target.checked) {
      if (mode === "online") pick = [t];
      else if (pick.length >= 2) { e.target.checked = false; showErr($("ykWhenErr"), "候補は2つまでです。変えるときは、下の × で外してください。"); return; }
      else pick.push(t);
    } else pick = pick.filter(x => x !== t);
    hideErr($("ykWhenErr")); drawDays(); mark();
  });
  function drawPicked(){
    picked.innerHTML = pick.map((t, i) => `<li><span class="chip ${mode === "studio" ? "or" : "gr"}">${mode === "studio" ? "第" + (i + 1) + "希望" : "予約する日時"}</span><b>${full(t)}</b><button type="button" class="yk-x" data-rm="${t}" aria-label="外す">×</button></li>`).join("");
  }
  picked.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (!b) return; pick = pick.filter(x => x !== Number(b.dataset.rm)); drawDays(); mark(); });

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
      age: $("y_age").value, level: $("y_level").value, guitar: val("guitar")[0] || "", goals: val("goals"), song: $("y_song").value, q: $("y_q").value,
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
