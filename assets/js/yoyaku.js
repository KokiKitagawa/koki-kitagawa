/* yoyaku.js — 体験レッスンの予約ページの動き
   空き枠は Apps Script（Googleカレンダー）から読む。?demo=1 を付けると、見本の空き枠で動きだけ確かめられる（送信はしない）。
   2026-10-25：日時は1つだけ選ぶ（スタジオもオンラインも）。申し込むと「予約を確定する」メールが届き、リンクを開くと確定。
   メールアドレスの打ちまちがい（gmial.com など）は、入れたときに教える。 */
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
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);

  let slots = null, mode = "", day = "", pick = [], prev = null;

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
    mode = r.value; pick = []; hideErr(form.querySelector(".yk-mode .err"));
    hint.textContent = "ご都合のよい日時を、1つ選んでください";
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
    times.innerHTML = list.length ? `<p class="yk-dh">${full(list[0].s).replace(/\d+:\d+〜$/, "")}</p><div class="opts">` + list.map(s => { const on = pick.includes(s.s);
      return `<label class="opt${on ? " t1" : ""}"><input type="checkbox" value="${s.s}" ${on ? "checked" : ""}><span>${hm(s.s)}${on ? `<em class="yk-tag">予約</em>` : ""}</span></label>`; }).join("") + "</div>" : "";
  }
  days.addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (!b) return; day = b.dataset.day; drawDays(); });
  /* 時間を押したとき：1つだけ。別の時間を押すと入れかわる */
  times.addEventListener("change", e => {
    const t = Number(e.target.value);
    hideErr($("ykWhenErr"));
    pick = e.target.checked ? [t] : [];
    drawDays(); mark();
  });
  function drawPicked(){
    picked.innerHTML = pick.map(t => `<li><span class="chip gr">予約する日時</span><b>${full(t)}</b><button type="button" class="yk-x" data-rm="${t}" aria-label="取り消す">×</button></li>`).join("");
  }
  picked.addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]"); if (!rm) return;
    pick = []; hideErr($("ykWhenErr")); drawDays(); mark();
  });

  /* ---------- メールアドレスの打ちまちがい ---------- */
  const DOMAINS = ["gmail.com","yahoo.co.jp","icloud.com","me.com","mac.com","outlook.com","outlook.jp","hotmail.com","hotmail.co.jp","live.jp","live.com","msn.com",
    "docomo.ne.jp","ezweb.ne.jp","au.com","softbank.ne.jp","i.softbank.jp","ymobile.ne.jp","yahoo.ne.jp","ybb.ne.jp","nifty.com","ocn.ne.jp","biglobe.ne.jp","so-net.ne.jp","googlemail.com","yahoo.com"];
  const CARRIER = ["docomo.ne.jp","ezweb.ne.jp","au.com","softbank.ne.jp","i.softbank.jp","ymobile.ne.jp"];
  const WRONG = { "gmail.co.jp": "gmail.com", "gmail.jp": "gmail.com", "gmail.ne.jp": "gmail.com", "yahoo.jp": "yahoo.co.jp", "yahoo.co.jo": "yahoo.co.jp", "icloud.co.jp": "icloud.com", "icloud.jp": "icloud.com", "docomo.co.jp": "docomo.ne.jp", "docomo.jp": "docomo.ne.jp", "ezweb.co.jp": "ezweb.ne.jp", "softbank.co.jp": "softbank.ne.jp" };
  function dist(a, b){
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : 99);
    return d[a.length][b.length];
  }
  function check(v){
    const m = v.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
    if (!m) return null;
    const dom = m[2].replace(/,/g, ".");
    if (DOMAINS.includes(dom)) return CARRIER.includes(dom) ? { carrier: true } : null;
    let best = WRONG[dom] || "", bd = best ? 0 : 99;
    if (!best) DOMAINS.forEach(x => { const d = dist(dom, x); if (d < bd) { bd = d; best = x; } });
    return best && bd <= (dom.length > 9 ? 2 : 1) ? { fix: m[1] + "@" + best } : null;
  }
  const mailEl = $("y_mail"), sug = $("ykSug");
  let sugFix = "", sugOk = false;
  function drawSug(){
    const v = mailEl.value.normalize("NFKC").replace(/\s/g, "");
    if (v !== mailEl.value) mailEl.value = v;   // 全角の＠や空白を直す
    const r = check(v);
    sugFix = r && r.fix && !sugOk ? r.fix : "";
    if (sugFix) { sug.className = "yk-sug"; sug.innerHTML = `もしかして <b>${esc(sugFix)}</b> ですか？<button type="button" class="yk-chg" data-fix>直す</button><button type="button" class="yk-chg" data-keep>このままでいい</button>`; sug.hidden = false; }
    else if (r && r.carrier) { sug.className = "yk-sug note"; sug.textContent = "携帯会社のメールは、パソコンからのメールが届かない設定になっていることがあります。「@gmail.com」からのメールを受け取れるようにしておくか、Gmail などのアドレスをお使いください。"; sug.hidden = false; }
    else sug.hidden = true;
  }
  mailEl.addEventListener("blur", drawSug);
  mailEl.addEventListener("input", () => { sugOk = false; if (!sug.hidden) drawSug(); });
  sug.addEventListener("click", e => {
    if (e.target.closest("[data-fix]")) { mailEl.value = sugFix; sugOk = false; }
    else if (e.target.closest("[data-keep]")) sugOk = true;
    else return;
    drawSug(); hideErr(mailEl.parentNode.querySelector(".err")); mark();
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
    drawSug();
    let bad = null;
    const need = (ok, el, msg, focus) => { if (!ok) { showErr(el, msg); bad = bad || focus; } else hideErr(el); };
    need(!!mode, form.querySelector(".yk-mode .err"), "スタジオかオンラインを選んでください。", form.querySelector(".yk-mode"));
    need(!mode || pick.length > 0, $("ykWhenErr"), "日時を選んでください。", $("ykWhen"));
    need($("y_name").value.trim(), $("y_name").parentNode.querySelector(".err"), "お名前を入れてください。", $("y_name"));
    const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailEl.value.trim());
    need(mailOk && !sugFix, mailEl.parentNode.querySelector(".err"), mailOk ? "メールアドレスを確かめてください（下の「直す」か「このままでいい」を押してください）。" : "メールアドレスを確かめてください。", mailEl);
    if (bad) { bad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const val = n => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(x => x.value);
    const data = { mode, slots: pick, name: $("y_name").value, kana: $("y_kana").value, email: mailEl.value.trim(), tel: $("y_tel").value,
      age: $("y_age").value, level: $("y_level").value, guitar: val("guitar")[0] || "", goals: val("goals"), song: $("y_song").value, q: [myPlan ? "【気になるプラン】" + myPlan : "", $("y_q").value].filter(Boolean).join("\n"),
      from: $("y_from").value, website: $("y_web").value, prev };
    const btn = $("ykSend"), err = $("ykErr");
    btn.disabled = true; btn.textContent = "送っています…"; hideErr(err);
    const send = demo ? new Promise(r => setTimeout(() => r({ ok: true, pending: true, mode, min: 30, rid: "demo", rk: "demo" }), 700))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify(data) }).then(r => r.json());
    send.then(r => {
      if (!r.ok) {
        if (r.badMail) { showErr(mailEl.parentNode.querySelector(".err"), r.msg); mailEl.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        showErr(err, r.msg || "送信できませんでした。");
        if (r.gone) { pick = []; slots = null; fetchSlots().then(drawDays); }
        return;
      }
      prev = r.rid ? { id: r.rid, k: r.rk } : null;
      finish(data, r);
    }).catch(() => showErr(err, "送信できませんでした。通信の状態を確かめて、もう一度お試しください。うまくいかない場合は、お問い合わせフォームからご連絡ください。"))
      .finally(() => { btn.disabled = false; btn.textContent = "この内容で申し込む"; });
  });

  function finish(d, r){
    const el = $("ykDone"), min = r.min || 30;
    const list = d.slots.map(t => `<li><span class="chip or">${d.mode === "studio" ? "スタジオ" : "オンライン"}</span><b>${full(t)}</b></li>`).join("");
    el.innerHTML = `<span class="chip or">あと1つ</span><h3>メールのリンクを開くと、予約が確定します</h3>`
      + `<p><b>${esc(d.email)}</b> に「予約を確定する」メールをお送りしました。<b>${min}分以内に、メールの中のリンクを開いてください。</b>開くまで、予約はまだ確定していません。</p>`
      + `<ol class="yk-picked">${list}</ol>`
      + `<p class="small">数分たってもメールが届かないときは<br>・迷惑メールのフォルダも見てください<br>・メールアドレスがまちがっているかもしれません。下のボタンから、アドレスを直してもう一度お申し込みください<br>・携帯会社のメールは、パソコンからのメールが届かない設定のことがあります${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p>`
      + `<button type="button" class="btn line" id="ykAgain">アドレスを直して申し込み直す</button>`;
    form.hidden = true; document.querySelector(".yk-steps").hidden = true; el.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
    $("ykAgain").addEventListener("click", () => {
      el.hidden = true; form.hidden = false; document.querySelector(".yk-steps").hidden = false; sugOk = false;
      /* 自分の申し込み中の枠は、ほかの人には出ないので、手もとで足して選んだままにする */
      slots = null; fetchSlots().then(() => { pick.forEach(t => { if (!slots.some(s => s.s === t)) slots.push({ s: t, st: d.mode === "studio" ? 1 : 0 }); }); slots.sort((a, b) => a.s - b.s); drawDays(); });
      mailEl.scrollIntoView({ behavior: "smooth", block: "center" }); mailEl.focus({ preventScroll: true });
    });
  }
})();
