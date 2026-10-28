/* ============================================================
   render.mjs — data/*.json ＋ src/template.html → index.html の中身
   入出力を持たない（読み書きは build.mjs / tools/build.jsc.mjs がやる）。
   ページの文章・カードはすべてここで組み立てて、静的な HTML として書き出す。
   ボタンの動き（絞り込み・メニュー・フォーム送信など）は assets/js/main.js。
   ============================================================ */
export const ROOT_FILES = ["src/template.html","data/voices.json","data/profile.json","data/credits.json","data/live.json","data/media.json","data/site.json","data/images.json","assets/css/kk-design-system.css","assets/css/site.css","assets/js/main.js","assets/js/yoyaku.js","assets/js/seito.js","src/ill/guitar.svg","src/ill/compose.svg","src/ill/lesson.svg"];
const ASSETS = ["assets/css/kk-design-system.css","assets/css/site.css","assets/js/main.js"];
/* 中身から短い印をつくる（CSS・JSを直したら、見る人のブラウザに古いものが残らないよう ?v= を変える） */
const stamp = t => { let h = 5381; for(let i=0;i<t.length;i++) h = ((h<<5) + h + t.charCodeAt(i)) >>> 0; return h.toString(36); };

/* 2026-10-28：ことばの途中で改行しない（北川くん「iPhone で改行が変」）。
   Chrome は CSS（word-break:auto-phrase）で文節ごとに折り返せるが、iPhone の Safari はできない。
   そこで書き出すときに、文節の切れ目に <wbr>（ここなら改行してよい印）を入れ、CSS で word-break:keep-all にする。
   文節の切り方：Intl.Segmenter（Node 標準）で単語に分けて、助詞・送りがな（ひらがな）や 」）、。・ は前の語にくっつける。
   漢字・カタカナ・数字・英字が続くところ（体験レッスン、60分 など）は切らない */
const JA_SEG = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ja", {granularity: "word"}) : null;
const RE_JA = /[぀-ヿ㐀-鿿]/;
const RE_HIRA = /^[぀-ゟ]/;
const RE_WORD = /[゠-ヿ㐀-鿿A-Za-z0-9０-９Ａ-ｚ]/;   // カタカナ・漢字・英数字
const OPEN = "「『（(［[【〈《“‘¥￥#＃";
const AFTER = "、。，．・」』）)］]】〉》”’！？!?：…〜～";   // この字のあとは切ってよい
function jaPhrases(text){
  if(!JA_SEG || !RE_JA.test(text)) return text;
  /* 短い英語の名前（Jams Collection・Bunny La Crew など、3語・18字まで）と「CDTV 出演」のような 英語＋空白＋日本語 は、空白で改行しない */
  text = text.replace(/(?<![A-Za-z0-9.'!?-]|[A-Za-z0-9.'!?-] )[A-Za-z0-9][A-Za-z0-9.'!?-]*(?: [A-Za-z0-9][A-Za-z0-9.'!?-]*){1,2}(?![A-Za-z0-9.'!?-]| [A-Za-z0-9])/g, m => m.length <= 18 ? m.replace(/ /g, "\u00a0") : m)
             .replace(/(?<![A-Za-z0-9 .'-])([A-Za-z0-9][A-Za-z0-9.'-]{0,7}) (?=[\u3040-\u30ff\u3400-\u9fff])/g, "$1\u00a0");
  let out = "", prev = "", q = 0;   // q＝「」『』の中（中では切らない）
  for(const {segment: w} of JA_SEG.segment(text)){
    if(prev && !q && !/\s$/.test(prev) && !/^\s/.test(w)){
      const a = prev.slice(-1), b = w[0];
      let brk;
      if(OPEN.includes(a) || AFTER.includes(b) || "〜～".includes(a)) brk = false;   // 「 のすぐあと・」、。 の前・〜 のあとでは切らない
      else if("おご".includes(b) && (w.length === 1 || RE_WORD.test(w[1]))) brk = true;   // お送り・ご提案 などの「お・ご」の前は切ってよい
      else if(RE_HIRA.test(b)) brk = "、。，．・！？!?…".includes(a);                  // ひらがな（助詞・送りがな）は前にくっつける。、。」 のあとだけ切る
      else if(OPEN.includes(b)) brk = true;                               // 「 の前は切ってよい
      else if(/[!-~]/.test(a) && /[A-Za-z0-9]/.test(b) || "ごお".includes(a)) brk = false;   // 23:59・ご連絡 などは切らない
      else if(RE_WORD.test(b)) brk = !RE_WORD.test(a) || a === "・";                   // 漢字・カタカナ・英数字が続くところ（体験レッスン・60分）は切らない
      else brk = false;
      if(brk) out += "<wbr>";
    }
    for(const ch of w){ if("「『".includes(ch)) q++; else if("」』".includes(ch) && q) q--; }
    out += w; prev = w;
  }
  return out.replace(/\d+(?:-\d+){1,3}/g, m => `<span class="nb">${m}</span>`);   // 住所の番地（1-27-16）は途中で切らない
}
/* HTML の文字の部分だけに入れる（script・style・svg・option・textarea・title の中と、タグの属性には入れない） */
function addWbr(html){
  const i = html.indexOf("<body"); if(i < 0) return html;
  const head = html.slice(0, i), body = html.slice(i);
  const SKIP = /^(script|style|svg|option|textarea|title|noscript|select)$/i;
  let skip = 0, res = "";
  for(const part of body.split(/(<[^>]*>)/)){
    if(part.startsWith("<")){
      const m = part.match(/^<(\/?)([a-zA-Z0-9-]+)/);
      if(m && SKIP.test(m[2]) && !part.endsWith("/>")) skip += m[1] ? -1 : 1;
      if(skip < 0) skip = 0;
      res += part;
    } else res += skip ? part : jaPhrases(part);
  }
  return head + res;
}

export function buildOutputs(files){
  const J = k => JSON.parse(files[k]);
  const p = J("data/profile.json"), site = J("data/site.json"), images = J("data/images.json");
  const pick = (o, ks) => Object.fromEntries(ks.map(k => [k, o[k] ?? null]));
  const D = {
    profile: pick(p, ["name","nameEn","bio","career","gear","work","lesson","links","canDo"]),
    credits: J("data/credits.json").map(c => { const d = pick(c, ["title","artist","category","roles","year","jacket","spotify","spotifyRank","album"]);
      return c.category === "karaoke" ? Object.assign(d, {title:"非公開", artist:"有名歌い手"}) : d; }),   // カラオケは作品名を出さない
    live: J("data/live.json").map(x => pick(x, ["title","year","venue","artist","role"])),
    media: J("data/media.json").map(x => { const d = pick(x, ["title","year","artist","role","type"]); if(String(d.role).includes("要確認")) d.role = ""; return d; }),
    voices: (J("data/voices.json").items||[]).filter(v => v && v.text), lessonPlans: site.lessonPlans, lessonStats: site.lessonStats, yoyaku: !!(site.booking||{}).api, lineAdd: (site.booking||{}).lineAdd||"", booking: (site.booking||{}).url||"", bookingEmbed: (site.booking||{}).embed||(site.booking||{}).url||"", video: site.video||{}, trialProof: (site.trialProof||{}).text||"", news: ((site.news||{}).items||[]).filter(n=>n&&n.text).slice(0,3), timeline: site.timeline, liveYears: site.liveYears
  };
  const IMG = images.paths, ICON = site.icons;
  const warnings = [];

  const P = D.profile, C = D.credits;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  /* 仕事の依頼「できること」のアイコン（線だけの絵。色はカードごとに CSS で） */
  const WI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const WICON = {
    pen: WI('<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M14 7l3 3"/>'),
    mix: WI('<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="15" width="4" height="3" rx="1"/>'),
    rec: WI('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'),
    stage: WI('<path d="M12 3l-7 15M12 3l7 15"/><path d="M3 21h18"/><circle cx="12" cy="3" r="1.2"/>')
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
  const SNS = [["instagram","ig","Instagram"],["tiktok","tt","TikTok"],["x","x","X"],["youtube","yt","YouTube"],["spotify","sp","Spotify"]];
  const snsHTML = (label=false) => SNS.map(([k,i,n]) => `<a class="c-${i}" href="${P.links[k]}" target="_blank" rel="noopener" aria-label="${n}">${svg(i)}${label?`<span>${n}</span>`:""}</a>`).join("");
  const pic = (k, alt, cls="") => `<img src="${IMG[k]}" alt="${esc(alt)}" loading="lazy" decoding="async" class="${cls}">`;
  const swipe = k => `<div class="swipe" aria-hidden="true"><span>横にスワイプ</span><span class="dots">${Array.from({length:k},(_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</span></div>`;
  const sh = (no, en, jp) => `<div class="sh"><span class="no">${no}</span><h2>${en}</h2><p>${jp}</p></div>`;
  const yen = n => n.toLocaleString("ja-JP");

  const comp = C.filter(c => c.category==="compose"), gtr = C.filter(c => c.category==="guitar"), kara = C.filter(c => c.category==="karaoke");
  const feat = C.filter(c => c.spotify && c.category==="compose").sort((a,b) => (a.spotifyRank||9)-(b.spotifyRank||9));
  const TAG = {"作曲":"COMPOSE","編曲":"ARRANGE","ギター":"GUITAR","レコーディング":"RECORDING","制作":"PRODUCTION"};
  const tagsOf = c => [...new Set((c.roles||[]).map(r => TAG[r]).filter(Boolean))];
  const tv = D.media.filter(m => m.type==="tv"), stage = D.media.filter(m => m.type==="stage");

  function hero(){
    return `<section class="hero" id="top" aria-label="北川弘喜">
      <i class="hero-blur" aria-hidden="true" style="background-image:url('${IMG.heroSp}')"></i>
      <picture><source media="(max-width:820px)" srcset="${IMG.heroSp}"><img src="${IMG.heroPc}" alt="紫の照明の中、ギターのネックを斜めに構えて弾く北川弘喜" fetchpriority="high"></picture>
      <div class="wrap">
        <p class="role">GUITARIST / COMPOSER</p>
        <h1 class="cp"><span class="l1"><em class="kw or">書ける</em>ギタリスト、</span><span class="l2"><em class="kw bl">弾ける</em>作曲家。</span></h1>
        <p class="name">KOKI KITAGAWA</p>
        <p class="lead">ギタリストとしてライブやレコーディング、コンポーザーとして作詞・作曲・編曲まで。「弾く」と「作る」の両方で活動しています。</p>
        <div class="cta">
          <button class="btn or" type="button" data-open="レッスン">レッスンを申し込む</button>
          <button class="btn gr" type="button" data-open="お仕事">仕事を依頼する</button>
        </div>
        <ul class="marks v-a" aria-label="主な実績">
          <li><i>FESTIVAL<em>2023</em></i><b>SUMMER SONIC</b><span>サポートギター</span></li>
          <li><i>FESTIVAL<em>2023</em></i><b>INAZUMA ROCK FES</b><span>サポートギター</span></li>
          <li><i>TV</i><b>CDTV</b><span>地上波出演</span></li>
          <li><i>SONGWRITING</i><b>B-PROJECT</b><span>楽曲提供（作詞・作曲・編曲）</span></li>
        </ul>${D.news.length ? `
        <ul class="news" aria-label="お知らせ">${D.news.map(n=>`<li><time>${esc(n.date||"")}</time>${n.url?`<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.text)}</a>`:`<span>${esc(n.text)}</span>`}</li>`).join("")}</ul>` : ""}
      </div>
    </section>`;
  }

  const ytId = u => { const m = String(u||"").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : ""; };
  const yearOf = t => { const m = D.liveYears.find(([p]) => t.startsWith(p)); return m ? m[1] : null; };
  const PH = ["guitar","studio","lesson","stage","live","pedal","play","desk","hands","guitars"];
  const SBG = {profile:"profile", works:"studio", lesson:"lesson"};   // career と contact は真空管の写真をスクロールで動かす（pbg）   // セクションの背景に大きくぼかして敷く写真
  const phStyle = `<style>${PH.filter(k=>IMG[k]).map(k=>`.ph-${k}::before{background-image:url("${IMG[k]}")}`).join("")}${Object.entries(SBG).map(([id,k])=>`#${id}.sbg::before${id==="profile"?",#profile .sbg-low":""}{background-image:url("${IMG[k]}")}`).join("")}</style>`;
  const ph = k => `ph ph-${k}`;
  const pbg = (k, tone) => `<div class="pbg ${tone}" aria-hidden="true"><i style="background-image:url('${IMG[k]}')"></i></div>`;
  /* お支払い：体験・月謝・単発で分けて出す（data/profile.json の lesson.payment） */
  const payLines = sep => (Array.isArray(P.lesson.payment) ? P.lesson.payment : [["", P.lesson.payment]]).map(([k,v]) => `<span class="pay">${k ? `<b>${esc(k)}</b>` : ""}${esc(v)}</span>`).join(sep);
  const chip = (t, cls="") => `<span class="chip ${cls}">${t}</span>`;

  function profile(){
    const g = P.gear.groups.map(x => `<li class="gcard"><b>${esc(x.name)}</b>${x.items.map(i=>`<span>${esc(i)}</span>`).join("")}</li>`).join("");
    return `<section class="s sbg" id="profile"><i class="sbg-low" aria-hidden="true"></i><div class="wrap">
      ${sh("01","Profile","プロフィール・経歴")}
      <div class="prof">
        <div class="pw"><div class="photo reveal">${pic("profile","椅子に座ってギターを弾く北川弘喜")}</div><span class="bigword" aria-hidden="true">Guitarist</span></div>
        <div>
          <p class="lede hl">${esc(P.bio[0])}</p>
          <div class="body bio">${P.bio.slice(1).map(x=>`<p>${esc(x)}</p>`).join("")}</div>
          <div class="sns color squares">${snsHTML()}</div>
          <details class="acc open-card"><summary><b>使用機材</b><span class="meta">${P.gear.groups.reduce((n,g)=>n+g.items.length,0)} ITEMS</span></summary>
            <div class="in"><ul class="gcards">${g}</ul></div></details>
        </div>
      </div>
    </div><i class="seam" aria-hidden="true"></i></section>`;
  }

  /* できること：3枚のカード（イラスト → 番号と英字の見出し → 短い説明 → 項目のタグ → 詳しく＞）。data/profile.json の canDo、イラストは src/ill/*.svg（触ると少し動く）
     2026-10-17：Profile からお仕事のご依頼欄へ移した。スマホも縦に並べ、スクロールで1枚ずつ出す */
  function canDo(){
    const K = P.canDo; if(!K || !(K.groups||[]).length) return "";
    const LINK = {stage:'href="#works" data-tab-go="stage"', music:'href="#works" data-tab-go="music"', lesson:'href="lesson.html"'};
    let ci = 0; const chips = items => `<ul class="tags">${items.map(x=>{ const cls = [x.major?"mj":"", x.href?"go":""].filter(Boolean).join(" "), in_ = `${esc(x.t)}${x.major?'<i>MAJOR</i>':""}`;
      return `<li${cls?` class="${cls}"`:""} style="--i:${ci++}">${x.href?`<a href="${esc(x.href)}">${in_}<span class="arr" aria-hidden="true">→</span></a>`:in_}</li>`; }).join("")}</ul>`;
    const sub = u => !u.label ? chips(u.items) : `<h5>${esc(u.label)}</h5>${chips(u.items)}`;
    return `<ul class="skills3" id="skills" aria-label="できること">${K.groups.map(g=>(ci=0,`<li class="card sk3 sk-${g.ill}">${(files["src/ill/"+g.ill+".svg"]||"").trim()}<div class="sk3-tx"><div class="num"><i>${esc(g.no)}</i><span>${esc(g.en)}</span></div><b>${esc(g.name)}</b>${g.desc?`<p class="sk3-desc">${esc(g.desc)}</p>`:""}</div>
            <div class="sk3-tags">${g.subs.map(sub).join("")}</div><a class="more" ${LINK[g.link]||""}>詳しく<span class="sr">（${esc(g.name)}）</span></a></li>`)).join("")}</ul>
          <p class="sk3-note">${esc(K.note)}</p><p class="sk3-legend"><i>MAJOR</i>${esc(K.majorNote.replace(/^MAJOR＝/,"＝"))}</p>`;
  }

  function career(){
    const T = D.timeline;
    return `<section class="s pb" id="career">${pbg("tubesBlue","blue")}<i class="seam-t" aria-hidden="true"></i><div class="wrap">
      ${sh("02","Career","経歴・実績")}
      <ol class="tl">${T.map(y => `<li class="tly${y.items.some(i=>i.key)?" has-key":""}"><div class="y">${y.year}</div><div class="evs">${y.items.map(it => it.key
        ? `<div class="ev key"><span class="k">${/SUMMER|フェス/i.test(it.t)?"FESTIVAL":/ステージ|ミュージカル/.test(it.t)?"STAGE":"SONGWRITING"}</span><b>${esc(it.t)}</b>${it.s?`<small>${esc(it.s)}</small>`:""}</div>`
        : `<div class="ev"><b>${esc(it.t)}</b>${it.s?`<small>${esc(it.s)}</small>`:""}</div>`).join("")}</div></li>`).join("")}</ol>
      <p class="small" style="margin-top:22px">出演したライブ・舞台・テレビの一覧は <a href="#works" data-tab-go="stage" style="text-decoration:underline;text-underline-offset:4px">WORKS</a> にまとめています。</p>
    </div><i class="seam" aria-hidden="true"></i></section>`;
  }

  function works(){
    const kind = t => /SUMMER SONIC|フェス|FESTIVAL|SP-RING/i.test(t) ? "FES" : "LIVE";
    const items = [
      ...D.live.map(x => ({k:kind(x.title), t:x.title, a:x.artist, r:x.role||"サポートギター", v:x.venue||"", y:x.year || yearOf(x.title)})),
      ...stage.map(x => ({k:"STAGE", t:x.title, a:"舞台", r:x.role||"", v:"", y:x.year})),
      {k:"TV", t:"CDTV", a:"地上波", r:`バック演奏（${tv.length}回出演）`, v:"", y:tv.map(m=>m.year).filter(Boolean).sort().pop()||null}];
    const BIG = /SUMMER SONIC|イナズマ|CDTV|あんさんぶる/;   // 大きい仕事は最初の6件に必ず入れる
    items.sort((a,b) => (BIG.test(b.t)-BIG.test(a.t)) || (b.y||0)-(a.y||0));
    const F = [["ALL","すべて"],["FES","フェス"],["LIVE","ライブ"],["STAGE","舞台"],["TV","テレビ"]];
    /* ON STAGE はチケット型（2026-10-17）：左の半券に種類と年、本体に公演名・アーティスト・担当。種類ごとに半券の色を変える */
    const gig = x=>`<li class="card gig tk tk-${x.k.toLowerCase()}" data-k="${x.k}"><div class="stub"><i>${x.k}</i>${x.y?`<b>${x.y}</b>`:""}</div><div class="tb"><span class="no" aria-hidden="true">KOKI KITAGAWA ／ ${x.k==="TV"?"ON AIR":"ON STAGE"}</span><b>${esc(x.t)}</b><span class="ar">${esc(x.a)}</span><small>${esc([x.r,x.v].filter(Boolean).join("・"))}</small></div></li>`;
    const W = P.work, nMusic = comp.length+gtr.length+kara.length;
    /* すべての制作実績はレコード型（2026-10-17）：盤のラベルに 種類・曲名・アーティスト・年・担当。種類でラベルの色を変える */
    /* 2026-10-21：ジャケットがある曲はラベルにジャケット。押すと上の再生と同じ Spotify で鳴り、鳴っているあいだレコードが回る（ジャケットがない作品は押すと回るだけ） */
    const rec = (k, kind, t, a, y, c) => { const tid = c && c.spotify ? (c.spotify.split("/track/")[1]||"").split("?")[0] : "", jk = c && c.jacket;
      return `<li class="card credit vrec rc-${k}${jk?" has-jk":""}" data-k="${k}"><button type="button" class="vinyl"${tid?` data-rtrack="${tid}"`:""} aria-label="${esc(t)}${tid?"を再生":"のレコードを回す"}" aria-pressed="false"><span class="dlb"${jk?` style="background-image:url('https://i.scdn.co/image/${jk}')"`:""}></span><span class="vpp" aria-hidden="true"><i class="tri"></i><i class="bars"></i></span></button><div class="rtx"><i>${esc(kind)}</i><b>${esc(t)}</b><span>${esc(a)}</span><small>${esc(y||"")}</small></div></li>`; };
    return `<section class="s sbg" id="works"><i class="seam-t" aria-hidden="true"></i><div class="wrap">
      ${sh("03","Works","作品・ライブ・出演")}
      <div class="works-top">
        <div class="seg" role="tablist" aria-label="作品の種類">
          <button type="button" role="tab" id="t-music" aria-controls="p-music" aria-selected="true" data-tab="music">楽曲<em>${nMusic}</em></button>
          <button type="button" role="tab" id="t-stage" aria-controls="p-stage" aria-selected="false" data-tab="stage">ライブ・TV<em>${items.length}</em></button></div></div>
      ${videoBlock()}
      <div class="tabp on" id="p-music" role="tabpanel" aria-labelledby="t-music">
        <div class="feat hs" id="feat">${feat.map((c,i) => {
          const id = (c.spotify||"").split("/track/")[1];
          return `<article class="song"><button class="art" type="button" data-track="${id}" aria-label="${esc(c.title)}（${esc(c.artist)}）を再生" aria-pressed="false" style="background-image:url('https://i.scdn.co/image/${c.jacket}')"><span class="no">${String(i+1).padStart(2,"0")}</span><span class="pp" aria-hidden="true"><i class="tri"></i><i class="bars"></i></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="bar" aria-hidden="true"><i></i></span></button>
          <h4>${esc(c.title)}</h4><div class="who">${esc(c.artist)}<em>${c.year||""}</em></div></article>`;}).join("")}</div>
        <div class="swipe feat-sw"><span aria-hidden="true">横にスワイプ</span><span class="dots" aria-hidden="true">${feat.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</span><span class="rail-btns"><button type="button" class="rb" data-rail="-1" aria-label="前の曲へ">‹</button><button type="button" class="rb" data-rail="1" aria-label="次の曲へ">›</button></span></div>
        <div class="sp-host" id="spHost" aria-hidden="true"><div id="spEmbed"></div></div>
        ${(() => {
          /* 2026-10-27：レコードは最初から数枚見せて、残りは「もっと見る」（ライブのチケットと同じ形・北川くん）。
             PC は8枚、スマホは4枚。並びは 作詞・作曲・編曲 → ギター参加 → カラオケ音源（お仕事の人にいちばん伝えたい順） */
          const order = [...comp, ...gtr, null];
          const cards = order.map(c => c ? rec(c.category, (c.roles||[]).join("・"), c.title, c.album ? `${c.artist}（${c.album}）` : c.artist, c.year, c)
            : rec("karaoke","カラオケ音源制作","有名歌い手のカラオケ音源","作品名は非公開","×"+kara.length));
          const N = 8;
          return `<div class="allworks2" id="credits">
          <div class="aw-head"><h4>すべての制作実績</h4><span class="meta">${nMusic} CREDITS</span></div>
          <div class="filters" role="group" aria-label="種類で絞り込む" data-grid="cgrid">
            <button type="button" class="fchip" data-f="ALL" aria-pressed="true">すべて<em>${nMusic}</em></button>
            <button type="button" class="fchip" data-f="compose" aria-pressed="false">作詞・作曲・編曲<em>${comp.length}</em></button>
            <button type="button" class="fchip" data-f="guitar" aria-pressed="false">ギター参加<em>${gtr.length}</em></button>
            <button type="button" class="fchip" data-f="karaoke" aria-pressed="false">カラオケ音源<em>${kara.length}</em></button></div>
          <ul class="grid4 recs" id="cgrid">${cards.slice(0,N).join("")}</ul>
          <details class="acc gigs-more recs-more" id="cgridMore"><summary><b>もっと見る</b><span class="meta"><span class="only-pc">+${cards.length-N}</span><span class="only-sp">+${cards.length-4}</span></span></summary>
            <div class="in"><ul class="grid4 recs" id="cgrid2">${cards.slice(N).join("")}</ul></div></details>
          </div>`; })()}
      </div>
      <div class="tabp" id="p-stage" role="tabpanel" aria-labelledby="t-stage">
        <figure class="gearshot reveal">${pic("gearWide","ライブ会場のステージ。手前に大きなエフェクターボード、奥にゴールドトップのギターとアンプ")}<figcaption class="cap">ON STAGE</figcaption></figure>
        <div class="filters" role="group" aria-label="種類で絞り込む" data-grid="gigs">${F.map((f,i)=>`<button type="button" class="fchip" data-f="${f[0]}" aria-pressed="${i?"false":"true"}">${f[1]}<em>${f[0]==="ALL"?items.length:items.filter(x=>x.k===f[0]).length}</em></button>`).join("")}</div>
        <ul class="grid3" id="gigs">${items.slice(0,6).map(gig).join("")}</ul>
        <details class="acc gigs-more" id="gigsMore"><summary><b>すべて見る（${items.length}）</b><span class="meta">+${items.length-6}</span></summary>
          <div class="in"><ul class="grid3" id="gigs2">${items.slice(6).map(gig).join("")}</ul></div></details>
      </div>
      <div class="outlinks">
        <a class="ol sp" href="${P.links.spotify}" target="_blank" rel="noopener">${svg("sp")}<span><b>Spotify</b><small>提供曲・参加曲をまとめて聴く</small></span></a>
        <a class="ol yt" href="${P.links.youtube}" target="_blank" rel="noopener">${svg("yt")}<span><b>YouTube</b><small>演奏を見る</small></span></a>
      </div>
      <div class="workcta">
        <div class="wc-head"><span class="wc-en">FOR CLIENTS</span><h3>お仕事のご依頼</h3><p>作曲・編曲・ギターREC・楽曲制作のご相談はこちら。${esc(W.policy)}</p></div>
        <h4 class="wc-sub">できること</h4>
        ${canDo()}
        <h4 class="wc-sub">進め方</h4>
        <ol class="steps">${W.flow.map((s,i)=>{ const t = typeof s==="string" ? {t:s,d:""} : s; return `<li class="st" style="--k:${i}"><span class="n">${String(i+1).padStart(2,"0")}</span><span class="tx"><b>${esc(t.t)}</b>${t.d?`<small>${esc(t.d)}</small>`:""}</span></li>`; }).join("")}</ol>
        <ul class="wc-note"><li>${esc(W.style)}</li><li>料金：${esc(W.price)}</li><li>${esc(W.revisionNote)}</li></ul>
        <button class="btn gr" type="button" data-open="お仕事">フォームで相談する</button>
      </div>
    </div></section>`;
  }

  /* 動画1本（オリジナル曲のPVなど）。data/site.json の video.youtube が空なら出さない */
  function videoBlock(){
    const V = D.video; const id = ytId(V.youtube); if(!id) return "";
    return `<div class="pv"><button class="pv-frame" type="button" data-yt="${id}" aria-label="${esc(V.title||"動画")}を再生" style="background-image:url('https://i.ytimg.com/vi/${id}/maxresdefault.jpg')"><span class="pp" aria-hidden="true"><i class="tri"></i></span></button>
      <div class="pv-tx"><span class="chip or">ORIGINAL</span><b>${esc(V.title)}</b>${V.sub?`<small>${esc(V.sub)}</small>`:""}</div></div>`;
  }
  const GL = `<i class="glint" aria-hidden="true"></i>`;   // 料金カードを触るとキラッと光る（B5）
  function lesson(no = "04", solo = false){   /* solo＝レッスンのページ用：上の1画面目と同じ写真・数字は出さない */
    const L = D.lessonPlans, base = L.single.price;
    const plan = p => { const per = Math.round(p.price/p.count), save = base*p.count - p.price;
      return `<li class="card plan ${p.rec?"rec":""} ${ph(({2:"hands",4:"guitar",8:"play"})[p.count])}">${p.rec?'<span class="badge">人気No.1</span>':""}<div class="nm">${esc(p.name)}</div><div class="ct">60分×${p.count}回</div>
        <div class="p">¥${yen(p.price)}<small>/ 月</small></div><div class="per">1回あたり ¥${yen(per)}${save>0?`<em>単発より月¥${yen(save)}おトク</em>`:""}</div>
        ${pick(p.name)}${GL}</li>`; };
    /* 月謝・単発のボタン：予約ページがあるときは「体験から始める」（気になるプランを予約ページへ渡す） */
    function pick(n){ return D.yoyaku ? `<a class="pick" href="yoyaku.html?plan=${encodeURIComponent(n)}">体験から始める</a>` : `<button class="pick" type="button" data-open="レッスン" data-plan="${esc(n)}">このプランを選ぶ</button>`; }
    return `<section class="s sbg" id="lesson">${solo ? `<i class="seam-t" aria-hidden="true"></i>` : ""}<div class="wrap">
      ${solo ? sh(no,"Price","料金と体験レッスン") : sh(no,"Lesson","ギターレッスン")}
      <div class="les${solo ? " solo" : ""}">
        ${solo ? "" : `<div class="pw"><div class="photo reveal">${pic("lesson","ギターを持ち、こちらを見てほほえむ北川弘喜")}</div><span class="bigword or" aria-hidden="true">Let's play</span></div>`}
        <div>
          ${solo ? "" : `<p class="lede">現場で培った経験を、あなたのギターへ。</p>
          <p class="lplace"><span class="chip or">小岩のスタジオ／オンライン対応</span></p>`}
          ${solo ? "" : `<ul class="lstats big">${D.lessonStats.map(x=>`<li class="card">${x.tag?`<i class="ltag">${esc(x.tag)}</i>`:""}<b>${esc(x.v)}<small>${esc(x.u)}</small></b><span>${esc(x.l)}</span></li>`).join("")}</ul>`}
          ${D.trialProof ? `<p class="trial-proof"><span aria-hidden="true"></span>${esc(D.trialProof)}</p>` : ""}
          <div class="card trial ${ph("lesson")}"><div><span class="chip or">FIRST</span><b>体験レッスン</b><small>初回のみ・60分・ギターはスタジオで借りられます</small></div><div class="p">¥${yen(L.trial.price)}</div>
            <ol class="tsteps">${(P.lesson.trialSteps||[]).map((t,i)=>`<li><span>${i+1}</span>${esc(t)}</li>`).join("")}</ol>
            ${D.yoyaku ? `<a class="pick or" href="yoyaku.html">空いている日時を見て予約する</a>` : D.booking ? `<button class="pick or" type="button" data-book>空いている日時を見て予約する</button>` : `<button class="pick or" type="button" data-open="レッスン" data-plan="体験レッスン">体験を申し込む</button>`}${GL}</div>
          ${D.yoyaku ? `<p class="plans-lead"><b>月謝・単発も、まずは体験レッスンから。</b>各プランの「体験から始める」から、気になるプランを伝えて体験を予約できます。</p>` : ""}
          <ul class="plans hs" id="plans">${L.monthly.map(plan).join("")}
            <li class="card plan ${ph("guitars")}"><div class="nm">単発</div><div class="ct">60分×1回</div><div class="p">¥${yen(base)}<small>/ 回</small></div><div class="per">好きなときに1回から</div>
            ${pick("単発")}${GL}</li></ul>${swipe(L.monthly.length+1)}
          <p class="small" style="margin:14px 0 0">料金はすべて税込です。スタジオで受ける場合、スタジオ代（1時間 約1,500円）が別にかかります。オンラインはかかりません。</p>
          <details class="acc open-card les-info"><summary><b>受付の時間・場所・お支払い</b></summary><div class="in">
            <table class="hours"><tr><th>水・木・金</th><td>16〜23時<small>前月20日を過ぎてからのご予約は 22〜23時</small></td></tr>
            <tr><th>土・日</th><td>12〜23時<small>前月20日を過ぎてからのご予約は 21〜23時</small></td></tr>
            <tr><th>月・火</th><td>お休み</td></tr>
            <tr><th>場所</th><td>${esc(P.lesson.place)}</td></tr><tr><th>スタジオ代</th><td>${esc(P.lesson.studioFee)}</td></tr><tr><th>お支払い</th><td>${payLines("")}</td></tr>
            <tr><th>キャンセル・振替</th><td>${`<span class="pay"><b>月謝・単発</b>${esc(P.lesson.cancel)}</span><span class="pay"><b>体験レッスン</b>${esc(P.lesson.trialCancel)}</span>`}</td></tr></table>
            <p class="small" style="margin-top:12px">月謝の方は、毎月20日までに翌月分をご予約ください。</p></div></details>
        </div>
      </div>
      ${solo ? access() : ""}
      <div class="les-extra">
        <div><h3><span>STEP</span>はじめるまで</h3>
          <ol class="flow hs" id="flow">
            ${D.yoyaku ? `<li class="card"><span class="n">01</span><b>空いている日時を選ぶ</b><small>スタジオもオンラインも、1つ選ぶだけ</small></li>
            <li class="card"><span class="n">02</span><b>予約が確定</b><small>LINE ならその場で確定。メールの方は、届いたリンクを開くと確定します</small></li>` : D.booking ? `<li class="card"><span class="n">01</span><b>空いている日時を選ぶ</b><small>カレンダーから、その場で予約できます</small></li>
            <li class="card"><span class="n">02</span><b>確認のメールが届く</b><small>場所と当日の流れをお送りします</small></li>` : `<li class="card"><span class="n">01</span><b>フォームから申し込む</b><small>ご用件で「レッスン」を選んで送信</small></li>
            <li class="card"><span class="n">02</span><b>日程を決める</b><small>2日以内にメールでご返信します</small></li>`}
            <li class="card"><span class="n">03</span><b>体験レッスン</b><small>初回60分。合えば月謝か単発へ</small></li>
          </ol>${swipe(3)}</div>
        <div class="faq reveal" id="faq"><h3><span>FAQ</span>よくある質問</h3>
          <details><summary>まったくの初心者でも大丈夫？</summary><p>大丈夫です。初心者からプロを目指す方まで、それぞれに合わせて進めます。</p></details>
          <details><summary>ギターを持っていなくても受けられる？</summary><p>${esc(P.lesson.guitarRental)}</p></details>
          <details><summary>体験レッスンでは何をする？</summary><p>${esc((P.lesson.trialSteps||[]).map((s, i) => "①②③④⑤"[i] + s).join("　"))}。この流れで60分です。</p></details>
          <details><summary>体験のあと、しつこく勧誘されない？</summary><p>${esc(P.lesson.noPush)}</p></details>
          <details><summary>何歳から受けられる？</summary><p>${esc(P.lesson.ages)}</p></details>
          <details><summary>どこでレッスンする？</summary><p>サウンドスタジオM小岩店（JR小岩駅から歩いて約4分）か、オンライン（Google Meet）で受けられます。</p></details>
          <details><summary>スタジオ代はかかる？</summary><p>スタジオで受ける場合は、レッスン料金とは別に、スタジオ代（1時間 約1,500円）を当日スタジオでお支払いください。オンラインはかかりません。</p></details>
          <details><summary>支払い方法は？</summary><p>${payLines("")}</p></details>
          <details><summary>キャンセル・日程の変更はできる？</summary><p>${`<span class="pay"><b>月謝・単発</b>${esc(P.lesson.cancel)}</span><span class="pay"><b>体験レッスン</b>${esc(P.lesson.trialCancel)}</span>`}</p></details>
          <details><summary>予約はいつまでに？</summary><p>月謝の方は、毎月20日までに翌月分をご予約ください。20日を過ぎてからのご予約は、水・木・金は22〜23時、土・日は21〜23時になります。体験レッスンは、予約ページの空いている日時から選べます。</p></details>
        </div>
      </div>${whos()}${voices()}
      ${D.yoyaku ? `<div class="les-book reveal">
        ${D.lineAdd ? `<a class="ct-book ln only-sp" href="${esc(D.lineAdd)}" target="_blank" rel="noopener"><span class="cb-tx"><span class="chip or">FIRST LESSON</span><b>LINE で体験レッスンを予約</b><small>60分 ¥${yen(D.lessonPlans.trial.price)}・小岩のスタジオかオンライン。友だち追加すると、すぐに予約のボタンが届きます。お知らせも LINE に届きます</small></span><i class="cb-arr cb-ln" aria-hidden="true">${LINE_ICON}</i></a>
        <a class="les-web only-sp" href="yoyaku.html">LINE を使わない方は、こちらの予約ページから →</a>` : ""}
        <a class="ct-book${D.lineAdd ? " only-pc" : ""}" href="yoyaku.html"><span class="cb-tx"><span class="chip or">FIRST LESSON</span><b>体験レッスンを予約する</b><small>60分 ¥${yen(D.lessonPlans.trial.price)}・小岩のスタジオかオンライン。空いている日時から、そのまま申し込めます</small></span><i class="cb-arr" aria-hidden="true">→</i></a>
        ${D.lineAdd ? lineCard("les") : ""}
        <a class="dm" href="${P.links.instagram}" target="_blank" rel="noopener"><i>${svg("ig")}</i><span><b>予約の前に聞きたいことは Instagram の DM へ</b><small>気軽にメッセージください</small></span></a>
      </div>` : ""}
    </div><i class="seam" aria-hidden="true"></i></section>`;
  }
  /* 2026-10-27 試し：レッスンは専用ページ（lesson.html）に分ける。トップはお仕事を探している人向けにして、レッスンは短い案内だけ */
  const statsHTML = () => `<ul class="lt-stats">${D.lessonStats.map(x=>`<li><b>${esc(x.v)}<small>${esc(x.u)}</small></b><span>${esc(x.l)}</span></li>`).join("")}</ul>`;
  function lessonTeaser(){
    return `<section class="s sbg lteaser" id="lesson"><div class="wrap">
      ${sh("04","Lesson","ギターレッスン")}
      <a class="lt-card reveal" href="lesson.html">
        <span class="lt-ph">${pic("lesson","ギターを持ち、こちらを見てほほえむ北川弘喜")}</span>
        <span class="lt-tx"><span class="chip or">小岩のスタジオ／オンライン</span>
          <b class="lt-h">現場で培った経験を、<br>あなたのギターへ。</b>
          <span class="lt-p">初心者からプロを目指す方まで。体験レッスンは60分 ¥${yen(D.lessonPlans.trial.price)}。料金・予約・よくある質問は、レッスンのページにまとめています。</span>
          ${statsHTML()}
          <span class="btn or lt-go">レッスンのページへ<i aria-hidden="true">→</i></span></span>
      </a>
    </div><i class="seam" aria-hidden="true"></i></section>`;
  }
  function lessonHero(){
    const book = D.yoyaku ? (D.lineAdd ? `<a class="btn or ln-btn only-sp" href="${esc(D.lineAdd)}" target="_blank" rel="noopener">${LINE_ICON}LINEで体験予約</a><a class="btn or only-pc" href="yoyaku.html">体験レッスンを予約</a>` : `<a class="btn or" href="yoyaku.html">体験レッスンを予約</a>`) : `<a class="btn or" href="#lesson">体験レッスン</a>`;
    return `<section class="hero lhero" id="top" aria-label="北川弘喜のギターレッスン">
      <i class="hero-blur" aria-hidden="true" style="background-image:url('${IMG.lesson}')"></i>
      <picture><img src="${IMG.lesson}" alt="ギターを持ち、こちらを見てほほえむ北川弘喜" fetchpriority="high"></picture>
      <div class="wrap">
        <p class="role">GUITAR LESSON</p>
        <h1 class="cp"><span class="l1">現場で培った経験を、</span><span class="l2"><em class="kw or">あなたのギター</em>へ。</span></h1>
        <p class="name">KOKI KITAGAWA</p>
        <p class="lead">ライブ・TV・レコーディングの現場で弾いているギタリストが、直接教えます。小岩のスタジオとオンラインで、初心者からプロを目指す方まで。</p>
        <div class="cta">${book}<a class="btn line" href="#plans">料金を見る</a></div>
        ${statsHTML()}
      </div>
    </section>`;
  }
  /* 2026-10-27：レッスンのページに「スタジオへの行き方」（北川くん）。スタジオの住所だけ（自宅は出さない）。
     駅からの道は、予約のメール（コード.gs の「スタジオの道」）と同じ「約4分」にそろえる。北口はスタジオ公式サイトより */
  const STUDIO = {name:"サウンドスタジオM小岩店", addr:"東京都江戸川区西小岩1-27-16 オルフェウスビル4F", way:"JR小岩駅 北口から歩いて約4分", site:"https://orpheusrecords.jp/ssm/koiwa/"};
  const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/></svg>`;
  const PC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="11.5" rx="1.6"/><path d="M9 20h6M12 16.5V20"/></svg>`;
  function access(){
    const map = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(STUDIO.name + " " + STUDIO.addr);
    return `<div class="acc-wrap reveal" id="access"><h3><span>ACCESS</span>スタジオへの行き方</h3>
      <div class="acc-grid">
        <div class="card acc-card"><i class="acc-pin">${PIN}</i><div>
          <span class="chip or">STUDIO</span><b class="acc-nm">${esc(STUDIO.name)}</b>
          <p class="acc-way">${esc(STUDIO.way)}</p><p class="acc-ad">${esc(STUDIO.addr)}</p>
          <ul class="acc-notes"><li>当日はレッスンの5分前に、4階の受付へお越しください</li><li>スタジオ代（1時間 約1,500円）は、当日スタジオでお支払いください</li><li>ギターはスタジオで借りられます</li></ul>
          <div class="acc-btns"><a class="btn or sm" href="${map}" target="_blank" rel="noopener">Googleマップで開く</a><a class="btn line sm" href="${STUDIO.site}" target="_blank" rel="noopener">スタジオのサイト</a></div>
        </div></div>
        <div class="card acc-card on"><i class="acc-pin">${PC_ICON}</i><div>
          <span class="chip">ONLINE</span><b class="acc-nm">オンライン</b>
          <p class="acc-way">ご自宅から、Google Meet で</p>
          <ul class="acc-notes"><li>予約が確定すると、参加のリンクが届きます</li><li>スタジオ代はかかりません</li></ul>
        </div></div>
      </div></div>`;
  }
  /* 公式LINE の友だち追加（2026-10-25）。体験の予約・質問・予約の確認が LINE でできる */
  function lineCard(where){
    return `<a class="dm ln only-pc" href="${esc(D.lineAdd)}" target="_blank" rel="noopener"><i>${LINE_ICON}</i><span><b>公式LINE を友だち追加</b><small>体験の予約・ご質問・予約の確認が、LINE でできます</small></span><em class="ln-add">友だち追加</em></a>`;
  }
  /* 2026-10-28：こんな方が来ています（北川くん：趣味で始めた主婦・上手くなりたいバンドギタリスト・V系好きな社会人）。data/profile.json の lesson.who */
  function whos(){
    const W = (P.lesson.who||[]).filter(w => w && w.t);
    if(!W.length) return "";
    return `<div class="voices whos" id="who"><h3><span>WHO</span>こんな方が来ています</h3><ul class="flow hs" id="whos">${W.map(w=>`<li class="card"><span class="n">${esc(w.en||"")}</span><b>${esc(w.t)}</b><small>${esc(w.s||"")}</small></li>`).join("")}</ul>${W.length>1?swipe(W.length):""}</div>`;
  }
  /* 生徒さんの声：data/voices.json に本人からもらった言葉が入ったときだけ出す */
  function voices(){
    if(!D.voices.length) return "";
    return `<div class="voices" id="voice"><h3><span>VOICE</span>生徒さんの声</h3><ul class="vgrid hs" id="voices">${D.voices.map(v=>`<li class="card voice"><span class="q" aria-hidden="true">“</span><p>${esc(v.text).split("\n").join("<br>")}</p><div class="who"><b>${esc(v.who||"生徒さん")}</b>${[v.years,v.plan].filter(Boolean).map(x=>`<span class="chip or">${esc(x)}</span>`).join("")}</div></li>`).join("")}</ul>${D.voices.length>1?swipe(D.voices.length):""}</div>`;
  }

  /* 2026-10-17：レッスンの申し込みは予約ページに一本化。フォームの「レッスン」は、ご質問だけの短いフォームにした */
  /* 2026-10-21：Contact はお仕事のご依頼とその他のお問い合わせ専用（体験の予約・レッスンのご質問は LESSON の一番下へ） */
  const KINDS = D.yoyaku ? ["お仕事","その他"] : ["レッスン","お仕事","その他"];
  const KDESC = {"レッスンのご質問":"予約の前のご質問・生徒さんのご連絡","レッスン":"体験・月謝・単発","お仕事":"作曲・編曲・ギターREC・ライブサポート","その他":"取材・ご相談など"};
  function contact(){
    const W = P.work;
    return `<section class="s pb" id="contact">${pbg("tubesAmber","amber")}<i class="seam-t" aria-hidden="true"></i><div class="wrap">
      ${sh("05","Contact","お問い合わせ")}
      <div class="ct">
        <div class="side">
          <p>${D.yoyaku ? `制作・演奏・ライブサポート等のお仕事のご依頼、取材などその他のお問い合わせは、こちらのフォームからご連絡ください。体験レッスンのご予約は<a class="ul" href="lesson.html">レッスンのページ</a>から。` : `レッスンのお申し込み、制作・演奏・ライブサポート等のお仕事は、こちらのフォームからご連絡ください。`}2日以内にメールでご返信します。</p>
          <div class="quick">
            ${D.yoyaku ? "" : `<a class="dm" href="${P.links.instagram}" target="_blank" rel="noopener"><i>${svg("ig")}</i><span><b>レッスンのご質問は Instagram の DM でも</b><small>気軽にメッセージください</small></span></a>`}
            <button class="dm wk" type="button" data-open="お仕事"><i class="arw" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></i><span><b>お仕事のご依頼は、フォームから</b><small class="sp-only">下のフォームで「お仕事」を選んでください</small><small class="pc-only">右のフォームで「お仕事」を選んでください</small></span></button>
          </div>
        </div>
        <form class="f" id="form" novalidate>
          <fieldset class="kinds"><legend>ご用件を選んでください<i>必須</i></legend>
            ${KINDS.map((k,i)=>`<label class="kc ${({"レッスン":"or","レッスンのご質問":"or","その他":"bl"})[k]||""}"><input type="radio" name="kind" value="${k}"><span><b>${k}</b><small>${KDESC[k]}</small></span></label>`).join("")}
            <input type="hidden" id="f_kind"><p class="err" hidden></p></fieldset>
          <div class="two">
            <div><label for="f_name">お名前<i>必須</i></label><input id="f_name" name="name" autocomplete="name" required><p class="err" hidden></p></div>
            <div><label for="f_mail">メールアドレス<i>必須</i></label><input id="f_mail" name="email" type="email" inputmode="email" autocomplete="email" required><p class="err" hidden></p></div>
          </div>
          ${D.yoyaku ? "" : `          <div class="xf" data-for="レッスン">
            <div class="two">
              <div><label for="f_plan">希望プラン<i>必須</i></label><select id="f_plan"><option value="">選んでください</option>${["体験レッスン",...D.lessonPlans.monthly.map(m=>m.name),"単発","まだ決めていない"].map(x=>`<option>${esc(x)}</option>`).join("")}</select><p class="err" hidden></p></div>
              ${D.yoyaku ? `<div class="trial-go" id="trialGo" hidden><p><b>体験レッスンは、予約ページから</b>空いている日時を選んで、そのまま申し込めます。</p><a class="btn or" href="yoyaku.html">予約ページへ</a></div>` : ""}
              <div><label for="f_level">ギター歴</label><select id="f_level"><option value="">選んでください</option><option>はじめて</option><option>1年未満</option><option>1〜3年</option><option>3年以上</option></select></div>
            </div>
            <fieldset class="opts"><legend>受ける場所</legend>${["小岩のスタジオ","オンライン","相談したい"].map(x=>`<label class="opt"><input type="radio" name="f_place" value="${x}"><span>${x}</span></label>`).join("")}</fieldset>
            <div><label for="f_when">希望の曜日・時間</label><input id="f_when" placeholder="例：水曜の夜、土日の昼"></div>
          </div>`}
          <div class="xf" data-for="お仕事">
            <fieldset class="opts" id="f_jobs"><legend>ご依頼の内容<i>必須・複数OK</i></legend>${["作詞・作曲","編曲・トラック制作","ギターREC","ライブサポート","カラオケ音源","その他"].map(x=>`<label class="opt"><input type="checkbox" name="f_job" value="${x}"><span>${x}</span></label>`).join("")}<p class="err" hidden></p></fieldset>
            <div class="two">
              <div><label for="f_company">会社名・団体名<i>必須</i></label><input id="f_company" autocomplete="organization" placeholder="個人の方は「個人」とご記入ください"><p class="err" hidden></p></div>
              <div><label for="f_use">使い道</label><select id="f_use"><option value="">選んでください</option>${W.uses.map(x=>`<option>${esc(x)}</option>`).join("")}</select></div>
            </div>
            <div class="two">
              <div><label for="f_budget">ご予算<i>必須</i></label><select id="f_budget"><option value="">選んでください</option>${W.budgets.map(x=>`<option>${esc(x)}</option>`).join("")}</select><p class="err" hidden></p></div>
              <div><label for="f_due">納期</label><input id="f_due" placeholder="例：11月末まで"></div>
            </div>
            <div><label for="f_ref">参考音源のURL</label><input id="f_ref" type="url" inputmode="url" placeholder="https://"></div>
          </div>
          <div><label for="f_sub">件名</label><input id="f_sub" name="subject" placeholder="例：ご相談の内容"></div>
          <div><label for="f_msg">メッセージ<i id="msgReq">必須</i></label><textarea id="f_msg" name="message" required placeholder="ご希望の内容、日程、納期など"></textarea><p class="err" hidden></p></div>
          <input type="hidden" name="from" id="f_from">
          <p class="note">送信すると、<a href="privacy.html">プライバシーポリシー</a>に同意したものとします。</p>
          <button class="btn gr send" type="submit" id="send">この内容で送る</button>
          <div class="done" id="done" hidden role="status">ありがとうございます。送信しました。2日以内にメールでご返信します。</div>
          <p class="err" id="sendErr" hidden>送信できませんでした。通信の状態を確かめて、もう一度お試しください。うまくいかない場合は Instagram の DM からご連絡ください。</p>
        </form>
      </div>
    </div></section>`;
  }

  /* 五線譜リボン（2026-10-17 作り直し）：大きくうねる五線を2本重ねる（奥＝細く薄い、手前＝太くはっきり）。
     音符・ト音記号・ヘ音記号が五線に乗ったまま、線に沿って流れる（SVG の animateMotion）。触ると五線が揺れる。
     色は 五線＝白、音符＝オレンジ2色＋白。素材は使わずオリジナルで描いている */
  const r1 = n => Math.round(n*10)/10;
  /* 1本の五線：中心の曲線 y=f(x) から、法線の向きに s ずつずらした5本の線を引く（傾いても線の間がつぶれない） */
  function staffGeo(f, s, rev, RW){
    const xs = []; for(let x=-160; x<=RW+160; x+=10) xs.push(x); if(rev) xs.reverse();
    const pt = (x, d) => { const dy = (f(x+.5)-f(x-.5)), L = Math.hypot(1, dy); return [x - d*dy/L, f(x) + d/L]; };
    const line = d => "M" + xs.map(x => pt(x,d).map(r1).join(" ")).join(" L");
    return { center: line(0), lines: [-2,-1,0,1,2].map(k => line(k*s)) };
  }
  /* 記号（中心の線＝真ん中の線。y は下向きが＋、1目盛り＝12）*/
  const G = {
    /* 棒が上（真ん中の線より下の音）。頭の右から上へ */
    q:  `<ellipse rx="6.6" ry="4.7" transform="rotate(-22)"/><path class="sk" d="M5.9 -1.5V-34"/>`,
    e:  `<ellipse rx="6.6" ry="4.7" transform="rotate(-22)"/><path class="sk" d="M5.9 -1.5V-34"/><path d="M5.9 -34c1.5 6 11 9 9.5 19.5c-1.2-6-4.5-8.5-9.5-10z"/>`,
    h:  `<ellipse class="hol" rx="6" ry="4.3" transform="rotate(-22)"/><path class="sk" d="M5.9 -1.5V-34"/>`,
    bm: `<ellipse rx="6.6" ry="4.7" transform="rotate(-22)"/><ellipse cx="24" cy="-6" rx="6.6" ry="4.7" transform="rotate(-22 24 -6)"/><path class="sk" d="M5.9 -1.5V-34M29.9 -7.5V-40"/><path d="M5 -36.5L30.8 -42.5V-36.5L5 -30.5z"/>`,
    /* 棒が下（真ん中の線とそれより上の音）。頭の左から下へ。旗は右向き */
    qd: `<ellipse rx="6.6" ry="4.7" transform="rotate(-22)"/><path class="sk" d="M-5.9 1.5V34"/>`,
    ed: `<ellipse rx="6.6" ry="4.7" transform="rotate(-22)"/><path class="sk" d="M-5.9 1.5V34"/><path d="M-5.9 34c1.5-6 11-9 9.5-19.5c-1.2 6-4.5 8.5-9.5 10z"/>`,
    hd: `<ellipse class="hol" rx="6" ry="4.3" transform="rotate(-22)"/><path class="sk" d="M-5.9 1.5V34"/>`,
    bmd:`<ellipse rx="6.6" ry="4.7" transform="rotate(-22)"/><ellipse cx="24" cy="-6" rx="6.6" ry="4.7" transform="rotate(-22 24 -6)"/><path class="sk" d="M-5.9 1.5V36M18.1 -4.5V30"/><path d="M-6.8 31.5L19 25.5V31.5L-6.8 37.5z"/>`,
    /* ト音記号：うず巻きの真ん中が下から2本目の線（ソ＝+12） */
    tr: `<path class="sk cl" transform="translate(0 8)" d="M-1 40c-6 1.5-9-5.5-3.5-7.5c4.5-1.5 7 4.5 2.5 9M-1.5 41L5-34C6-48 14-46 11-36C8-26-13-18-13 2C-13 18 13 18 13 4C13-8-5-9-6 2C-6.5 9 3 11 4 6"/>`,
    /* ヘ音記号：黒い丸が上から2本目の線（ファ＝-12）、2つの点はその線をはさむすき間 */
    bs: `<path class="sk cl" d="M-9-12.5C-9-23.5 11-23.5 11-9.5C11 4.5-1 13.5-11 18.5"/><circle cx="-6.5" cy="-12" r="3.6"/><circle cx="16" cy="-18" r="2"/><circle cx="16" cy="-6" r="2"/>`,
    sh: `<path class="sk thin" d="M-3-9V11M3-11V9M-6-2L6-5.5M-6 5L6 1.5"/>`
  };
  /* 楽譜の決まり：真ん中の線とそれより上の音は棒を下に、下の音は棒を上に（2つつながりは2つの高さの平均で決める）。記号は自分の線に固定 */
  const glyph = (g, dy) => ({q:1,e:1,h:1}[g] ? G[dy <= 0 ? g+"d" : g] : g==="bm" ? G[dy-3 < 0 ? "bmd" : "bm"] : G[g]);
  const placeY = (g, dy) => (g==="tr" || g==="bs") ? 0 : dy;

  /* 手前の五線に流す並び：[記号, 高さ（目盛り 6＝線1本ぶんの半分）, 色] */
  const FRONT = [["tr",0,"w"],["q",-6,"o"],["e",6,"h"],["bm",12,"o"],["h",-12,"w"],["q",0,"h"],["bs",0,"w"],["e",-6,"o"],["sh",0,"h"],["q",6,"o"],["bm",0,"h"],["e",-12,"w"],["q",12,"o"],["h",6,"h"]];
  const BACK  = [["q",6,"o"],["tr",0,"w"],["e",-6,"h"],["q",0,"w"],["bm",6,"o"],["h",-6,"w"],["bs",0,"h"],["e",12,"o"],["q",-12,"w"]];
  let rbN = 0;
  /* 2026-10-27 作り直し（北川くん）：
     ・曲がり方＝波を1本のきれいなカーブに（前は2つの波を足していて、いびつに見えた）
     ・揺れ＝ギターの弦のように、触ったところを中心に揺れて、だんだんおさまる（main.js）
     ・かくつき＝音符の流れを main.js の1つのループで動かす。音符の光のぼかしをやめて軽くした
     ここでは、動かないとき（「視差効果を減らす」の人・JS なし）の形を書き出す。カーブの式は data-f に入れて main.js と共有 */
  function staffLayer(cls, geo, seq, scale, dur, rev, W, s, RW){
    const n = seq.length, span = RW + 320;
    const notes = seq.map(([g,dy,c],i) => { const x = rev ? RW+160 - span*i/n : -160 + span*i/n, y = W.f(x), a = Math.atan(W.d(x))*180/Math.PI;
      return `<g class="nt c-${c}" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(a)})"><g transform="scale(${scale}) translate(0 ${placeY(g,dy)})">${glyph(g,dy)}</g></g>`; }).join("");
    return `<g class="${cls} st-layer" data-f="${[W.c,W.a,W.k,W.ph].map(v=>Math.round(v*1e5)/1e5).join(",")}" data-s="${s}" data-dur="${dur}">${geo.lines.map((d,k)=>`<path class="ln l${k}" d="${d}"/>`).join("")}${notes}</g>`;
  }
  /* PC 用（横長）とスマホ用（幅をせまく）の2枚を描き、CSS で片方だけ出す */
  function staffSvg(n, rev, RW, RH, A, cls, nF, durF, durB){
    const wave = (c, a, per, ph) => { const k = 2*Math.PI*per/RW; return {c, a, k, ph, f: x => c + a*Math.sin(k*x+ph), d: x => a*k*Math.cos(k*x+ph)}; };
    const sg = rev ? -1 : 1;
    const WF = wave(RH/2, sg*A*.92, .78, .35), WB = wave(RH/2 - A*.3, sg*A*.6, 1.12, 2.3);
    const front = staffGeo(WF.f, 12, rev, RW), back = staffGeo(WB.f, 6.5, rev, RW);
    return `<svg class="staffs ${cls}" viewBox="0 0 ${RW} ${RH}" preserveAspectRatio="xMidYMid slice" focusable="false" data-rw="${RW}" data-rev="${rev?1:0}">
      ${staffLayer("st-back", back, BACK.slice(0, Math.ceil(nF*.65)), .54, durB, rev, WB, 6.5, RW)}
      ${staffLayer("st-front", front, FRONT.slice(0, nF), 1, durF, rev, WF, 12, RW)}
      <path class="hit" d="${front.center}"/></svg>`;
  }
  const band = (words, rev) => { const n = ++rbN;
    return `<div class="ribbon wave${rev?" rev":""}" aria-hidden="true">${staffSvg(n, rev, 1440, 240, 54, "pc", 14, 48, 78)}${staffSvg(n, rev, 620, 200, 50, "sp", 8, 26, 44)}</div>`; };

  const bookModal = D.booking && !D.yoyaku ? `<div class="bk" id="bk" hidden role="dialog" aria-modal="true" aria-label="体験レッスンの予約"><div class="bk-in"><div class="bk-top"><b>体験レッスンの予約</b><button class="x" type="button" data-book-close aria-label="閉じる">×</button></div><iframe title="体験レッスンの予約カレンダー" data-src="${esc(D.bookingEmbed)}" loading="lazy"></iframe><a class="small" href="${esc(D.booking)}" target="_blank" rel="noopener">うまく表示されないときは、こちらから予約ページを開いてください</a></div></div>` : "";
  const main = hero()+band(["Guitar","Compose","Arrange","Live Support"])+profile()+career()+works()+band(["Lesson","Beginner","Online","Pro"],true)+lessonTeaser()+contact()+bookModal;
  const lessonMain = lessonHero()+lesson("01", true);

  const url = p.siteUrl;
  const meta = `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${url}${IMG.ogp}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="ギターを弾く北川弘喜。書けるギタリスト、弾ける作曲家。">`;
  /* 2026-10-28：Google 向けの説明（目に見えない）。トップ＝人（北川弘喜）とサイトの名前、レッスンのページ＝レッスンの中身（場所・料金・受付時間）。
     料金は site.json、受付時間は yoyaku の予約枠（水木金 16〜23時・土日 12〜23時）と同じ */
  const ld = {"@context":"https://schema.org","@type":"Person","@id":url+"#person","name":p.name,"image":url+IMG.ogp,"alternateName":p.nameEn,"jobTitle":["ギタリスト","作曲家","編曲家","ギター講師"],
    "description":"書けるギタリスト、弾ける作曲家。ライブ・舞台・TVのサポートギター、作詞・作曲・編曲、ギターレッスン。","address":{"@type":"PostalAddress","addressRegion":"東京都","addressLocality":"江戸川区"},
    "url":url,"sameAs":["instagram","tiktok","x","youtube","spotify"].map(k => p.links[k]).filter(Boolean)};
  /* サイトの名前（Google の検索結果で、URL の上に出る名前） */
  const ldSite = {"@context":"https://schema.org","@type":"WebSite","name":"北川弘喜 Koki Kitagawa","alternateName":["北川弘喜","Koki Kitagawa","KOKI KITAGAWA"],"url":url,"inLanguage":"ja"};
  const HOURS = [[["Wednesday","Thursday","Friday"],"16:00"],[["Saturday","Sunday"],"12:00"]].map(([d,o]) => ({"@type":"OpeningHoursSpecification","dayOfWeek":d,"opens":o,"closes":"23:00"}));
  const ldLesson = {"@context":"https://schema.org","@type":"Service","name":"北川弘喜のギターレッスン（小岩・オンライン）","serviceType":"ギターレッスン",
    "description":`ギタリスト・作曲家 北川弘喜のギターレッスン。JR小岩駅近くのスタジオ（サウンドスタジオM小岩店）とオンライン（Google Meet）で、初心者からプロを目指す方まで。3歳から受けられます。体験レッスン60分 ${yen(site.lessonPlans.trial.price)}円。`,
    "image":url+IMG.ogpLesson,"provider":{"@type":"Person","@id":url+"#person","name":p.name,"url":url},"hoursAvailable":HOURS,"areaServed":[{"@type":"Place","name":"東京都江戸川区 小岩"},{"@type":"Place","name":"オンライン"}],
    "availableChannel":{"@type":"ServiceChannel","serviceLocation":{"@type":"Place","name":"サウンドスタジオM小岩店","address":{"@type":"PostalAddress","addressRegion":"東京都","addressLocality":"江戸川区","streetAddress":"西小岩1-27-16 オルフェウスビル4F"}}},
    "offers":[{"@type":"Offer","name":"体験レッスン（60分）","price":site.lessonPlans.trial.price,"priceCurrency":"JPY"},{"@type":"Offer","name":"単発レッスン（60分）","price":site.lessonPlans.single.price,"priceCurrency":"JPY"},
      ...site.lessonPlans.monthly.map(m => ({"@type":"Offer","name":`月謝 ${m.name}（1回60分）`,"price":m.price,"priceCurrency":"JPY",
        "priceSpecification":{"@type":"UnitPriceSpecification","price":m.price,"priceCurrency":"JPY","unitText":"月","referenceQuantity":{"@type":"QuantitativeValue","value":1,"unitCode":"MON"}}}))],
    "url":url+"lesson.html"};
  const cfg = JSON.stringify({form: site.form}).replace(/</g,"\\u003c");

  function assemble(mainHTML, page){
  let html = files["src/template.html"];
  for(const f of ASSETS) html = html.split(`"${f}"`).join(`"${f}?v=${stamp(files[f])}"`);
  const put = (mark, val) => { if(!html.includes(mark)) warnings.push("差込口が見つかりません: " + mark); html = html.split(mark).join(val); };
  put("<!--@meta-->", meta);
  put("<!--@jsonld-->", (page==="lesson" ? [ldLesson] : [ld, ldSite]).map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g,"\\u003c")}</script>`).join("\n"));
  put("<!--@phstyle-->", phStyle);
  put("<!--@main-->", mainHTML);
  /* 予約ページがあるときは、上・下・メニューの「レッスンを申し込む」も予約カレンダーを開く（はじめての人の入口は体験レッスンなので） */
  /* 2026-10-25：スマホは公式LINE から予約するのを一番に（友だち追加すると、すぐ予約のボタンが届く）。PC は予約ページのまま */
  const LES_BTN = '<button class="btn or" type="button" data-open="レッスン">レッスンを申し込む</button>';
  if(page === "lesson"){
    /* レッスンのページ：上・下・メニューの申し込みは、スマホ＝LINE、PC＝予約ページ。お仕事のボタンはトップのフォームへ */
    if(D.yoyaku) html = html.split('<button class="btn or" type="button" data-open="レッスン">レッスンを申し込む</button>').join('<a class="btn or' + (D.lineAdd ? ' only-pc' : '') + '" href="yoyaku.html">体験レッスンを予約</a>'
    + (D.lineAdd ? `<a class="btn or ln-btn only-sp" href="${esc(D.lineAdd)}" target="_blank" rel="noopener">${LINE_ICON}LINEで体験予約</a>` : ''));
    else if(D.booking) html = html.split('data-open="レッスン">レッスンを申し込む').join('data-book>体験レッスンを予約');
    html = html.split('<button class="btn gr sm" type="button" data-open="お仕事">仕事を依頼する</button>').join(D.yoyaku ? '<a class="btn or sm only-pc" href="yoyaku.html">体験レッスンを予約</a>' : '');
    html = html.split('<button class="btn gr" type="button" data-open="お仕事">お仕事依頼</button>').join('');
    html = html.split('<button class="btn gr" type="button" data-open="お仕事">仕事を依頼する</button>').join('<a class="btn gr" href="./#contact">仕事を依頼する</a>');
    for(const id of ["profile","career","works","contact"]) html = html.split(`href="#${id}"`).join(`href="./#${id}"`);
    html = html.replace(/<title>[^<]*<\/title>/, "<title>ギターレッスン（小岩・オンライン）| 北川弘喜 Koki Kitagawa</title>")
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="ギタリスト・作曲家 北川弘喜のギターレッスン。JR小岩駅近くのスタジオとオンラインで、初心者からプロを目指す方まで。体験レッスン60分 ${yen(D.lessonPlans.trial.price)}円。">`)
      .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="北川弘喜のギターレッスン（小岩・オンライン）">')
      /* 2026-10-27：LINE などで送ったときの画像は、レッスン用（tools/make-share-images.py で書き出す） */
      .split(`${url}${IMG.ogp}`).join(`${url}${IMG.ogpLesson}`)
      .replace(/<meta property="og:image:alt" content="[^"]*">/, '<meta property="og:image:alt" content="ギターを持つ北川弘喜。北川弘喜のギターレッスン、体験レッスン60分。">')
      .split(`content="${url}"`).join(`content="${url}lesson.html"`).split(`href="${url}"`).join(`href="${url}lesson.html"`);
  } else {
    /* トップ：レッスンの入口は、レッスンのページへ */
    html = html.split(LES_BTN).join('<a class="btn or" href="lesson.html">ギターレッスン</a>');
    html = html.split('href="#lesson"').join('href="lesson.html"');
  }
  put("<!--@sns-->", snsHTML());
  put("<!--@config-->", cfg);
  /* 限定公開（2026-10-21）：data/site.json の noindex が true のあいだは、検索に出さない（URLを知っている人は見られる） */
  if(site.noindex) html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
  for(const bad of ["undefined","null</","NaN"]) if(mainHTML.includes(bad)) warnings.push("本文に " + bad + " が出ています。データを確かめてください");
  if(mainHTML.includes("要確認")) warnings.push("「要確認」が画面に出ています");
  return html;
  }
  const html = assemble(main, "top"), lessonHtml = assemble(lessonMain, "lesson");
  const ga = /^G-[A-Z0-9]+$/.test(site.ga || "") ? site.ga : "";
  if(site.ga && !ga) warnings.push("site.json の ga が G- ではじまる形ではありません: " + site.ga);
  const out = {"index.html": html, "lesson.html": lessonHtml, "privacy.html": privacyPage(files, p, url, {video: !!ytId(D.video.youtube), booking: !!D.booking, yoyaku: D.yoyaku, ga: !!ga}), "404.html": notFoundPage(files, url, !!D.booking), "yoyaku.html": yoyakuPage(files, p, site, url), "seito.html": seitoPage(files, p, site, url)};
  /* 2026-10-27：Google アナリティクス（来た人の数・LINE や予約のボタンが押された数）。北川くんの OK で「よそのプログラムを読み込まない」の例外。
     URL の ?k=（生徒さんの鍵）・?l=（LINE の合言葉）を Google に送らないよう、アドレスは ? より前だけにする。生徒さん専用ページには入れない */
  for(const f of Object.keys(out)) out[f] = addWbr(out[f]);   /* 2026-10-28：ことばの途中で改行しない */
  if(ga) for(const f of Object.keys(out)) if(f !== "seito.html") out[f] = out[f].replace("</head>", gaTag(ga) + "\n</head>");
  return { files: out, warnings };
}

/* Google アナリティクスの読み込み。押された数を数えるボタン：LINE（line_click）・予約ページへ（booking_page_click）・レッスンのページへ（lesson_page_click） */
function gaTag(id){
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${id}",{page_location:location.origin+location.pathname,page_referrer:document.referrer.split("?")[0]});
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href")||"",w=location.pathname;if(/line\\.me/.test(h))gtag("event","line_click",{place:w});else if(/yoyaku\\.html/.test(h))gtag("event","booking_page_click",{place:w});else if(/lesson\\.html/.test(h))gtag("event","lesson_page_click",{place:w});},true);</script>`;
}

/* プライバシーポリシー（privacy.html）。トップと同じCSSを使う */
function privacyPage(files, p, url, ext = {}){
  const css = ["assets/css/kk-design-system.css","assets/css/site.css"].map(f => `<link rel="stylesheet" href="${f}?v=${stamp(files[f])}">`).join("\n");
  const S = [
    ["運営者", `このサイト（${url}）は、ギタリスト・作曲家の ${p.name}（${p.nameEn}）が個人で運営しています。`],
    ["お預かりする情報", ext.yoyaku ? "お問い合わせフォームと体験レッスンの予約ページに入力いただいた、お名前・メールアドレス・電話番号・ご用件・メッセージなどの内容です。" : "お問い合わせフォームに入力いただいた、お名前・メールアドレス・ご用件・メッセージなどの内容です。"],
    ["使い道", "お問い合わせへの返信と、レッスン・お仕事のご連絡のためだけに使います。それ以外の目的には使いません。"],
    ["保管のしかた", "フォームの内容は Google フォーム（Google LLC のサービス）を通じて受け取り、Google のスプレッドシートに保存します。" + (ext.yoyaku ? "予約ページの内容は、Google のサービス（Apps Script・カレンダー・スプレッドシート）で受け取り、保存します。" : "")],
    ["第三者への提供", "法令にもとづく場合を除き、ご本人の同意なく第三者に渡すことはありません。"],
    ["外部のサービス", `楽曲の再生に Spotify の埋め込みプレーヤーを${ext.video ? "、動画の再生に YouTube を" : ""}${ext.yoyaku ? "" : ext.booking ? "、レッスンの予約に Google カレンダーの予約ページを" : ""}、文字の表示に Google Fonts を使っています。これらのサービスが、それぞれの方針にもとづいて閲覧の情報を扱うことがあります。`],
    ...(ext.ga ? [["アクセス解析", "サイトの使われ方を知るために、Google アナリティクス（Google LLC のサービス）を使っています。Cookie を使って、見たページ・押したボタン・おおよその地域などの情報を集めますが、お名前など個人を特定する情報は含みません。集めた情報は Google の方針にもとづいて扱われます。ブラウザの設定で Cookie をオフにするか、Google が配っている「Google アナリティクス オプトアウト アドオン」を使うと、集められないようにできます。"]] : []),
    ["確認・削除のご依頼", "お預かりした情報の確認や削除をご希望のときは、お問い合わせフォームまたは Instagram の DM からご連絡ください。"],
    ["改定", "内容を変えるときは、このページでお知らせします。"]
  ];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#06080d">
<title>プライバシーポリシー | 北川弘喜 Koki Kitagawa</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}privacy.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
${HEAD_ICONS("")}
${css}
</head>
<body class="doc">
<header class="hd solid"><div class="wrap"><a class="logo" href="./">KOKI KITAGAWA<small>GUITARIST / COMPOSER</small></a></div></header>
<main class="wrap docw">
  <div class="sh"><span class="no">—</span><h2>Privacy</h2><p>プライバシーポリシー</p></div>
  ${S.map(([h,t]) => `<section class="dsec"><h3>${esc(h)}</h3><p>${esc(t)}</p></section>`).join("\n  ")}
  <p class="small">2026年10月14日 制定</p>
  <p><a class="btn line" href="./">トップへ戻る</a></p>
</main>
</body>
</html>
`;
}

/* タブ・ホーム画面のアイコン（トップ以外のページ用）。base は置き場所の頭（404 は どの階層でも出るので本番URL） */
const HEAD_ICONS = base => `<link rel="icon" href="${base}assets/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">`;

/* ページが見つからないとき（404.html）。GitHub Pages は、無いURLを開いた人にこのページを出す。
   どの階層のURLでも崩れないように、CSS・リンクは本番URLから書く */
function notFoundPage(files, url, booking){
  const css = ["assets/css/kk-design-system.css","assets/css/site.css"].map(f => `<link rel="stylesheet" href="${url}${f}?v=${stamp(files[f])}">`).join("\n");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#06080d">
<title>ページが見つかりません | 北川弘喜 Koki Kitagawa</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
${HEAD_ICONS(url)}
${css}
</head>
<body class="doc">
<header class="hd solid"><div class="wrap"><a class="logo" href="${url}">KOKI KITAGAWA<small>GUITARIST / COMPOSER</small></a></div></header>
<main class="wrap docw nf">
  <div class="sh"><span class="no">404</span><h2>Not Found</h2><p>ページが見つかりませんでした</p></div>
  <p class="nf-lead">お探しのページは、URLが変わったか、なくなった可能性があります。<br>お手数ですが、トップページからお探しください。</p>
  <div class="nf-btns">
    <a class="btn line" href="${url}">トップへ戻る</a>
    <a class="btn or" href="${url}lesson.html">${booking ? "体験レッスンを見る" : "レッスンを見る"}</a>
    <a class="btn gr" href="${url}#contact">お問い合わせ</a>
  </div>
</main>
</body>
</html>
`;
}

/* 公式LINE のアイコン（白い吹き出し） */
const LINE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c-5.2 0-9.4 3.4-9.4 7.6 0 3.8 3.4 6.9 7.9 7.5.3.1.7.2.8.5.1.2.1.6 0 .9l-.1.8c0 .2-.2.9.8.5s5.4-3.2 7.4-5.4c1.4-1.5 2-3.1 2-4.8 0-4.2-4.2-7.6-9.4-7.6z" fill="#fff"/><path d="M7 9.2v3.6h2.2M10.6 9.2v3.6M12.6 12.8V9.2l2.6 3.6V9.2M18.6 9.2h-2.1v3.6h2.1M16.5 11h2" fill="none" stroke="#06c755" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* 体験レッスンの予約ページ（yoyaku.html）。見た目はトップと同じCSS、空き枠と予約は Googleカレンダー（Apps Script）とつなぐ。
   data/site.json の booking.api に Apps Script の URL が入るまでは「準備中」と出る（?demo=1 を付けると見本の空き枠で動きを見られる） */
export function yoyakuPage(files, p, site, url){
  const L = p.lesson, B = site.booking || {};
  const css = ["assets/css/kk-design-system.css","assets/css/site.css"].map(f => `<link rel="stylesheet" href="${f}?v=${stamp(files[f])}">`).join("\n");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const yen = n => Number(n).toLocaleString("ja-JP");
  const pay = (L.payment||[]).filter(x => /^体験/.test(x[0]));
  const planNames = [...site.lessonPlans.monthly.map(m => m.name), "単発"];
  const cfg = JSON.stringify({api: B.api || "", fallback: B.url || "", plans: planNames, line: B.lineChat || ""}).replace(/</g,"\\u003c");
  const opt = (name, type, list) => list.map(x => `<label class="opt"><input type="${type}" name="${name}" value="${esc(x)}"><span>${esc(x)}</span></label>`).join("");
  const sel = list => `<option value="">選んでください</option>` + list.map(x => `<option>${esc(x)}</option>`).join("");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">${site.noindex ? `\n<meta name="robots" content="noindex, nofollow">` : ""}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#06080d">
<title>体験レッスンのご予約 | 北川弘喜 ギターレッスン（小岩・オンライン）</title>
<meta name="description" content="北川弘喜のギター体験レッスン（60分 ${yen(site.lessonPlans.trial.price)}円）のご予約ページ。小岩のスタジオかオンラインを選んで、空いている日時から申し込めます。">
<link rel="canonical" href="${url}yoyaku.html">
<meta property="og:type" content="website">
<meta property="og:title" content="体験レッスンのご予約 | 北川弘喜">
<meta property="og:url" content="${url}yoyaku.html">
<meta property="og:image" content="${url}${JSON.parse(files["data/images.json"]).paths.ogpLesson}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
${HEAD_ICONS("")}
${css}
</head>
<body class="doc yk-page">
<header class="hd solid"><div class="wrap"><a class="logo" href="./">KOKI KITAGAWA<small>GUITARIST / COMPOSER</small></a><a class="yk-back" href="lesson.html">← 戻る</a></div></header>
<main class="wrap docw ykw">
  <div class="sh"><span class="no">—</span><h2>Booking</h2><p>体験レッスンのご予約</p></div>

  <div class="card yk-trial"><div><span class="chip or">FIRST</span><b>体験レッスン</b><small>初回のみ・60分・スタジオで受ける場合は、ギターを借りられます</small></div><div class="p">¥${yen(site.lessonPlans.trial.price)}<small>税込</small></div></div>
  <p class="yk-plan" id="ykPlan" hidden></p>
  <p class="yk-plan" id="ykLine" hidden></p>
  ${B.lineAdd ? `<a class="dm ln yk-ln" id="ykLineAdd" href="${esc(B.lineAdd)}" target="_blank" rel="noopener"><i>${LINE_ICON}</i><span><b>LINE からも予約できます</b><small>公式LINE を友だち追加して、メニューの「体験レッスンを予約」から。メールの確認なしで決まり、お知らせも LINE に届きます</small></span><em class="ln-add">友だち追加</em></a>` : ""}
  <ol class="yk-steps" aria-hidden="true"><li data-st="1"><span>1</span>受け方</li><li data-st="2"><span>2</span>日時</li><li data-st="3"><span>3</span>お名前など</li></ol>

  <div class="card yk-closed" id="ykClosed" hidden>
    <b>予約ページは、まもなく使えるようになります</b>
    <small>いまは、下のどちらかからお申し込みください。</small>
    <div class="nf-btns">${B.url ? `<a class="btn or" href="${esc(B.url)}" target="_blank" rel="noopener">予約カレンダーを開く</a>` : ""}<a class="btn line" href="./#contact">お問い合わせフォーム</a></div>
  </div>

  <form class="f yk" id="yk" novalidate>
    <fieldset class="kinds yk-mode"><legend><span class="yn">1</span>受け方を選んでください<i>必須</i></legend>
      <label class="kc or"><input type="radio" name="mode" value="studio"><span><b>小岩のスタジオ</b><small>サウンドスタジオM小岩店（JR小岩駅から約4分）<br>お部屋は前の日に北川が予約します（小岩が空いていないときは、亀戸・平井などの近くのスタジオ。どこも取れなければ、オンラインか別の日を選べます）<br>スタジオ代：1時間 約1,500円（当日スタジオで）</small></span></label>
      <label class="kc"><input type="radio" name="mode" value="online"><span><b>オンライン</b><small>Google Meet・スタジオ代なし</small></span></label>
      <p class="err" hidden></p>
    </fieldset>

    <div class="yk-when" id="ykWhen">
      <div class="yk-lg"><span class="yn">2</span>日時を選んでください<i id="ykHint">先に、受け方を選んでください</i></div>
      <p class="small yk-lead">スタジオは2日後から、オンラインは翌日から選べます。</p>
      <p class="small" id="ykLoad" hidden>空いている日時を読み込んでいます…</p>
      <p class="yk-now" id="ykNow" hidden aria-live="polite"></p>
      <div class="yk-days" id="ykDays" role="tablist" aria-label="日付"></div>
      <div class="yk-times" id="ykTimes"></div>
      <ol class="yk-picked" id="ykPicked"></ol>
      <p class="err" id="ykWhenErr" hidden></p>
    </div>

    <div class="yk-info">
      <div class="yk-lg"><span class="yn">3</span>お名前など</div>
      <div class="two">
        <div><label for="y_name">お名前<i>必須</i></label><input id="y_name" autocomplete="name"><p class="err" hidden></p></div>
        <div><label for="y_kana">ふりがな</label><input id="y_kana"></div>
      </div>
      <div class="two">
        <div><label for="y_mail">メールアドレス<i>必須</i></label><input id="y_mail" type="email" inputmode="email" autocomplete="email"><p class="yk-sug" id="ykSug" hidden aria-live="polite"></p><p class="err" hidden></p></div>
        <div><label for="y_tel">電話番号</label><input id="y_tel" type="tel" inputmode="tel" autocomplete="tel"></div>
      </div>
      <div class="two">
        <div><label for="y_age">レッスンを受ける方</label><select id="y_age">${sel(["大人","高校生","中学生","小学生","小学生より小さいお子さん"])}</select></div>
        <div><label for="y_level">ギター歴</label><select id="y_level">${sel(["はじめて","1年未満","1〜3年","3年以上"])}</select></div>
      </div>
      <fieldset class="opts"><legend>ギター</legend>${opt("guitar","radio",["アコースティック","エレキ","クラシック","持っていない"])}</fieldset>
      <fieldset class="opts"><legend>どうなりたいですか<i>いくつでもOK</i></legend>${opt("goals","checkbox",["好きな曲を弾けるようになりたい","基礎からしっかり","弾き語りがしたい","バンドで弾きたい","作曲・アレンジも学びたい","プロを目指したい","趣味で楽しく"])}</fieldset>
      <div><label for="y_song">弾きたい曲・好きなアーティスト</label><input id="y_song" placeholder="例：〇〇の「△△」"></div>
      <div><label for="y_q">ご質問・ご要望</label><textarea id="y_q" class="sm" placeholder="気になることがあれば、なんでも"></textarea></div>
      <div><label for="y_from">このページを何で知りましたか</label><select id="y_from">${sel(["Instagram","TikTok","YouTube","X","Google検索","Googleマップ","知り合いの紹介","その他"])}</select></div>
    </div>
    <input type="text" name="website" id="y_web" tabindex="-1" autocomplete="off" class="sr" aria-hidden="true">

    <div class="yk-sum" id="ykSum" hidden></div>
    <dl class="yk-brief" aria-label="申し込む前に">
      <dt>料金</dt><dd>体験レッスン 60分 ¥${yen(site.lessonPlans.trial.price)}（税込）</dd>
      <dt>スタジオ代</dt><dd>スタジオは1時間 約1,500円（当日スタジオで）／オンラインはなし</dd>
      <dt>お支払い</dt><dd>スタジオ：現金・PayPay（当日レッスンの前に）／オンライン：カード（前日まで）</dd>
      <dt>キャンセル</dt><dd>3日前 23:59 まではURLから無料。それより後もキャンセル料はかかりません</dd>
    </dl>
    <p class="note">送信すると、<a href="privacy.html">プライバシーポリシー</a>に同意したものとします。</p>
    <button class="btn or send" type="submit" id="ykSend">この内容で申し込む</button>
    <p class="err" id="ykErr" hidden></p>
  </form>

  <div class="card yk-done" id="ykDone" hidden role="status" tabindex="-1"></div>

  <section class="yk-notes">
    <h3>ご案内</h3>
    <table class="hours">
      <tr><th>料金</th><td>体験レッスン 60分 ¥${yen(site.lessonPlans.trial.price)}（税込・初回のみ）</td></tr>
      <tr><th>場所</th><td>${esc(L.place)}<small><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent("サウンドスタジオM小岩店")}" target="_blank" rel="noopener">スタジオの地図を見る</a></small></td></tr>
      <tr><th>スタジオ代</th><td>${esc(L.studioFee)}</td></tr>
      <tr><th>お支払い</th><td>${pay.map(x => `<span class="pay"><b>${esc(x[0].replace(/^体験/, "").replace(/[（）]/g, ""))}</b>${esc(x[1])}</span>`).join("")}</td></tr>
      <tr><th>ギター</th><td>${esc(L.guitarRental)}</td></tr>
      <tr><th>お子さん</th><td>${esc(L.ages)}</td></tr>
      <tr><th>キャンセル</th><td>${esc(L.trialCancel)}</td></tr>
      <tr><th>そのあと</th><td>${esc(L.noPush)}</td></tr>
    </table>
  </section>
</main>
<footer class="yk-ft"><div class="wrap"><small>© 2026 Koki Kitagawa　<a href="./">トップへ</a>　<a href="privacy.html">プライバシーポリシー</a></small></div></footer>
<script type="application/json" id="ykcfg">${cfg}</script>
<script src="assets/js/yoyaku.js?v=${stamp(files["assets/js/yoyaku.js"])}" defer></script>
</body>
</html>
`;
}

/* 生徒さん専用の予約ページ（seito.html?k=合言葉）。月謝の回数の分＋追加の単発を、体験と同じ空き枠から予約する。
   検索には出さない・HPからはリンクしない（URLは北川くんが生徒さんにメールで送る）。?demo=1 で見本の動きを見られる */
export function seitoPage(files, p, site, url){
  const L = p.lesson, B = site.booking || {};
  const css = ["assets/css/kk-design-system.css","assets/css/site.css"].map(f => `<link rel="stylesheet" href="${f}?v=${stamp(files[f])}">`).join("\n");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const yen = n => Number(n).toLocaleString("ja-JP");
  const pay = (L.payment||[]).filter(x => /^(月謝|単発)/.test(x[0]));
  const cfg = JSON.stringify({api: B.api || "", single: site.lessonPlans.single.price}).replace(/</g,"\\u003c");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#06080d">
<title>レッスンのご予約（生徒さん専用） | 北川弘喜</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
${HEAD_ICONS("")}
${css}
</head>
<body class="doc yk-page sk-page">
<header class="hd solid"><div class="wrap"><a class="logo" href="./">KOKI KITAGAWA<small>GUITARIST / COMPOSER</small></a><span class="yk-back">生徒さん専用</span></div></header>
<main class="wrap docw ykw">
  <div class="sh"><span class="no">—</span><h2>Lesson</h2><p>レッスンのご予約</p></div>

  <p class="small" id="skLoad">読み込んでいます…</p>
  <div class="card yk-closed" id="skBad" hidden>
    <b id="skBadT">このページは、生徒さん専用です</b>
    <small id="skBadM">北川から届いた LINE（またはメール）のURLから開いてください。</small>
    <div class="nf-btns"><a class="btn line" href="yoyaku.html">体験レッスンの予約はこちら</a></div>
  </div>

  <div id="skMain" hidden>
    <div class="card sk-me">
      <div class="sk-hi"><span class="chip or" id="skPlan"></span><b id="skName"></b></div>
      <div class="sk-months" id="skMonths"></div>
      <p class="sk-out" id="skOut" hidden><b>今月の回数は、おしまいです。</b>追加の単発レッスン（60分 ¥${yen(site.lessonPlans.single.price)}）なら、このまま予約できます。<button type="button" class="btn line sm" id="skMore">追加で単発レッスンを予約する</button></p>
    </div>

    <section class="sk-list" id="skListW" hidden>
      <div class="yk-lg">予約中のレッスン</div>
      <ol class="yk-picked sk-lessons" id="skList"></ol>
    </section>

    <form class="f yk" id="yk" novalidate>
      <fieldset class="kinds yk-mode"><legend><span class="yn">1</span>受け方を選んでください<i>必須</i></legend>
        <label class="kc or"><input type="radio" name="mode" value="studio"><span><b>小岩のスタジオ</b><small>サウンドスタジオM小岩店<br>選んだ日で、その場で予約が決まります<br>お部屋は前の日に北川が予約します（小岩が空いていないときは、亀戸・平井などの近くのスタジオ。どこも取れなければ、オンラインか別の日を選べます。回数は減りません）<br>スタジオ代：1時間 約1,500円（当日スタジオで）</small></span></label>
        <label class="kc"><input type="radio" name="mode" value="online"><span><b>オンライン</b><small>Google Meet・スタジオ代なし<br>その場で予約が決まります</small></span></label>
        <p class="err" hidden></p>
      </fieldset>

      <fieldset class="opts sk-hours"><legend><span class="yn">2</span>続けて何時間受けますか<i>1時間＝1回</i></legend><span id="skHours"></span></fieldset>

      <div class="yk-when" id="ykWhen">
        <div class="yk-lg"><span class="yn">3</span>日時を選んでください（何日でも）<i id="ykHint">先に、受け方を選んでください</i></div>
        <p class="small yk-lead">受けたい日を、いくつでも選べます。まとめて1回で予約できます。スタジオは2日後から、オンラインは翌日から、来月の終わりまで選べます。出ているのは、選んだ時間だけ続けて空いている時間です。</p>
        <p class="yk-now" id="ykNow" hidden aria-live="polite"></p>
        <div class="yk-days" id="ykDays" role="tablist" aria-label="日付"></div>
        <div class="yk-times" id="ykTimes"></div>
        <ol class="yk-picked" id="ykPicked"></ol>
        <p class="err" id="ykWhenErr" hidden></p>
      </div>

      <div class="sk-split" id="skSplit" hidden aria-live="polite"></div>
      <label class="sk-ok" id="skOkW" hidden><input type="checkbox" id="skOk"><span>追加（単発）のレッスンとして申し込みます</span></label>
      <p class="err" id="skOkErr" hidden></p>

      <div><label for="y_q">練習したい曲・伝えたいこと<i class="opt-i">なくても大丈夫です</i></label><textarea id="y_q" class="sm" placeholder="例：〇〇の「△△」のソロ"></textarea></div>

      <dl class="yk-brief" aria-label="申し込む前に">
        <dt>キャンセル</dt><dd>3日前 23:59 まではこのページから無料。キャンセルした回は次の月まで使えます。それより後は1回分</dd>
        <dt>月の回数</dt><dd>使わなかった回は、次の月まで使えます（キャンセルしなくても来月に回せます）</dd>
        <dt>追加（単発）</dt><dd>回数を使い切ったあとは、1回 ¥${yen(site.lessonPlans.single.price)}（税込）</dd>
        <dt>スタジオ代</dt><dd>1時間 約1,500円（当日スタジオで）／オンラインはなし</dd>
      </dl>
      <button class="btn or send" type="submit" id="ykSend">この内容で申し込む</button>
      <p class="err" id="ykErr" hidden></p>
    </form>

    <div class="card yk-done" id="ykDone" hidden role="status" tabindex="-1"></div>

    <section class="yk-notes">
      <h3>ご案内</h3>
      <table class="hours">
        <tr><th>場所</th><td>${esc(L.place)}<small><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent("サウンドスタジオM小岩店")}" target="_blank" rel="noopener">スタジオの地図を見る</a></small></td></tr>
        <tr><th>スタジオ代</th><td>${esc(L.studioFee)}</td></tr>
        <tr><th>お支払い</th><td>${pay.map(x => `<span class="pay"><b>${esc(x[0])}</b>${esc(x[1])}</span>`).join("")}</td></tr>
        <tr><th>キャンセル</th><td>${esc(L.cancel)}</td></tr>
        <tr><th>振替</th><td>その月に使わなかった回（予約しなかった回・3日前 23:59 までにキャンセルした回・スタジオのお部屋が取れなかった回）は、次の月まで使えます。たとえば月4回なら、今月2回・来月6回にできます。その次の月へは持ち越せません。追加（単発）の回は、次の月には回りません。</td></tr>
        <tr><th>追加（単発）</th><td>月の回数を使い切ったあとも、1回 ¥${yen(site.lessonPlans.single.price)}（税込・60分）で予約できます。</td></tr>
      </table>
    </section>
  </div>
</main>
<footer class="yk-ft"><div class="wrap"><small>© 2026 Koki Kitagawa　<a href="./">トップへ</a>　<a href="privacy.html">プライバシーポリシー</a></small></div></footer>
<script type="application/json" id="ykcfg">${cfg}</script>
<script src="assets/js/seito.js?v=${stamp(files["assets/js/seito.js"])}" defer></script>
</body>
</html>
`;
}
