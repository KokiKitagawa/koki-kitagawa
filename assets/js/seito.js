/* seito.js — 生徒さん専用の予約ページ（seito.html?k=合言葉）の動き
   生徒さんの情報・残りの回数・空き枠は Apps Script（Googleカレンダー）から読む。
   ?demo=1 を付けると、見本の生徒さんで動きだけ確かめられる（送信はしない）。&out=1 で「今月の回数を使い切った」見本。
   2026-10-25：何日分でも、まとめて選んで1回で予約できる（スタジオもオンラインも、その場で確定。部屋は前の日に北川くんが取る）。
   2026-10-27：使わなかった回は、キャンセルしなくても次の月に回せる（今月2回・来月6回など）。選んだ日ごとに「〇月の何回目」を出す。
     追加（単発）をキャンセルしても「次の月まで使えます」と出さない。LINE がまだの人に「LINE でお知らせを受け取る」ボタン。
   2026-11-04：1画面ずつ進む形に（0 はじめ → 1 受け方 → 2 時間 → 3 日時 → 4 確認）。日時は1回ずつ「決定」して、
     いま何回目を選んでいるかを大きく出す。残りの回数は選ぶたびに変わる。?go=yoyaku で受け方の画面から開く（LINE のメニュー）。
   2026-11-05：上の「受け方・時間・日時・確認」を押して移れる。スタジオとオンラインを混ぜたり、日ごとに長さを変えたりできる
     （決めた日時は {t, mode, hours} で持つ。送るときは、日付の早い順に、受け方と長さが同じ続きごとに分けて送る＝サーバーと同じ数え方）。
     「1回に何時間」をやめて「レッスンの長さ（1時間で1回分）」に。「前回と同じ」で日時の画面へ。
   2026-11-10：1画面ずつ進む形をやめて、チケットに書きこむ形に（未定のチケットを押す → 対面/オンライン・長さ・日にち・時間を
     下から出るシートで選ぶ → 「申し込み前」のチケット → 下の「○回分を申し込む」でまとめて申し込む）。北川くん */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = JSON.parse($("ykcfg").textContent);
  const qs = new URLSearchParams(location.search);
  const demo = qs.get("demo") === "1", demoOut = qs.get("out") === "1";
  const key = (qs.get("k") || "").trim();
  const H = 3600e3, TZ = "Asia/Tokyo", W = ["日","月","火","水","木","金","土"];
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

  let me = null, pick = [], ed = null, sheet = "", lastPref = null, step = 0, first = true;
  /* pick は [{ t, mode, hours }]（書き終わった「申し込み前」の回）。受け方がちがうレッスンの間は、移動の時間（コード.gs の 設定.移動の分）をあける */
  const MOVE = 60 * 60e3, ML = m => m === "online" ? "オンライン" : "対面", MS = s => s === "スタジオ" ? "対面" : s;   // 2026-11-10：画面では「対面」（裏側は「スタジオ」のまま）
  const rng = (a, b) => a === b ? `${a}` : b === a + 1 ? `${a}・${b}` : `${a}〜${b}`;
  const byT = () => pick.slice().sort((a, b) => a.t - b.t), at0 = t => pick.find(p => p.t === t);
  const totalH = () => pick.reduce((a, p) => a + p.hours, 0);

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
    return { ok: true, name: "山田 花子", plan: "月4回", base: 4, single: cfg.single, early: 20, max: 4, days: 12,
      months: demoOut ? [{ m: m0, base: 4, carry: 0, used: 4, left: 0 }, { m: m1, base: 4, carry: 0, used: 0, left: 4 }]
                      : [{ m: m0, base: 4, carry: 1, used: 4, left: 1 }, { m: m1, base: 4, carry: 0, used: 0, left: 4 }],
      quota: demoOut ? { [m0]: Array(25).fill(0), [m1]: Array.from({ length: 25 }, (_, n) => Math.min(n, 4)) } : { [m0]: Array.from({ length: 25 }, (_, n) => Math.min(n, 1)), [m1]: Array.from({ length: 25 }, (_, n) => Math.min(n, 4)) },
      lessons: [{ id: "L1", state: "確定", mode: "スタジオ", hours: 2, s: sl[2].s, s2: 0, getsu: 2, tan: 0, free: true, room: "サウンドスタジオM小岩店" },
                { id: "L2", state: "確定", mode: "スタジオ", hours: 1, s: sl[9].s, s2: 0, getsu: 1, tan: 0, free: true, room: "未手配" },
                { id: "L3", state: "確定", mode: "オンライン", hours: 1, s: sl[11].s, s2: 0, getsu: 0, tan: 1, free: true, room: "" }],
      done: demoOut || T12(m0 + "-02") > now ? [] : [{ m: m0, s: T12(m0 + "-02") + 7 * 3600000, mode: "スタジオ", hours: 1, getsu: 1, tan: 0 }],
      slots: demoSlots(), lineLink: "https://line.me/R/oaMessage/%40557brylm/", cnt: { base: 4, start: m0, ls: [{ m: m0, state: "確定", getsu: demoOut ? 4 : 4 }] } };
  }

  /* ---------- 読み込み ---------- */
  function bad(t, m){ $("skLoad").hidden = true; $("skMain").hidden = true; $("skBad").hidden = false; if (t) $("skBadT").textContent = t; if (m) $("skBadM").textContent = m; }
  function load(){
    $("skLoad").hidden = false;
    const pre = window.kkPre; window.kkPre = null;   // ページの頭で読みはじめた分（1回目だけ使う）
    const p = demo ? new Promise(r => setTimeout(() => r(demoMe()), 300))
      : (pre || fetch(cfg.api + "?a=me&k=" + encodeURIComponent(key), { cache: "no-store" }).then(r => r.json()));
    return p.then(r => {
      if (!r.ok) { bad(r.bad ? "このページのURLが正しくありません" : "いまは予約できません", r.msg); return; }
      if (r.cnt) { const c = r.cnt, st = count(c.base, c.start, c.ls, r.months.map(x => x.m));
        // 来月に回した分は、今月の残りから引く（実際に月謝で予約できる数）
        r.months = r.months.map(x => Object.assign({}, x, st[x.m], { left: canGetsu(c.base, c.start, c.ls, x.m, st[x.m].left) })); }
      if (demo && gateWait) r.lineLink = "";   // 見本：戻ってきたら、つながったことにする
      const linked = gateWait && !r.lineLink;
      me = r; $("skLoad").hidden = true; $("skMain").hidden = false; drawMe(); if (ed) fix(); draw(); drawGate();
      if (linked) { gateWait = false; const f = document.createElement("p"); f.className = "sk-flash sk-gok"; f.textContent = "✓ LINE とつながりました。お知らせは LINE に届きます。"; document.querySelector("#skHome .sk-me").prepend(f); setTimeout(() => f.remove(), 5000); }
      if (first) { first = false; history.replaceState({ sk: 0 }, ""); if (qs.get("go") === "yoyaku" && !(me.lineLink && !gateSkip)) startFirst(); }
    }).catch(() => bad("読み込めませんでした", "時間をおいてもう一度開いてください。うまくいかないときは、北川にご連絡ください。"));
  }
  if (!demo && (!cfg.api || !key)) { bad(); return; }

  /* ---------- 最初の画面「まず LINE をつなぎましょう」（2026-11-10 北川くん） ----------
     LINE がまだの人（me.lineLink がある人）にだけ出す。LINE で送ってページに戻ると、読み直してつながったか確かめる（見ている間は4秒ごと、2分まで）。
     「LINE を使わない」を押したら、そのスマホでは次から出さない（localStorage） */
  const SKIP = "kkLineSkip:" + (key || "demo");
  let gateSkip = false, gateWait = false, gateTry = 0, gateTimer = 0;
  try { gateSkip = localStorage.getItem(SKIP) === "1"; } catch (e) {}
  function drawGate(){
    const on = !!(me && me.lineLink) && !gateSkip && step === 0, card = document.querySelector("#skHome .sk-me");
    $("skGate").hidden = !on; if (card) card.hidden = on;
    if (step === 0) $("skNotes").hidden = on;
    if (on) { $("skGateName").textContent = me.name + " 様"; $("skGateBtn").href = me.lineLink; $("skGateWait").hidden = !gateWait; }
  }
  function gateCheck(){
    if (!gateWait || document.hidden) return;
    if (++gateTry > 30) { clearInterval(gateTimer); return; }
    load();
  }
  $("skGateBtn").addEventListener("click", () => {
    gateWait = true; gateTry = 0; $("skGateWait").hidden = false;
    clearInterval(gateTimer); gateTimer = setInterval(() => { if (!gateWait) clearInterval(gateTimer); else gateCheck(); }, 4000);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && gateWait) setTimeout(gateCheck, 600); });
  $("skSkip").addEventListener("click", () => { gateSkip = true; gateWait = false; clearInterval(gateTimer); try { localStorage.setItem(SKIP, "1"); } catch (e) {} drawGate(); window.scrollTo(0, 0); });


  /* ---------- 上のカード（お名前） ---------- */
  function drawMe(){
    $("skName").textContent = me.name + " 様";
    $("skPlan").textContent = me.plan;
    $("skOut").hidden = true;   // 2026-11-10：回数を使い切ったら「追加」のチケットを出す
    const ln = $("skLine"); if (ln) ln.hidden = true;
  }

  /* ======================================================================
     チケットに書きこむ予約（2026-11-10 北川くん）
     未定のチケットを押すと、そのチケットの中に「対面/オンライン・長さ・日にち・時間」の4つの欄が横一列で出る。
     欄を押すと画面の下から選ぶところ（シート）が出て、選ぶと閉じて次の欄へ。4つ書けたら「申し込み前」のチケットになる。
     何枚か書いて、下の「○回分を申し込む」でまとめて申し込む。
     ed＝いま書いているチケット { m: 月, mode, hours, day, t, orig: 直している申し込み前の回（新しいときは null） }
     pick＝書き終わった「申し込み前」の回 [{ t, mode, hours }]
     ====================================================================== */
  const C = n => n >= 1 && n <= 20 ? String.fromCharCode(0x245F + n) : `(${n})`;
  const circ = (a, b) => b <= a ? C(a) : b === a + 1 ? C(a) + C(b) : C(a) + "〜" + C(b);
  /* 2026-11-10：長さの欄はなくして、時計で塗った時間の数＝長さ（北川くん） */
  const FIELDS = ["mode", "day", "time"];
  const FT = { mode: "対面かオンラインか", day: "日にち", time: "時間" };
  const maxDays = () => (me && me.days) || 12;
  let foldOpen = null;   // 繰り越し分を開いているか（描き直しても開いたまま）。null＝まだ押していない
  let tkM = 0, labMap = {};   // 見ている月（0＝今月、1＝来月）／チケットの番号（確定の画面でも同じ番号を出す）
  const months = () => me.months.slice(0, 2).map(x => x.m);
  const monthEnd = m => new Date(nextM(m) + "-01T00:00:00+09:00").getTime() - 60e3;

  /* いま書いているチケットも、数えるときは1回として入れる（何回目か・残りの回数がすぐ変わるように） */
  const others = () => ed && ed.orig ? pick.filter(p => p !== ed.orig) : pick;
  function all(){
    const o = others().map(p => Object.assign({}, p));
    if (ed) { const ph = pend && pend.f === "time" && pend.v ? pend : null;   // 時計で選んでいる途中も、番号（④⑤）をすぐ変える
      o.push({ t: (ph ? ph.v : ed.t) || monthEnd(ed.m), mode: ed.mode || "studio", hours: (ph ? ph.h : ed.hours) || 1, ed: true }); }
    return o;
  }

  /* ---------- 月謝と追加（単発）の分け方（早い日から順に、その月の回数を使う。足りない分は追加。正しい数はサーバーが数え直す） ---------- */
  function split(list){
    list = (list || pick).slice().sort((a, b) => a.t - b.t);
    if (!list.length || !me) return null;
    let items;
    if (me.cnt) {
      const { base, start } = me.cnt; let ls = me.cnt.ls.slice();
      items = list.map(p => {
        const m = monKey(p.t), g = canGetsu(base, start, ls, m, p.hours), c = count(base, start, ls, [m])[m] || { used: 0, base: 0, carry: 0 };
        ls = ls.concat([{ m, state: "確定", getsu: g }]);
        return { t: p.t, m, mode: p.mode, hours: p.hours, ed: !!p.ed, getsu: g, tan: p.hours - g, nth: c.used, of: c.base + c.carry };
      });
    } else {
      const left = {};
      items = list.map(p => {
        const m = monKey(p.t), q = (me.quota || {})[m] || [0];
        if (!(m in left)) { const total = list.filter(x => monKey(x.t) === m).reduce((a, x) => a + x.hours, 0); left[m] = q[Math.min(total, q.length - 1)] || 0; }
        const g = Math.min(p.hours, left[m]); left[m] -= g;
        return { t: p.t, m, mode: p.mode, hours: p.hours, ed: !!p.ed, getsu: g, tan: p.hours - g, nth: null };
      });
    }
    const sum = k => items.reduce((a, x) => a + x[k], 0);
    return { items, getsu: sum("getsu"), tan: sum("tan") };
  }
  /* 残りの回数（書いたチケットの分を引いたあと） */
  function liveLeft(list){
    if (!me.base) return null;
    if (!me.cnt) return me.months.slice(0, 2).map(x => ({ m: x.m, left: x.left }));
    const { base, start } = me.cnt, sp = split(list), ls = me.cnt.ls.concat(sp ? sp.items.map(x => ({ m: x.m, state: "確定", getsu: x.getsu })) : []);
    const ms = months(), st = count(base, start, ls, ms.concat(nextM(ms[ms.length - 1])));
    return ms.map(m => ({ m, left: canGetsu(base, start, ls, m, st[m].left) }));
  }
  function nthText(x){
    const m = monName(x.m), a = x.nth + 1, b = x.nth + x.getsu;
    const g = x.getsu ? (x.nth != null ? `${m}の${rng(a, b)}回目` : `月謝 ${x.getsu}回分`) : "";
    const t = x.tan ? `追加（単発）${x.tan}回・${yen(me.single * x.tan)}` : "";
    return [g, t].filter(Boolean).join("＋");
  }
  /* チケットの番号は、並べた順に数える（n＝その前までの回数） */
  const labOf = (x, n) => x.getsu ? (me.base ? circ(n + 1, n + x.getsu) : "月謝") + (x.tan ? "＋" : "") : "追加";

  /* ---------- チケットを並べる ---------- */
  function drawList(){
    const ls = me.lessons || [], ms = me.months.slice(0, 2), A = all(), sp = split(A), L = liveLeft(A);
    if (tkM >= ms.length) tkM = 0;
    $("skTabs").innerHTML = ms.map((x, i) => `<button type="button" role="tab" aria-selected="${i === tkM}" class="${i === tkM ? "on" : ""}" data-tm="${i}">${monName(x.m)}<small>${me.base ? `あと${L[i].left}回` : "単発"}</small></button>`).join("");
    const mo = ms[tkM], en = monName(mo.m), mine = ls.filter(x => monKey(x.s) === mo.m);
    const tk = (cls, lab, b, sub, ac, data) => `<li class="tkt ${cls}"${data || ""}><div class="tk-r"><div class="st"><b>${lab}</b><i>${en}</i></div><div class="bd"><b>${b}</b><small>${sub}</small></div><div class="ac">${ac}</div></div></li>`;
    const one = (x, lab, cls) => {
      const room = !x.room ? "" : x.room === "取れず" ? "お部屋が取れませんでした" : /^(未手配|手配中2?)$/.test(x.room) ? "お部屋は前の日に決まります" : x.room;
      const sub = [x.state === "仮" ? "確定待ち" : "", MS(x.mode), x.hours + "時間", x.getsu && x.tan ? `追加${x.tan}回` : "", room].filter(Boolean).join("・");
      const when = `${md(x.s)}（${wd(x.s)}）${hm(x.s)}〜`;
      return tk(cls + (x.state === "仮" ? " wait" : ""), lab, when, esc(sub), x.past ? `<span class="tk-now">受講中</span>` : `<button type="button" class="yk-chg" data-cx>キャンセル</button>`,
        ` data-id="${esc(x.id)}" data-free="${x.free ? 1 : 0}" data-state="${esc(x.state)}" data-getsu="${x.getsu || 0}" data-tan="${x.tan || 0}"`);
    };
    /* 書いている途中のチケット：4つの欄を横一列。いま選ぶ欄はオレンジの枠 */
    const edT = (x, lab) => {
      const nx = sheet || nextField(), cell = (f, v, ph) => `<button type="button" class="fc${v ? " v" : ""}${nx === f ? " on" : ""}" data-f="${f}"${!canOpen(f) ? " aria-disabled=\"true\"" : ""}>${v || ph}</button>`;
      return `<li class="tkt ed${x.tan && !x.getsu ? " add" : ""}"><div class="tk-r"><div class="st"><b>${lab}</b><i>${en}</i></div><div class="fs">`
        + cell("mode", ed.mode ? ML(ed.mode) : "", `<span class="ph2">対面/<br>オンライン</span>`)
        + cell("day", ed.day ? `${md(T12(ed.day))}<small>${wd(T12(ed.day))}</small>` : "", "日にち")
        + cell("time", ed.t ? `<span class="tc">${hm(ed.t)}<small>${ed.hours}時間</small></span>` : "", "時間")
        + `</div><button type="button" class="tk-x" data-edx aria-label="${ed.orig ? "直すのをやめる" : "このチケットをやめる"}">×</button></div></li>`;
    };
    /* 2026-11-10：終わった回は1回ずつ「済」のチケット（グレー＋済のハンコ）。北川くん */
    const dn = (me.done || []).filter(x => x.m === mo.m).map(x => Object.assign({ zumi: 1 }, x));
    const zumi = (x, lab) => tk("done", lab, `${md(x.s)}（${wd(x.s)}）${hm(x.s)}〜`,
      esc([x.late ? "直前のキャンセル（1回分）" : "", MS(x.mode), x.hours + "時間", x.getsu && x.tan ? `追加${x.tan}回` : ""].filter(Boolean).join("・")), `<span class="tk-zm">済</span>`);
    const out = [];
    let n = 0;
    if (me.base) {
      const both = dn.filter(x => x.getsu).concat(mine.filter(x => x.getsu)).sort((a, b) => a.s - b.s);
      const listed = both.reduce((a, x) => a + (x.getsu || 0), 0), rest = Math.max(0, (mo.used || 0) - listed);
      if (rest) { out.push(tk("done", circ(1, rest), "使用済み", "受けたレッスン（1回分のキャンセルもふくむ）", "")); n = rest; }
      /* 2026-11-10 北川くん：月の回数より先（先月からの繰り越し分）＝ローズ。追加（単発）はもとからオレンジ */
      both.forEach(x => { out.push(x.zumi ? zumi(x, circ(n + 1, n + x.getsu)) : one(x, circ(n + 1, n + x.getsu), n + 1 > me.base ? "on kr" : "on")); n += x.getsu; });
    }
    /* 書いたチケット（申し込み前）と、書いている途中のチケット */
    (sp ? sp.items.filter(x => x.m === mo.m) : []).forEach(x => {
      const lab = labOf(x, n); n += x.getsu; if (!x.ed) labMap[x.t] = lab;
      if (x.ed) { out.push(edT(x, lab)); return; }
      out.push(tk("pre" + (x.getsu ? "" : " add"), lab, `${md(x.t)}（${wd(x.t)}）${hm(x.t)}〜`, `申し込み前・${ML(x.mode)}・${x.hours}時間${x.tan ? `・追加 ${yen(me.single * x.tan)}` : ""}`,
        `<button type="button" class="tk-fix" data-fix="${x.t}">直す</button>`));
    });
    const free = L ? L[tkM].left : 0;
    /* 2026-11-12 北川くん：来月のタブ、今月20日まで「20日までのご予約だと、選べる時間が多めです」 */
    const today = new Date(Date.now() + 9 * 3600000), okDay = me.early || 0;
    if (tkM === 1 && okDay && today.getUTCDate() <= okDay) out.unshift(`<li class="tk-hint">${today.getUTCMonth() + 1}/${okDay} までのご予約だと、選べる時間が多めです</li>`);
    /* 2026-11-10 北川くん：月の回数（月8回なら⑧）より先の「未定」＝先月からの繰り越し分は、見出しをつけてたたむ。未定がぜんぶ繰り越し分のときは、はじめから開いておく（「予約する」が隠れないように） */
    const shown = [], fold = [];
    for (let i = 0; i < free; i++, n++) (me.base && n + 1 > me.base ? fold : shown).push(tk(me.base && n + 1 > me.base ? "free kr" : "free", C(n + 1), "未定", "まだ予約していません", `<button type="button" class="tk-go" data-go>予約する</button>`));
    if (fold.length) out.push(...shown, `<li class="tkfold"><details${(foldOpen == null ? !shown.length : foldOpen) ? " open" : ""}><summary><b>先月からの持ち越し ${fold.length}回</b><span>${carryNote(fold.length, tkM, en)}</span><i><em class="o1">見る</em><em class="o2">とじる</em></i></summary><ol class="sk-tks">${fold.join("")}</ol></details></li>`);
    else out.push(...shown, ...fold);
    dn.filter(x => !x.getsu).forEach(x => out.push(zumi(x, "追加")));
    mine.filter(x => !x.getsu).forEach(x => out.push(one(x, "追加", "add")));
    /* 回数を使い切ったら「追加（単発）」のチケット（書いている途中のチケットがこの月にあるときは出さない） */
    if (!free && !(ed && ed.m === mo.m && !ed.orig))
      out.push(tk("free more", "追加", "追加（単発）", `${me.base ? "回数を使い切ったあと・" : ""}1回 ${yen(me.single)}`, `<button type="button" class="tk-go" data-go>予約する</button>`));
    $("skList").innerHTML = out.join("");
  }
  const T12 = d => new Date(d + "T12:00:00+09:00").getTime();
  /* 2026-11-12：予約は持ち越しの回から先に使うので、月の終わりで消えるのは lost 回だけ（管理ページと同じ言い方） */
  function carryNote(n, i, en){
    const a = me.months[i], b = me.months[i + 1];
    const lost = a && b ? Math.max(0, (a.base || 0) + (a.carry || 0) - (a.used || 0) - (b.carry || 0)) : n;
    if (lost >= n) return `${en}中に使えます`;
    if (!lost) return `使わなかった分は、${b ? monName(b.m) : "来月"}に持ち越せます`;
    return `うち ${lost}回は${en}中に使えます`;
  }

  /* ---------- 申し込む前のところ（下の帯・追加の確認・練習したい曲） ---------- */
  function drawPre(){
    const has = pick.length > 0, s = split();
    document.body.classList.toggle("sk-flow", has || !!ed);   // 書いている間は、大きな見出しを出さない
    $("skPre").hidden = !has; $("skGo").hidden = has || !!ed;
    $("skBar").hidden = !has || !!sheet; document.body.classList.toggle("sk-hasbar", has && !sheet);
    if (!has) return;
    const N = pick.reduce((a, p) => a + p.hours, 0);
    $("ykSend").innerHTML = `<span>${pick.length}日・合計${N}時間</span><b>${N}回分を申し込む</b>`;
    const box = $("skSplit");
    box.hidden = !s.tan;
    if (s.tan) box.innerHTML = `<p><b>${s.tan}回は追加の単発レッスン</b>（1回 ${yen(me.single)}・税込）になります。${me.base ? "月の回数を使い切るためです。" : ""}お支払いは、現金かカード（Square）です。</p>`;
    $("skOkW").hidden = !s.tan;
    if (!s.tan) hideErr($("skOkErr"));
  }
  function draw(){ drawList(); drawPre(); }

  /* ---------- 書きはじめる・直す ---------- */
  function pref(){
    const l = pick[pick.length - 1] || lastPref, last = (me.lessons || []).filter(x => x.state !== "仮").slice(-1)[0];
    if (l) return { mode: l.mode, hours: l.hours };
    if (last && last.hours <= (me.max || 4)) return { mode: last.mode === "オンライン" ? "online" : "studio", hours: last.hours };
    return { mode: "", hours: 0 };
  }
  function startEdit(m, orig){
    if (!orig && pick.length >= maxDays()) { flash(`1回の申し込みで選べるのは ${maxDays()}日までです。いったん申し込んでから、続けて予約してください。`, true); return; }
    const p = orig ? { mode: orig.mode, hours: orig.hours } : pref();
    ed = { m, mode: p.mode, hours: orig ? orig.hours : 0, day: orig ? dayKey(orig.t) : "", t: orig ? orig.t : 0, orig: orig || null };
    tkM = Math.max(0, months().indexOf(m));
    hideErr($("ykErr"));
    draw(); openSheet(nextField() || "day");   // 直すときは日にちから（「この回を取り消す」もここ）
  }
  /* LINE のメニューの「レッスンを予約する」・大きなボタン：一番上の未定のチケットから */
  function startFirst(){
    const L = liveLeft(all()), ms = months();
    const i = L ? Math.max(0, L.findIndex(x => x.left > 0)) : 0;
    startEdit(ms[i] || ms[0]);
  }
  $("skGo").addEventListener("click", startFirst);
  $("skMore").addEventListener("click", startFirst);
  function stopEdit(){ if (ed) lastPref = { mode: ed.mode, hours: ed.hours }; ed = null; closeSheet(); draw(); }

  const filled = f => f === "mode" ? !!ed.mode : f === "hours" ? !!ed.hours : f === "day" ? !!ed.day : !!ed.t;
  const nextField = () => ed ? (FIELDS.find(f => !filled(f)) || "") : "";
  const canOpen = f => !!ed && FIELDS.slice(0, FIELDS.indexOf(f)).every(filled);

  /* ---------- 空いている日にち・時間 ---------- */
  /* 選んだ長さだけ続けて空いている「始まり」の時間。ほかの書いたチケットと重なるものは除く（受け方がちがうときは前後に移動の時間） */
  function starts(){
    const mode = ed.mode, hours = 1, os = others();   // 1時間ずつ（続けるかは時計で）
    const ok = new Set((me.slots || []).filter(s => mode === "online" ? s.on !== 0 : s.st).map(s => s.s));
    return (me.slots || []).filter(s => { for (let i = 0; i < hours; i++) if (!ok.has(s.s + i * H)) return false; return true; })
      .map(s => s.s).filter(t => !os.some(p => { const g = p.mode === mode ? 0 : MOVE; return t < p.t + p.hours * H + g && p.t < t + hours * H + g; }));
  }
  function byDay(){ const by = {}; starts().filter(t => monKey(t) === ed.m).forEach(t => { (by[dayKey(t)] = by[dayKey(t)] || []).push(t); }); return by; }
  /* 前の欄を変えたら、合わなくなった日にち・時間だけ空に戻す */
  function fix(){
    const by = byDay();
    if (ed.day && !by[ed.day]) { ed.day = ""; ed.t = 0; ed.hours = 0; }
    if (ed.t) { const ok = new Set(by[ed.day] || []); for (let i = 0; i < ed.hours; i++) if (!ok.has(ed.t + i * H)) { ed.t = 0; ed.hours = 0; break; } }
  }

  /* ---------- 下から出る選ぶところ（シート） ---------- */
  const sh = $("skSh"), shC = $("skShC");
  /* 2026-11-10：どの欄も「決定」を押すまで決まらない（北川くん）。押した選択肢は pend に入れておく */
  let pend = null;
  const V = f => pend && pend.f === f ? pend.v : f === "time" ? ed.t : ed[f];
  /* 時計（SVG）。12等分＝1時間ずつ。2026-11-10：押すと塗る・もう一度押すと消す・となりを押すとのびる・なぞると続けて塗れる（北川くん） */
  const CK = { c: 150, R1: 74, R2: 138, P: Math.PI };
  CK.RM = (CK.R1 + CK.R2) / 2;
  const ckAng = h => (h % 12) / 12 * 2 * CK.P - CK.P / 2, ckPt = (a, r) => `${(CK.c + r * Math.cos(a)).toFixed(2)} ${(CK.c + r * Math.sin(a)).toFixed(2)}`;
  const ckArc = (h0, n) => { const a0 = ckAng(h0) + .02, a1 = ckAng(h0) + n * 2 * CK.P / 12 - .02; return `M${ckPt(a0, CK.RM)}A${CK.RM} ${CK.RM} 0 ${n > 6 ? 1 : 0} 1 ${ckPt(a1, CK.RM)}`; };
  const selT = () => pend && pend.f === "time" ? pend.v : ed.t, selH = () => pend && pend.f === "time" ? pend.h : ed.hours;
  function clock(d0, ts, os){
    const { c, R1, R2, RM, P } = CK, day0 = d0 - 12 * H, set = new Set(ts);
    const sec = h => { const a0 = ckAng(h) + .012, a1 = ckAng(h) + 2 * P / 12 - .012;
      return `M${ckPt(a0, R2)}A${R2} ${R2} 0 0 1 ${ckPt(a1, R2)}L${ckPt(a1, R1)}A${R1} ${R1} 0 0 0 ${ckPt(a0, R1)}Z`; };
    let g = "";
    for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * P - P / 2, big = i % 5 === 0; g += `<line class="tk${big ? " b" : ""}" x1="${(c + (big ? 141 : 143) * Math.cos(a)).toFixed(2)}" y1="${(c + (big ? 141 : 143) * Math.sin(a)).toFixed(2)}" x2="${(c + 147 * Math.cos(a)).toFixed(2)}" y2="${(c + 147 * Math.sin(a)).toFixed(2)}"/>`; }
    for (let h = 12; h < 24; h++) { const t = day0 + h * H, dn = os.some(p => p.t <= t && t < p.t + p.hours * H), av = set.has(t);
      g += `<path class="sc${av ? " av" : dn ? " dn" : ""}" d="${sec(h)}"${av ? ` data-t="${t}" role="button" tabindex="0" aria-label="${h}時から"` : ""}/>`; }
    os.forEach(p => { g += `<path class="ow" d="${ckArc((p.t - day0) / H, p.hours)}"/>`; });
    g += `<path class="fl" pathLength="100" d=""/>`;
    for (let h = 12; h < 24; h++) { const t = day0 + h * H, a = ckAng(h) + P / 12;
      g += `<text class="hn${set.has(t) ? " av" : ""}" data-t="${t}" x="${(c + RM * Math.cos(a)).toFixed(2)}" y="${(c + RM * Math.sin(a)).toFixed(2)}">${h}<tspan class="tl">〜</tspan></text>`; }   // 「16〜」（北川くん）
    return `<div class="sh-clock"><svg viewBox="0 0 300 300" aria-label="時計" data-d0="${day0}">${g}<circle class="ci" cx="${c}" cy="${c}" r="${R1 - 8}"/>`
      + `<text class="c1" x="${c}" y="${c - 14}"></text><text class="c2" x="${c}" y="${c + 12}"></text><text class="c3 c3a" x="${c}" y="${c + 34}"></text></svg></div>`
      + `<p class="sh-leg"><span class="la">空いている時間</span><span class="lf">選んだ時間</span>${os.length ? `<span class="lw">書いた回</span>` : ""}</p>`;
  }
  /* 塗るところ・真ん中の文字・決定ボタンを、作り直さずに書きかえる（なぞっている間も切れないように） */
  function paintClock(first){
    const svg = shC.querySelector(".sh-clock svg"), t = selT(), n = selH();
    if (svg) {
      const day0 = +svg.dataset.d0, fl = svg.querySelector(".fl");
      fl.setAttribute("d", t && n ? ckArc((t - day0) / H, n) : "");
      if (!first) fl.classList.add("still");
      svg.querySelectorAll("text.hn").forEach(x => { const v = +x.dataset.t; x.classList.toggle("on", !!t && v >= t && v < t + n * H); });
      const [c1, c2, c3] = ["c1", "c2", "c3a"].map(k => svg.querySelector("." + k));
      if (t && n) { c1.textContent = hm(t); c2.textContent = "〜" + hm(t + n * H); c3.textContent = `${n}時間`; }
      else { c1.textContent = ""; c2.textContent = ""; c3.textContent = "押す・なぞる"; }
    } else shC.querySelectorAll(".sh-t[data-t]").forEach(x => { const v = +x.dataset.t; x.classList.toggle("on", !!t && v >= t && v < t + n * H); });
    const ok = shC.querySelector(".sh-ok");
    if (ok) { ok.disabled = !(t && n); ok.innerHTML = t && n ? `<span>${hm(t)}〜${hm(t + n * H)}</span>（${n}時間）で決定` : "時間を選んでください"; }
    drawList();
  }
  function setSel(t, n){ pend = { f: "time", v: n > 0 ? t : 0, h: n > 0 ? n : 0 }; paintClock(); }
  const okHours = () => new Set(byDay()[ed.day] || []), maxH = () => me.max || 4;
  /* 押したとき：空いていれば塗る／塗ったはしなら消す／となりならのばす／離れていれば選び直し */
  function tapHour(t){
    let s0 = selT(), n = selH(); const mx = maxH();
    if (!s0 || !n) { s0 = t; n = 1; }
    else if (t >= s0 && t < s0 + n * H) {
      if (t === s0 + (n - 1) * H) n--; else if (t === s0) { s0 += H; n--; } else n = (t - s0) / H;   // まん中なら、そこから後ろを消す
    }
    else if (t === s0 + n * H) { if (n < mx) n++; else return bump(); }
    else if (t === s0 - H) { if (n < mx) { s0 = t; n++; } else return bump(); }
    else { s0 = t; n = 1; }
    setSel(s0, n);
  }
  function bump(){ const el = shC.querySelector(".sh-clock"); if (el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } flash(`続けて選べるのは ${maxH()}時間までです`, true); }
  /* なぞる：押したところから、指のあるところまで（空いていない時間・上限の手前まで） */
  let drag = null;
  shC.addEventListener("pointerdown", e => {
    const sc = e.target.closest(".sh-clock .sc.av"); if (!sc || sheet !== "time") return;
    drag = { a: +sc.dataset.t, moved: false, id: e.pointerId };
    try { e.target.closest("svg").setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  shC.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const u = document.elementFromPoint(e.clientX, e.clientY), sc = u && u.closest && u.closest(".sh-clock .sc.av");
    if (!sc) return;
    const b = +sc.dataset.t; if (b === drag.a && !drag.moved) return;
    drag.moved = true;
    const ok = okHours(), dir = b >= drag.a ? 1 : -1; let end = drag.a;
    while (end !== b && ok.has(end + dir * H) && Math.abs(end + dir * H - drag.a) / H < maxH()) end += dir * H;
    setSel(Math.min(drag.a, end), Math.abs(end - drag.a) / H + 1);
  });
  const dragEnd = e => { if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (!d.moved && e.type === "pointerup") tapHour(d.a); };
  shC.addEventListener("pointerup", dragEnd); shC.addEventListener("pointercancel", dragEnd);
  /* 2026-11-10：時計を指でなぞると、LINE のブラウザごと下に引っぱられたり、シートがスクロールしたりしていた（北川くんの iPhone 8 の動画）。
     時計に触れているあいだは、画面のスクロール・引っぱりを止める（古い Safari は touch-action だけでは止まらない） */
  const holdTouch = e => { if (sheet === "time" && e.target.closest && e.target.closest(".sh-clock svg")) e.preventDefault(); };
  shC.addEventListener("touchstart", holdTouch, { passive: false });
  shC.addEventListener("touchmove", holdTouch, { passive: false });
  /* 2026-11-10：LINE から開いたとき、下から出る面の上で下に指をすべらせると、LINE の画面ごと閉じてトークに戻っていた（弟さん）。
     面の上では LINE を閉じさせない。面がいちばん上までスクロールしているときに下へ引っぱると、面が下がって、離すと閉じる */
  const pnl = sh.querySelector(".sk-shp");
  let pull = null;
  sh.addEventListener("touchstart", e => {
    if (!sheet || e.touches.length !== 1) { pull = null; return; }
    pull = { y: e.touches[0].clientY, x: e.touches[0].clientX, onP: pnl.contains(e.target), dy: 0, on: false };
  }, { passive: true });
  sh.addEventListener("touchmove", e => {
    if (!pull || !sheet || e.touches.length !== 1) return;
    if (e.target.closest && e.target.closest(".sh-clock svg")) return;   // 時計は holdTouch で止めている
    const dy = e.touches[0].clientY - pull.y, dx = e.touches[0].clientX - pull.x;
    if (!pull.onP) { if (dy > 0 && (window.scrollY || 0) <= 0) e.preventDefault(); return; }   // 暗いところ：ページがいちばん上なら LINE を閉じさせない
    if (!pull.on) {
      if (dy > 0 && pnl.scrollTop <= 0) e.preventDefault(); else return;   // 面のいちばん上で下へ：LINE を閉じさせない
      if (dy > 8 && Math.abs(dy) > Math.abs(dx)) pull.on = true; else return;
    }
    e.preventDefault();
    pull.dy = Math.max(0, dy - 8);
    pnl.style.transition = "none"; pnl.style.transform = "translateY(" + pull.dy + "px)";
  }, { passive: false });
  const pullEnd = () => {
    if (!pull) return; const p = pull; pull = null; if (!p.on) return;
    pnl.style.transition = "";
    if (p.dy > 80) { pnl.style.transform = "translateY(105%)"; closeSheet(); setTimeout(() => { pnl.style.transform = ""; }, 260); }
    else pnl.style.transform = "";
  };
  sh.addEventListener("touchend", pullEnd); sh.addEventListener("touchcancel", pullEnd);
  function shContent(f){
    $("skShT").textContent = FT[f];
    let h = "";
    if (f === "mode") h = `<div class="sh-mo">`
      + `<button type="button" class="${V("mode") === "studio" ? "on" : ""}" data-v="studio"><b>対面<em>小岩のスタジオ</em></b><small>スタジオ代 1時間 約1,500円（当日）。お部屋は前の日に北川が予約します</small></button>`
      + `<button type="button" class="${V("mode") === "online" ? "on" : ""}" data-v="online"><b>オンライン<em>Google Meet</em></b><small>スタジオ代なし</small></button></div>`;
    else if (f === "day") {
      /* 2026-11-10：カレンダーをおしゃれに（空いている日は枠の数を点で・今日は輪・書いた日は小さな札・選んだ日はオレンジ） */
      const by = byDay(), m = ed.m, y = +m.slice(0, 4), mo = +m.slice(5, 7), dn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const w0 = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(), mark = new Set(others().map(p => dayKey(p.t))), today = dayKey(Date.now()), nd = Object.keys(by).length;
      let cells = W.map((w, i) => `<span class="wk w${i}">${w}</span>`).join("") + "<span class=\"pad\"></span>".repeat(w0);
      for (let d = 1; d <= dn; d++) { const k = `${m}-${String(d).padStart(2, "0")}`, w = (w0 + d - 1) % 7, c = (by[k] || []).length, cl = `w${w}${k === today ? " td" : ""}`;
        cells += c ? `<button type="button" class="${cl}${V("day") === k ? " on" : ""}${mark.has(k) ? " mk" : ""}" data-v="${k}" aria-label="${mo}月${d}日 ${c}枠"><b>${d}</b><i>${"<s></s>".repeat(Math.min(c, 4))}</i></button>`
                   : `<span class="no ${cl}"><b>${d}</b></span>`; }
      h = `<div class="sh-cap"><p class="sh-mon"><b>${mo}</b>月</p><p class="sh-sub">${ML(ed.mode)}<br>空いている日 <em>${nd}</em>日</p></div><div class="sh-cal">${cells}</div>`
        + `<p class="sh-leg"><span><s></s>空いている枠</span><span class="lt">今日</span>${mark.size ? `<span class="lm">書いた日</span>` : ""}</p>`
        + (nd ? "" : `<p class="sh-none">${monName(m)}は、空いている日がありません。${ed.mode === "studio" ? "オンラインにするか、" : ""}${tkM === 0 && months()[1] ? "来月のチケットから選ぶか、" : ""}北川にご相談ください。</p>`);
    } else {
      /* 時間：昼・夕方・夜に分けて、3列のカードで */
      const ts = byDay()[ed.day] || [], os = others().filter(p => dayKey(p.t) === ed.day), hr = t => J(t).getUTCHours();
      const list = ts.map(t => ({ t })).concat(os.map(p => ({ t: p.t, p }))).sort((a, b) => a.t - b.t);
      const parts = [["昼", 0, 16], ["夕方", 16, 18], ["夜", 18, 24]].map(([n, a, b]) => [n, list.filter(x => hr(x.t) >= a && hr(x.t) < b)]).filter(x => x[1].length);
      const d0 = T12(ed.day), cap = `<div class="sh-cap"><p class="sh-mon"><b>${md(d0)}</b><small>（${wd(d0)}）</small></p><p class="sh-sub">${ML(ed.mode)}<br>押す・なぞると塗れます<br>続けて${maxH()}時間まで</p></div>`;
      /* 2026-11-10：時計を塗りつぶす形（北川くんの案）。昼12時〜夜24時を1周に。押したところから、レッスンの長さの分がオレンジで塗られる。
         朝（12時より前）の枠がある日は、前の3列のボタンにする */
      if (list.every(x => hr(x.t) >= 12)) h = cap + clock(d0, ts, os);
      else h = cap + parts.map(([n, xs]) => `<div class="sh-tg"><p class="sh-tl">${n}</p><div class="sh-ts">` + xs.map(x => x.p
            ? `<span class="sh-t dn"><b>${hm(x.t)}</b><small>書いた回</small></span>`
            : `<button type="button" class="sh-t" data-t="${x.t}"><b>${hm(x.t)}</b><small>〜${hm(x.t + H)}</small></button>`).join("") + `</div></div>`).join("");
    }
    const v = V(f), lab = !v ? "" : f === "mode" ? ML(v) : f === "day" ? `${md(T12(v))}（${wd(T12(v))}）` : "";
    /* 2026-11-10：「この回を取り消す」は決定ボタンの下（同じ枠の中）に。前は下に残るボタンの裏にかくれていた（北川くんの iPhone 8） */
    h += `<div class="sh-okw"><button type="button" class="btn or sh-ok" data-ok${v ? "" : " disabled"}>${v ? `<span>${lab}</span>で決定` : "選んでください"}</button>`
      + (ed.orig ? `<button type="button" class="sh-rm" data-rmd>この回を取り消す</button>` : "") + `</div>`;
    shC.innerHTML = h;
    if (f === "time") paintClock(true);
  }
  let shTimer = 0;
  function openSheet(f){
    if (!ed) return;
    if (!f) { draw(); return; }
    if (!canOpen(f)) f = nextField();
    if (sheet === f) return;
    const was = !!sheet; sheet = f; pend = null;
    clearTimeout(shTimer);
    if (!was) { if (!(history.state && history.state.sh)) history.pushState({ sh: 1 }, ""); shContent(f); sh.hidden = false; void sh.offsetWidth; sh.classList.add("open"); draw(); place(); return; }
    /* 選んだら、いったん閉じて次の欄へ */
    sh.classList.remove("open"); draw();
    shTimer = setTimeout(() => { shContent(f); sh.classList.add("open"); place(); }, 200);
  }
  function closeSheet(viaPop){
    if (!sheet) return;
    if (!viaPop && history.state && history.state.sh) { history.back(); return; }   // スマホの「戻る」と同じ（popstate でここに戻る）
    sheet = ""; pend = null; clearTimeout(shTimer); sh.classList.remove("open"); document.body.style.paddingBottom = "";
    shTimer = setTimeout(() => { sh.hidden = true; }, 220);
    draw();
  }
  addEventListener("popstate", () => { if (sheet) closeSheet(true); });
  /* 書いているチケットが、シートの上に見えるように */
  function place(){
    requestAnimationFrame(() => {
      const el = document.querySelector(".tkt.ed"), pn = sh.querySelector(".sk-shp"); if (!el || !pn) return;
      document.body.style.paddingBottom = pn.offsetHeight + "px";
      const r = el.getBoundingClientRect(), room = innerHeight - pn.offsetHeight, head = (document.querySelector(".hd") || {}).offsetHeight || 60;
      if (r.bottom > room - 8 || r.top < head) window.scrollBy({ top: r.top - Math.max(head + 8, room - r.height - 20), behavior: "smooth" });
    });
  }
  sh.addEventListener("click", e => {
    /* 暗いところを押したとき：その下がチケットの欄なら、その欄を開く（シートを開いたままほかの欄を直せる）。ほかは閉じる */
    if (e.target.classList.contains("sk-shb")) {
      sh.style.visibility = "hidden"; const u = document.elementFromPoint(e.clientX, e.clientY); sh.style.visibility = "";
      const fc = u && u.closest(".tkt.ed [data-f]");
      if (fc) { openSheet(canOpen(fc.dataset.f) ? fc.dataset.f : nextField()); return; }
      if (u && u.closest(".tkt.ed [data-edx]")) { stopEdit(); return; }
    }
    if (e.target.closest("[data-shx]")) { closeSheet(); return; }
    if (e.target.closest("[data-rmd]")) { const o = ed.orig; pick = pick.filter(p => p !== o); ed = null; closeSheet(); draw(); flash("取り消しました"); return; }
    if (sheet === "cx") { cxClick(e); return; }
    /* 「決定」：選んだものを書いて、次の欄へ（4つそろったら申し込み前のチケットに） */
    if (e.target.closest("[data-ok]")) {
      if (!ed || !V(sheet)) return;
      if (pend) { const v = pend.v;
        if (sheet === "mode") { ed.mode = v; fix(); }
        else if (sheet === "day") { if (ed.day !== v) { ed.t = 0; ed.hours = 0; } ed.day = v; }
        else { ed.t = v; ed.hours = pend.h; } }
      pend = null; afterPick(); return;
    }
    if (sheet === "time") { const b = e.target.closest(".sh-t[data-t]"); if (b && ed) tapHour(+b.dataset.t); return; }   // 時計は pointer で（ここでは何もしない）
    const b = e.target.closest("[data-v]"); if (!b || !ed) return;
    const v = b.dataset.v;
    pend = { f: sheet, v };
    const pn = sh.querySelector(".sk-shp"), top = pn.scrollTop; shContent(sheet); pn.scrollTop = top;   // 押したものに印（時計は塗られる）
  });
  sh.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".sc[data-t]")) { e.preventDefault(); tapHour(+e.target.dataset.t); } });
  function afterPick(ms){
    const nx = nextField();
    if (nx) { setTimeout(() => openSheet(nx), ms || 140); return; }
    setTimeout(commit, ms || 140);
  }
  /* 4つ書けたら「申し込み前」のチケットに */
  function commit(){
    if (!ed || nextField()) return;
    const p = { t: ed.t, mode: ed.mode, hours: ed.hours };
    pick = others().concat(p).sort((a, b) => a.t - b.t);
    lastPref = { mode: p.mode, hours: p.hours };
    const was = ed.orig; ed = null; closeSheet(); draw();
    flash(`✓ ${md(p.t)}（${wd(p.t)}）${hm(p.t)}〜${hm(p.t + p.hours * H)}（${ML(p.mode)}）を${was ? "直しました" : "書きました"}`);
  }
  function flash(msg, err){
    document.querySelectorAll(".sk-me>.sk-flash").forEach(x => x.remove());
    const fl = document.createElement("p"); fl.className = "sk-flash" + (err ? " sk-ferr" : ""); fl.textContent = msg;
    $("skTk").before(fl); setTimeout(() => fl.remove(), err ? 5000 : 2600);
  }

  /* ---------- チケットを押したとき ---------- */
  $("skList").addEventListener("toggle", e => { if (e.target.closest && e.target.closest(".tkfold")) foldOpen = e.target.open; }, true);
  $("skTabs").addEventListener("click", e => { const b = e.target.closest("[data-tm]"); if (!b) return; tkM = Number(b.dataset.tm); drawList(); });
  $("skList").addEventListener("click", e => {
    if (e.target.closest("[data-go]")) { startEdit(months()[tkM]); return; }   // 未定のチケットの「予約する」
    const fc = e.target.closest("[data-f]"); if (fc) { openSheet(canOpen(fc.dataset.f) ? fc.dataset.f : nextField()); return; }
    if (e.target.closest("[data-edx]")) { stopEdit(); return; }
    const fx = e.target.closest("[data-fix]"); if (fx) { const o = pick.find(p => p.t === Number(fx.dataset.fix)); if (o) startEdit(monKey(o.t), o); return; }
    const li = e.target.closest("li[data-id]"); if (li && e.target.closest("[data-cx]")) cxOpen(li);
  });

  /* ---------- キャンセル：チケットの大きさは変えず、下から出るところで確かめる（2026-11-10 北川くん：カードが伸びてはみ出す） ---------- */
  let cxLi = null;
  function cxOpen(li){
    if (ed) { ed = null; }
    cxLi = li;
    const free = li.dataset.free === "1", g = +li.dataset.getsu, t = +li.dataset.tan;
    const freeMsg = !g ? "無料でキャンセルできます。追加（単発）の回なので、お支払いはありません。"
      : t ? `無料でキャンセルできます。月謝の${g}回分は、次の月まで使えます（追加（単発）の${t}回分は、お支払いはありません）。`
      : "無料でキャンセルできます。この回は、次の月まで使えます。";
    const r = li.querySelector(".tk-r").cloneNode(true); r.querySelector(".ac").remove();
    $("skShT").textContent = "このレッスンをキャンセルしますか？";
    shC.innerHTML = `<ol class="sk-tks sh-cxt"><li class="${esc(li.className)}">${r.outerHTML}</li></ol>`
      + `<p class="sh-cxm">${li.dataset.state === "仮" ? "このお申し込みを取り消します（回数は減りません）。" : free ? freeMsg : "<b>3日前を過ぎているので、レッスン1回分として扱います。</b>"}</p>`
      + `<div class="sh-cxb"><button type="button" class="btn line" data-no>やめる</button><button type="button" class="btn or" data-yes>キャンセルする</button></div><p class="err" hidden></p>`;
    sheet = "cx"; pend = null;
    if (!(history.state && history.state.sh)) history.pushState({ sh: 1 }, "");
    clearTimeout(shTimer); sh.hidden = false; void sh.offsetWidth; sh.classList.add("open"); draw();
  }
  function cxClick(e){
    if (e.target.closest("[data-no]")) { closeSheet(); return; }
    const yes = e.target.closest("[data-yes]"); if (!yes || !cxLi) return;
    yes.disabled = true; yes.textContent = "送っています…";
    const p = demo ? new Promise(r => setTimeout(() => r({ ok: true, msg: "キャンセルしました（見本なので、実際には送っていません）。" }), 500))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify({ a: "lcancel", k: key, id: cxLi.dataset.id }) }).then(r => r.json());
    p.then(r => {
      if (!r.ok) throw r;
      shC.innerHTML = `<p class="sk-done sh-cxm">${esc(r.msg)}</p><div class="sh-cxb"><button type="button" class="btn line" data-no>閉じる</button></div>`;
      if (!demo) setTimeout(load, 800);
    }).catch(r => { const er = shC.querySelector(".err"); if (!er) return; er.textContent = (r && r.msg) || "うまくいきませんでした。もう一度お試しください。"; er.hidden = false; yes.disabled = false; yes.textContent = "キャンセルする"; });
  }

  function showErr(el, msg){ el.textContent = msg; el.hidden = false; }
  function hideErr(el){ if (el) el.hidden = true; }

  /* ---------- 送る ---------- */
  /* 日付の早い順に、受け方と長さが同じ続きごとにまとめて送る（サーバーは1回の申し込みを早い日から数えるので、数え方が同じになる） */
  function runs(){
    const out = [];
    byT().forEach(p => { const l = out[out.length - 1]; if (l && l.mode === p.mode && l.hours === p.hours) l.slots.push(p.t); else out.push({ mode: p.mode, hours: p.hours, slots: [p.t] }); });
    return out;
  }
  $("ykSend").addEventListener("click", () => {
    if (!pick.length) return;
    const s = split();
    if (s.tan && !$("skOk").checked) { showErr($("skOkErr"), "追加（単発）になる分があります。よろしければ、チェックを入れてください。"); $("skOkW").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    hideErr($("skOkErr"));
    const btn = $("ykSend"), err = $("ykErr"), rs = runs(), done = [], keep = btn.innerHTML;
    const keepTk = tkM; doneLab = {}; months().forEach((m, i) => { tkM = i; drawList(); Object.assign(doneLab, labMap); }); tkM = keepTk; drawList();
    btn.disabled = true; btn.textContent = "送っています…"; hideErr(err);
    const one = g => demo
      ? new Promise(r => setTimeout(() => { const xs = s.items.filter(x => g.slots.includes(x.t)); r({ ok: true, mode: g.mode, getsu: xs.reduce((a, x) => a + x.getsu, 0), tan: xs.reduce((a, x) => a + x.tan, 0), items: xs.map(x => ({ s: x.t, getsu: x.getsu, tan: x.tan })) }); }, 400))
      : fetch(cfg.api, { method: "POST", body: JSON.stringify({ a: "lesson", k: key, mode: g.mode, hours: g.hours, slots: g.slots, msg: $("y_q").value, okSingle: $("skOk").checked }) }).then(r => r.json());
    (async () => {
      for (const g of rs) {
        let r;
        try { r = await one(g); } catch (_) { r = { ok: false, msg: "送信できませんでした。通信の状態を確かめて、もう一度お試しください。" }; }
        if (!r.ok) {
          if (done.length) { finish(done, r.msg || "送信できませんでした。"); return; }   // 途中まで決まったときは、決まった分を見せる
          showErr(err, r.msg || "送信できませんでした。"); err.scrollIntoView({ behavior: "smooth", block: "center" });
          if (r.needOk) { $("skOkW").hidden = false; }
          if (r.gone) { pick = []; load(); }
          return;
        }
        done.push(Object.assign({}, r, { mode: g.mode, hours: g.hours }));
      }
      finish(done);
    })().finally(() => { btn.disabled = false; if (btn.textContent === "送っています…") btn.innerHTML = keep; });
  });

  let doneLab = {};
  function finish(rs, fail){
    const el = $("ykDone");
    const items = [].concat(...rs.map(r => (r.items || []).map(x => Object.assign({ mode: r.mode, hours: r.hours }, x)))).sort((a, b) => a.s - b.s);
    const sum = k => rs.reduce((a, r) => a + (r[k] || 0), 0), line = rs.some(r => r.line);
    /* 2026-11-10：確定したレッスンもチケットで（北川くん） */
    const list = items.map((x, i) => { const lab = doneLab[x.s] || (x.getsu ? "確定" : "追加");
      return `<li class="tkt on${lab === "追加" ? " add" : ""}" style="--i:${i}"><div class="tk-r"><div class="st"><b>${lab}</b><i>${monName(monKey(x.s))}</i></div><div class="bd"><b>${md(x.s)}（${wd(x.s)}）${hm(x.s)}〜</b><small>${ML(x.mode)}・${x.hours}時間</small></div><div class="ac"><span class="tk-ok">確定</span></div></div></li>`; }).join("");
    const parts = [sum("getsu") ? `月謝 ${sum("getsu")}回分` : "", sum("tan") ? `追加（単発）${sum("tan")}回` : ""].filter(Boolean).join("＋");
    const st = items.some(x => x.mode === "studio"), on = items.some(x => x.mode === "online"), via = line ? "LINE" : "メール";
    const left = fail ? pick.filter(p => !items.some(x => x.s === p.t)) : [];
    el.innerHTML = `<span class="chip gr">CONFIRMED</span><h3>予約が確定しました（${items.length}日）</h3>`
      + `<p>確定のお知らせを${via}でお送りしました${rs.length > 1 ? `（対面/オンライン・長さごとに${rs.length}通）` : ""}。`
      + (st ? `<b>スタジオのお部屋は、レッスンの前の日に北川が予約</b>して、場所を${via}でお知らせします。` : "")
      + (on ? `オンラインの入り口（Google Meet のリンク）も、${via}でお送りしています。` : "") + `</p>`
      + `<ol class="sk-tks sk-dtk">${list}</ol><p class="small">${parts}${demo ? "<br>（これは見本です。実際には送っていません）" : ""}</p>`
      + (left.length ? `<p class="err">${esc(fail)}<br>次の日時は、まだ予約できていません：${left.map(p => esc(span(p.t, p.hours))).join("、")}</p>` : "")
      + `<button type="button" class="btn line" id="skAgain">予約のページに戻る</button>`;
    $("skHome").hidden = true; $("skNotes").hidden = true; $("skBar").hidden = true; el.hidden = false; pick = []; ed = null;
    document.body.classList.remove("sk-flow", "sk-hasbar"); history.replaceState({ sk: 0 }, "");
    el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true });
    $("skAgain").addEventListener("click", () => {
      $("y_q").value = ""; $("skOk").checked = false; el.hidden = true; $("skHome").hidden = false; $("skNotes").hidden = false;
      if (demo) draw(); else load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  load();
})();
