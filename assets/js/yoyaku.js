/* yoyaku.js — 体験レッスンの予約ページの動き
   空き枠は Apps Script（Googleカレンダー）から読む。?demo=1 を付けると、見本の空き枠で動きだけ確かめられる（送信はしない）。
   2026-10-25：日時は1つだけ選ぶ（スタジオもオンラインも）。申し込むと「予約を確定する」メールが届き、リンクを開くと確定。
   メールアドレスの打ちまちがい（gmial.com など）は、入れたときに教える。
   公式LINE のメニューから開いたとき（?l=合言葉）は、メールの確認なしでその場で確定。メールアドレスはなくてもよく、お知らせは LINE に届く。
   2026-11-05：1画面ずつ（1 受け方 → 2 日時 → 3 お名前 → 4 くわしく（任意） → 5 確認）。生徒さんページ（seito.js）と同じ形。
   スマホの「戻る」でも1つ前の画面に。上の5つのボタンで、行ったことのある画面に移れる（入れた内容は消えない） */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = JSON.parse($("ykcfg").textContent);
  const demo = /[?&]demo=1/.test(location.search);
  const form = $("yk"), days = $("ykDays"), times = $("ykTimes"), hint = $("ykHint"), load = $("ykLoad"), dec = $("ykDec");
  const TZ = "Asia/Tokyo", W = ["日","月","火","水","木","金","土"];
  const part = (t, o) => new Intl.DateTimeFormat("ja-JP", Object.assign({ timeZone: TZ }, o)).format(new Date(t));
  const dayKey = t => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const wd = t => W[new Date(t + 9 * 3600e3).getUTCDay()];
  const md = t => { const d = new Date(t + 9 * 3600e3); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); };
  const hm = t => part(t, { hour: "numeric", minute: "2-digit" });
  const full = t => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${wd(t)}）${hm(t)}〜`; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);

  let slots = null, mode = "", day = "", pick = [], prev = null, step = 1, seen = 1;
  const lkey = (new URLSearchParams(location.search).get("l") || "").trim();

  /* トップの「体験から始める」で来たとき：気になるプランを出して、申し込みの内容にも入れる */
  const plan = (new URLSearchParams(location.search).get("plan") || "").trim();
  const myPlan = (cfg.plans || []).includes(plan) ? plan : "";
  if (myPlan) { const el = $("ykPlan"); el.innerHTML = `<span class="chip or">気になるプラン</span><b>${myPlan}</b>（体験のあとで、くわしくご案内します）`; el.hidden = false; }

  if (!cfg.api && !demo) { $("ykClosed").hidden = false; form.hidden = true; return; }

  /* LINE から開いたとき */
  if (lkey) {
    const el = $("ykLine");
    el.innerHTML = `<span class="chip gr">LINE</span><b>LINE から開いています。</b>申し込むと、その場で予約が決まります。確定や前の日のお知らせは、LINE に届きます。`;
    el.hidden = false;
    const add = $("ykLineAdd"); if (add) add.hidden = true;   // もう LINE から来ている
    document.querySelector('label[for="y_mail"]').innerHTML = `メールアドレス<i class="opt-i">なくても大丈夫です</i>`;
  }

  /* 2026-11-05：LINE から開いた人に、いまの体験の予約を見せる（ここからキャンセルできる）。予約があるあいだは、申し込みの画面は出さない
     ?demo=1&mine=1 で見本 */
  const mineBox = $("ykMine");
  function drawMine(list){
    if (!list.length) { mineBox.hidden = true; form.hidden = false; return; }
    form.hidden = true; mineBox.hidden = false;
    mineBox.innerHTML = `<div class="yk-lg">ご予約中の<wbr>体験レッスン</div><ol class="yk-picked sk-lessons">` + list.map(x => `<li class="sk-l" data-id="${esc(x.id)}">
      <span class="chip ${x.state === "確定" ? "gr" : "or"}">${x.state === "確定" ? "確定" : "確定待ち"}</span>
      <span class="sk-lt"><b><span class="sk-w">${esc(x.when)}（60分）</span></b><small>${esc(x.mode)}・${esc(x.place)}</small></span>
      ${x.can ? `<button type="button" class="yk-chg" data-cx>キャンセル</button>` : ""}
      <div class="sk-cx" ${x.can ? "hidden" : ""}>${x.can ? "" : `<p>キャンセルの<wbr>期限（3日前 23:59）を<wbr>過ぎています。<wbr>変更・<wbr>キャンセルは、<wbr>LINE の<wbr>トークで<wbr>ご連絡ください。</p>`}</div></li>`).join("")
      + `</ol><p class="small">体験レッスンは、<wbr>はじめての方に<wbr>1回だけ<wbr>受けていただいています。<wbr>日時を<wbr>変えたいときは、<wbr>キャンセルしてから<wbr>選び直してください<wbr>（3日前 23:59 までは<wbr>無料）。</p>`;
  }
  if (lkey || (demo && /[?&]mine=1/.test(location.search))) {
    const sample = () => { const t = Date.now() + 5 * 864e5; return { ok: true, list: [{ id: "D1", state: "確定", mode: "スタジオ", when: full(t - t % 3600e3), place: "部屋は前の日に決まります", can: true }] }; };
    (demo ? Promise.resolve(sample()) : fetch(cfg.api + "?a=tme&l=" + encodeURIComponent(lkey), { cache: "no-store" }).then(r => r.json()))
      .then(r => { if (r.ok) drawMine(r.list || []); }).catch(() => {});
  }
  mineBox.addEventListener("click", e => {
    const li = e.target.closest(".sk-l"); if (!li) return;
    const box = li.querySelector(".sk-cx");
    if (e.target.closest("[data-cx]")) {
      box.innerHTML = `<p>この体験レッスンを<wbr>キャンセルします。<wbr>お支払いは<wbr>ありません。</p><div class="sk-cxb"><button type="button" class="btn or sm" data-yes>キャンセルする</button><button type="button" class="btn line sm" data-no>やめる</button></div><p class="err" hidden></p>`;
      box.hidden = false; return;
    }
    if (e.target.closest("[data-no]")) { box.hidden = true; return; }
    const yes = e.target.closest("[data-yes]"); if (!yes) return;
    yes.disabled = true; yes.textContent = "送っています…";
    const p = demo ? new Promise(r => setTimeout(() => r({ ok: true, msg: "キャンセルしました（見本なので、実際には送っていません）。" }), 500))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify({ a: "tcancel", l: lkey, id: li.dataset.id }) }).then(r => r.json());
    p.then(r => {
      if (!r.ok) throw r;
      mineBox.innerHTML = `<p class="sk-done">${esc(r.msg)}</p><p class="small">べつの<wbr>日時で<wbr>受けるときは、<wbr>下から<wbr>選び<wbr>直せます。</p>`;
      form.hidden = false; fetchSlots();
    }).catch(r => { const er = box.querySelector(".err"); er.textContent = (r && r.msg) || "うまくいきませんでした。もう一度お試しください。"; er.hidden = false; yes.disabled = false; yes.textContent = "キャンセルする"; });
  });

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
    const pre = window.kkPre; window.kkPre = null;   // ページの頭で読みはじめた分（1回目だけ使う）
    const p = demo ? new Promise(r => setTimeout(() => r({ ok: true, slots: demoSlots() }), 400)) : (pre || fetch(cfg.api + "?a=slots", { cache: "no-store" }).then(r => r.json()));
    return p.then(r => { if (!r.ok) throw 0; slots = r.slots; load.hidden = true; }).catch(() => {
      load.hidden = true; slots = [];
      showErr($("ykWhenErr"), "空いている日時を読み込めませんでした。時間をおいてもう一度開くか、お問い合わせフォームからご連絡ください。");
    });
  }
  const loading = fetchSlots();

  /* ---------- 画面の切りかえ ---------- */
  const mailOk = () => (lkey && !mailEl.value.trim()) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailEl.value.trim());
  const infoOk = () => !!$("y_name").value.trim() && mailOk() && !sugFix;
  /* その画面に行けるか（前の画面で決めることが決まっているか） */
  function reach(d){ return d <= 1 || (d === 2 && !!mode) || (d === 3 && !!mode && pick.length > 0) || (d >= 4 && !!mode && pick.length > 0 && infoOk() && seen >= 4); }
  function go(n, quiet){
    step = n; if (n > seen) seen = n;
    form.querySelectorAll(".sk-step").forEach(x => { x.hidden = Number(x.dataset.step) !== n; });
    form.querySelectorAll(".sk-dots button").forEach(b => { const d = Number(b.dataset.d); b.className = d === n ? "on" : reach(d) ? "pa" : ""; b.disabled = !reach(d); if (d === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
    $("skBack").hidden = n === 1;
    const hb = document.querySelector(".yk-back"); if (hb) hb.style.visibility = n === 1 ? "" : "hidden";   // 上の「← 戻る」（レッスンのページへ）は1画面目だけ
    /* 1画面目だけ：体験の説明・LINE の案内・ご案内の表 */
    [".yk-trial", "#ykLineAdd", "#ykNotes"].forEach(q => { const el = document.querySelector(q); if (el) el.hidden = n !== 1 || (q === "#ykLineAdd" && !!lkey); });
    if (n === 2) loading.then(drawDays);
    if (n === 5) drawCheck();
    if (window.gtag && !demo && !quiet) gtag("event", "trial_step", { step: n });
    if (!quiet) { if (!history.state || history.state.yk !== n) history.pushState({ yk: n }, ""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }
  history.replaceState({ yk: 1 }, "");
  addEventListener("popstate", e => { const n = e.state && e.state.yk ? e.state.yk : 1; go(reach(n) ? n : 1, true); window.scrollTo(0, 0); });
  $("skBack").addEventListener("click", () => { if (history.state && history.state.yk === step && step > 1) history.back(); else go(Math.max(1, step - 1)); });
  form.querySelector(".sk-dots").addEventListener("click", e => { const b = e.target.closest("button[data-d]"); if (!b || b.disabled) return; const d = Number(b.dataset.d); if (d !== step) go(d); });

  /* 1 受け方：押したら次へ（前に選んだ受け方をもう一度押しても次へ） */
  form.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
    if (mode !== r.value) { pick = []; day = ""; }
    mode = r.value; hideErr(form.querySelector(".yk-mode .err"));
    hint.textContent = "ご都合のよい日時を、1つ選んでください";
    setTimeout(() => go(2), 160);
  }));
  form.querySelectorAll(".yk-mode .kc").forEach(l => l.addEventListener("click", e => { const r = l.querySelector("input"); if (r.checked && step === 1 && e.target === r && mode === r.value) setTimeout(() => go(2), 160); }));

  const avail = () => (slots || []).filter(s => mode === "online" ? s.on !== 0 : s.st);
  function drawDays(){
    const list = avail(), by = {};
    list.forEach(s => { (by[dayKey(s.s)] = by[dayKey(s.s)] || []).push(s); });
    const keys = Object.keys(by).sort();
    if (!keys.includes(day)) day = keys[0] || "";
    days.innerHTML = keys.map(k => { const t = by[k][0].s, n = by[k].filter(s => pick.includes(s.s)).length;
      return `<button type="button" role="tab" class="yk-day ${k === day ? "on" : ""} w${new Date(t + 9 * 3600e3).getUTCDay()}" data-day="${k}" aria-selected="${k === day}"><small>${wd(t)}</small><b>${md(t)}</b><i>${n ? "✓ 選択中" : by[k].length + "枠"}</i></button>`; }).join("");
    if (slots && !keys.length) times.innerHTML = `<p class="small yk-none">いま予約できる日時がありません。${mode === "studio" ? "オンラインを選ぶか、" : ""}<a href="./#contact">お問い合わせフォーム</a>からご相談ください。</p>`;
    else drawTimes(by[day] || []);
    drawDec();
  }
  /* 下の決定ボタン：時間を選ぶと「この日時で次へ」 */
  function drawDec(){
    dec.disabled = !pick.length;
    dec.innerHTML = pick.length ? `<span>${full(pick[0])}</span><b>この日時で次へ</b>` : "時間を<wbr>選んでください";
  }
  dec.addEventListener("click", () => { if (pick.length) go(3); });
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
    drawDays();
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
    drawSug(); hideErr(mailEl.parentNode.querySelector(".err"));
  });
  ["y_name","y_mail"].forEach(id => $(id).addEventListener("input", () => hideErr($(id).parentNode.querySelector(".err"))));

  /* 3 お名前：「次へ」で確かめる。4 くわしく：何も書かなくても次へ */
  function checkInfo(){
    drawSug();
    let bad = null;
    const need = (ok, el, msg, focus) => { if (!ok) { showErr(el, msg); bad = bad || focus; } else hideErr(el); };
    need($("y_name").value.trim(), $("y_name").parentNode.querySelector(".err"), "お名前を入れてください。", $("y_name"));
    need(mailOk() && !sugFix, mailEl.parentNode.querySelector(".err"), mailOk() ? "メールアドレスを確かめてください（下の「直す」か「このままでいい」を押してください）。" : "メールアドレスを確かめてください。", mailEl);
    if (bad) { bad.scrollIntoView({ behavior: "smooth", block: "center" }); bad.focus({ preventScroll: true }); }
    return !bad;
  }
  form.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", () => {
    const n = Number(b.dataset.next);
    if (n === 4 && !checkInfo()) return;
    if (n === 4 && seen < 4) seen = 4;
    go(n);
  }));
  /* お名前・メールで「次へ」（改行）を押したとき */
  $("y_name").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); mailEl.focus(); } });
  mailEl.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); mailEl.blur(); } });

  /* 5 確認：選んだ・入れた内容を並べる（押すと、その画面に戻って直せる） */
  const val = n => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(x => x.value);
  function drawCheck(){
    const row = (k, v, d) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd>${d ? `<button type="button" class="yk-fix" data-to="${d}">直す</button>` : ""}</div>` : "";
    const more = [$("y_age").value, $("y_level").value, val("guitar")[0] || ""].filter(Boolean).join("・");
    $("ykCheck").innerHTML = row("受け方", mode === "studio" ? "小岩のスタジオ" : "オンライン", 1)
      + row("日時", pick.length ? full(pick[0]) : "", 2)
      + row("お名前", $("y_name").value.trim() + ($("y_kana").value.trim() ? `（${$("y_kana").value.trim()}）` : ""), 3)
      + row("メール", mailEl.value.trim() || (lkey ? "なし（お知らせは LINE に届きます）" : ""), 3)
      + row("電話番号", $("y_tel").value.trim(), 3)
      + row("受ける方・ギター", more, 4)
      + row("どうなりたいか", val("goals").join("・"), 4)
      + row("弾きたい曲", $("y_song").value.trim(), 4)
      + row("ご質問", $("y_q").value.trim(), 4)
      + (myPlan ? row("気になるプラン", myPlan, 0) : "");
  }
  $("ykCheck").addEventListener("click", e => { const b = e.target.closest("[data-to]"); if (b && Number(b.dataset.to)) go(Number(b.dataset.to)); });

  function showErr(el, msg){ el.textContent = msg; el.hidden = false; }
  function hideErr(el){ if (el) el.hidden = true; }

  /* 送る */
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (step !== 5) return;   // 確認の画面でだけ送る（入力中の改行で送られないように）
    if (!mode) { go(1); return; }
    if (!pick.length) { go(2); showErr($("ykWhenErr"), "日時を選んでください。"); return; }
    if (!infoOk()) { go(3); checkInfo(); return; }
    const data = { mode, slots: pick, name: $("y_name").value, kana: $("y_kana").value, email: mailEl.value.trim(), tel: $("y_tel").value,
      age: $("y_age").value, level: $("y_level").value, guitar: val("guitar")[0] || "", goals: val("goals"), song: $("y_song").value, q: [myPlan ? "【気になるプラン】" + myPlan : "", $("y_q").value].filter(Boolean).join("\n"),
      from: $("y_from").value, website: $("y_web").value, prev, l: lkey };
    const btn = $("ykSend"), err = $("ykErr");
    btn.disabled = true; btn.textContent = "送っています…"; hideErr(err);
    const send = demo ? new Promise(r => setTimeout(() => r(lkey ? { ok: true, line: true, mode } : { ok: true, pending: true, mode, min: 30, rid: "demo", rk: "demo" }), 700))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify(data) }).then(r => r.json());
    send.then(r => {
      if (!r.ok) {
        if (r.badMail) { go(3); showErr(mailEl.parentNode.querySelector(".err"), r.msg); mailEl.focus({ preventScroll: true }); return; }
        if (r.gone) { pick = []; slots = null; go(2); showErr($("ykWhenErr"), r.msg || "その日時は、ちょうど埋まってしまいました。ほかの日時を選んでください。"); fetchSlots().then(drawDays); return; }
        showErr(err, r.msg || "送信できませんでした。");
        return;
      }
      prev = r.rid ? { id: r.rid, k: r.rk } : null;
      finish(data, r);
    }).catch(() => showErr(err, "送信できませんでした。通信の状態を確かめて、もう一度お試しください。うまくいかない場合は、お問い合わせフォームからご連絡ください。"))
      .finally(() => { btn.disabled = false; btn.innerHTML = "この<wbr>内容で<wbr>申し込む"; });
  });

  function finish(d, r){
    const el = $("ykDone"), min = r.min || 30;
    if (window.gtag && !demo) gtag("event", "trial_booking", { mode: d.mode, via: r.line ? "line" : "mail" });
    const list = d.slots.map(t => `<li><span class="chip or">${d.mode === "studio" ? "スタジオ" : "オンライン"}</span><b>${full(t)}</b></li>`).join("");
    if (r.line) {   // LINE から：その場で確定
      el.innerHTML = `<span class="chip gr">CONFIRMED</span><h3>予約が確定しました</h3>`
        + `<p>LINE に、確定のお知らせを送りました。${d.mode === "studio" ? "<b>スタジオのお部屋は、レッスンの前の日に北川が予約</b>して、場所を LINE でお知らせします。" : "当日の入り口（Google Meet のリンク）も、LINE のお知らせに入っています。"}</p>`
        + `<ol class="yk-picked">${list}</ol>`
        + `<p class="small">予約の確認・キャンセルは、LINE のメニューの「予約の確認・キャンセル」からできます。${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p>`
        + (cfg.line ? `<a class="btn or" href="${esc(cfg.line)}">LINE のトークにもどる</a>` : "");
      form.hidden = true; $("ykLine").hidden = true; el.hidden = false;
      el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
      return;
    }
    el.innerHTML = `<span class="chip or">あと1つ</span><h3>メールのリンクを開くと、予約が確定します</h3>`
      + `<p><b>${esc(d.email)}</b> に「予約を確定する」メールをお送りしました。<b>${min}分以内に、メールの中のリンクを開いてください。</b>開くまで、予約はまだ確定していません。</p>`
      + `<ol class="yk-picked">${list}</ol>`
      + `<p class="small">数分たってもメールが届かないときは<br>・迷惑メールのフォルダも見てください<br>・メールアドレスがまちがっているかもしれません。下のボタンから、アドレスを直してもう一度お申し込みください<br>・携帯会社のメールは、パソコンからのメールが届かない設定のことがあります${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p>`
      + `<button type="button" class="btn line" id="ykAgain">アドレスを直して申し込み直す</button>`;
    form.hidden = true; el.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
    $("ykAgain").addEventListener("click", () => {
      el.hidden = true; form.hidden = false; sugOk = false; go(3);
      /* 自分の申し込み中の枠は、ほかの人には出ないので、手もとで足して選んだままにする */
      slots = null; fetchSlots().then(() => { pick.forEach(t => { if (!slots.some(s => s.s === t)) slots.push({ s: t, st: d.mode === "studio" ? 1 : 0 }); }); slots.sort((a, b) => a.s - b.s); drawDays(); });
      mailEl.focus({ preventScroll: true });
    });
  }
  go(1, true);
})();
