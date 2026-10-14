/* ============================================================
   render.mjs — data/*.json ＋ src/template.html → index.html の中身
   入出力を持たない（読み書きは build.mjs / tools/build.jsc.mjs がやる）。
   ページの文章・カードはすべてここで組み立てて、静的な HTML として書き出す。
   ボタンの動き（絞り込み・メニュー・フォーム送信など）は assets/js/main.js。
   ============================================================ */
export const ROOT_FILES = ["src/template.html","data/profile.json","data/credits.json","data/live.json","data/media.json","data/site.json","data/images.json"];

export function buildOutputs(files){
  const J = k => JSON.parse(files[k]);
  const p = J("data/profile.json"), site = J("data/site.json"), images = J("data/images.json");
  const pick = (o, ks) => Object.fromEntries(ks.map(k => [k, o[k] ?? null]));
  const D = {
    profile: pick(p, ["name","nameEn","bio","career","gear","work","lesson","links"]),
    credits: J("data/credits.json").map(c => { const d = pick(c, ["title","artist","category","roles","year","jacket","spotify","spotifyRank"]);
      return c.category === "karaoke" ? Object.assign(d, {title:"非公開", artist:"有名歌い手"}) : d; }),   // カラオケは作品名を出さない
    live: J("data/live.json").map(x => pick(x, ["title","year","venue","artist","role"])),
    media: J("data/media.json").map(x => { const d = pick(x, ["title","year","artist","role","type"]); if(String(d.role).includes("要確認")) d.role = ""; return d; }),
    lessonPlans: site.lessonPlans, lessonStats: site.lessonStats, timeline: site.timeline, liveYears: site.liveYears
  };
  const IMG = images.paths, ICON = site.icons;
  const warnings = [];

  const P = D.profile, C = D.credits;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
  const SNS = [["instagram","ig","Instagram"],["tiktok","tt","TikTok"],["x","x","X"],["youtube","yt","YouTube"],["spotify","sp","Spotify"]];
  const snsHTML = () => SNS.map(([k,i,n]) => `<a href="${P.links[k]}" target="_blank" rel="noopener" aria-label="${n}">${svg(i)}</a>`).join("");
  const pic = (k, alt, cls="") => `<img src="${IMG[k]}" alt="${esc(alt)}" loading="lazy" decoding="async" class="${cls}">`;
  const swipe = k => `<div class="swipe" aria-hidden="true"><span>横にスワイプ</span><span class="dots">${Array.from({length:k},(_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</span></div>`;
  const sh = (no, en, jp) => `<div class="sh"><span class="no">${no}</span><h2>${en}</h2><p>${jp}</p></div>`;
  const yen = n => n.toLocaleString("ja-JP");

  const comp = C.filter(c => c.category==="compose"), gtr = C.filter(c => c.category==="guitar"), kara = C.filter(c => c.category==="karaoke");
  const feat = C.filter(c => c.spotify).sort((a,b) => (a.spotifyRank||9)-(b.spotifyRank||9));
  const TAG = {"作曲":"COMPOSE","編曲":"ARRANGE","ギター":"GUITAR","レコーディング":"RECORDING","制作":"PRODUCTION"};
  const tagsOf = c => [...new Set((c.roles||[]).map(r => TAG[r]).filter(Boolean))];
  const tv = D.media.filter(m => m.type==="tv"), stage = D.media.filter(m => m.type==="stage");

  function hero(){
    return `<section class="hero" id="top" aria-label="北川弘喜">
      <picture><source media="(max-width:820px)" srcset="${IMG.heroSp}"><img src="${IMG.heroPc}" alt="紫の照明の中、ギターのネックを斜めに構えて弾く北川弘喜" fetchpriority="high"></picture>
      <div class="wrap">
        <p class="role">GUITARIST / COMPOSER</p>
        <h1><span>書けるギタリスト、</span><span>弾ける作曲家。</span></h1>
        <p class="name">KOKI KITAGAWA</p>
        <p class="lead">ライブ・舞台・テレビのサポートギターから、作詞・作曲・編曲まで。「弾く」と「作る」の両方で、プロの現場に立っています。</p>
        <div class="cta">
          <button class="btn gr" type="button" data-open="お仕事">仕事を依頼する</button>
          <button class="btn or" type="button" data-open="レッスン">レッスンを申し込む</button>
        </div>
        <ul class="proof"><li>SUMMER SONIC 2023</li><li>CDTV</li><li>B-PROJECT 楽曲提供</li></ul>
        <div class="nums"><div><b>${comp.length}<small>曲</small></b><span>楽曲提供</span></div><div><b>${gtr.length}<small>作品</small></b><span>ギター参加</span></div><div><b>${D.live.length+stage.length}<small>本</small></b><span>ステージ</span></div><div><b>${tv.length}<small>回</small></b><span>TV出演</span></div></div>
      </div>
    </section>`;
  }

  const yearOf = t => { const m = D.liveYears.find(([p]) => t.startsWith(p)); return m ? m[1] : null; };
  const PH = ["guitar","studio","lesson","stage","live","pedal","play","desk","hands","guitars"];
  const phStyle = `<style>${PH.filter(k=>IMG[k]).map(k=>`.ph-${k}::before{background-image:url("${IMG[k]}")}`).join("")}</style>`;
  const ph = k => `ph ph-${k}`;
  const chip = (t, cls="") => `<span class="chip ${cls}">${t}</span>`;

  function profile(){
    const g = P.gear.groups.map(x => `<li class="gcard"><b>${esc(x.name)}</b>${x.items.map(i=>`<span>${esc(i)}</span>`).join("")}</li>`).join("");
    const SK = [["GUITAR","サポートギター","フェス・ツアー・舞台・TVで演奏","live"],["COMPOSE","作詞・作曲・編曲","提供曲は作詞からギターまで一人で","studio"],["LESSON","ギターレッスン","初心者からプロ志向まで","hands"]];
    return `<section class="s" id="profile"><div class="wrap">
      ${sh("01","Profile","プロフィール・経歴")}
      <div class="prof">
        <div class="pw"><div class="photo reveal">${pic("profile","椅子に座ってギターを弾く北川弘喜")}</div><span class="bigword" aria-hidden="true">Guitarist</span></div>
        <div>
          <p class="lede">${esc(P.bio[0])}</p>
          <div class="body" style="margin:0 0 28px"><p>${esc(P.bio[1])}</p></div>
          <ul class="cards3">${SK.map(s=>`<li class="card ${ph(s[3])}"><span class="chip">${s[0]}</span><b>${s[1]}</b><small>${s[2]}</small></li>`).join("")}</ul>
          <ul class="cards3 mini">${P.career.map(c=>`<li class="card"><small>${esc(c.label)}</small><b>${esc(c.detail)}</b></li>`).join("")}</ul>
          <div class="sns">${snsHTML()}</div>
          <details class="acc open-card"><summary><b>プロフィールを詳しく読む</b></summary>
            <div class="in body"><p>アーティストのサポートギターから、作詞・作曲・編曲、カラオケ音源制作まで、「弾く」と「作る」の両面から音楽に携わる。</p>${P.bio.slice(2).map(p=>`<p>${esc(p)}</p>`).join("")}</div></details>
          <details class="acc open-card"><summary><b>使用機材</b><span class="meta">${P.gear.groups.reduce((n,g)=>n+g.items.length,0)} ITEMS</span></summary>
            <div class="in"><ul class="gcards">${g}</ul></div></details>
        </div>
      </div>
    </div></section>`;
  }

  function career(){
    const T = D.timeline;
    return `<section class="s" id="career"><div class="wrap">
      ${sh("02","Career","経歴・実績")}
      <ol class="career">${T.map(y => `<li class="yr"><div class="y">${y.year}</div><ul>${y.items.map(it=>`<li class="${it.key?"k":""}"><b>${esc(it.t)}</b>${it.s?`<span>${esc(it.s)}</span>`:""}</li>`).join("")}</ul></li>`).join("")}</ol>
      <p class="small" style="margin-top:22px">出演したライブ・舞台・テレビの一覧は <a href="#live" style="text-decoration:underline;text-underline-offset:4px">LIVE / TV</a> にまとめています。</p>
    </div></section>`;
  }

  function live(){
    const kind = t => /SUMMER SONIC|フェス|FESTIVAL|SP-RING/i.test(t) ? "FES" : "LIVE";
    const items = [
      ...D.live.map(x => ({k:kind(x.title), t:x.title, s:`${x.artist} サポートギター${x.venue?"・"+x.venue:""}`, y:x.year || yearOf(x.title)})),
      ...stage.map(x => ({k:"STAGE", t:x.title, s:x.role ? "舞台・"+x.role : "舞台", y:x.year})),
      {k:"TV", t:"CDTV", s:`バック演奏（${tv.length}回出演）`, y:null}];
    items.sort((a,b) => (b.y||0)-(a.y||0));
    const F = [["ALL","すべて"],["FES","フェス"],["LIVE","ライブ"],["STAGE","舞台"],["TV","テレビ"]];
    return `<section class="s" id="live"><div class="wrap">
      ${sh("03","Live / TV","ライブ・舞台・テレビ")}
      <div class="strip">
        <div class="photo reveal">${pic("stage","リハーサル中のステージに並ぶエレキギターとアコースティックギター")}<span class="cap">STAGE</span></div>
        <div class="photo reveal">${pic("live","ライブのステージでギターを弾く北川弘喜")}<span class="cap">LIVE</span></div>
        <div class="photo reveal">${pic("pedal","ライブ会場のステージに組まれたエフェクターボード")}<span class="cap">GEAR</span></div>
      </div>
      <div class="filters" role="group" aria-label="種類で絞り込む" data-grid="gigs">${F.map((f,i)=>`<button type="button" class="fchip" data-f="${f[0]}" aria-pressed="${i?"false":"true"}">${f[1]}<em>${f[0]==="ALL"?items.length:items.filter(x=>x.k===f[0]).length}</em></button>`).join("")}</div>
      <ul class="grid3" id="gigs">${items.map(x=>`<li class="card gig ${ph(({FES:"stage",LIVE:"live",STAGE:"pedal",TV:"play"})[x.k])}" data-k="${x.k}"><div class="row">${chip(x.k, x.k==="TV"?"tv":"")}${x.y?`<span class="yr2">${x.y}</span>`:""}</div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></li>`).join("")}</ul>
      <a class="btn line sm" style="margin-top:30px" href="${P.links.youtube}" target="_blank" rel="noopener">${svg("yt")}演奏を見る</a>
    </div></section>`;
  }

  function works(){
    const CATS = [
      {n:"01",t:"Songwriting / Arrangement",j:"作詞・作曲・編曲",d:"アイドル・声優ユニットへの提供曲を、作詞からギターまで一人で仕上げます。",c:`${comp.length} SONGS`,img:"studio",alt:"紫の光に照らされた作曲デスクとギター"},
      {n:"02",t:"Guitar / Session",j:"ギター参加楽曲",d:"レコーディングでギターを担当。リモートRECにも、スタジオ立ち会いにも対応。",c:`${gtr.length} WORKS`,img:"guitar",alt:"ギターの指板を押さえる北川弘喜の手元"},
      {n:"03",t:"Sound Production",j:"カラオケ音源制作",d:"配信で活躍する有名歌い手のカラオケ音源を、原曲どおりに再現して制作（作品名は非公開）。",c:`${kara.length} TRACKS`,img:"desk",alt:"夜の机に置いたエレキギターの指板"},
      {n:"04",t:"Stage / Live",j:"ライブ・舞台出演",d:"フェス・ツアー・舞台・地上波で、サポートギタリストとして演奏。",c:`${D.live.length+stage.length} STAGES / TV ${tv.length}`,img:"pedal",alt:"ライブ会場のステージに組まれたエフェクターボード"}];
    const li = c => `<li>${esc(c.title)}<span>${esc(c.artist)}${c.year?` ${c.year}`:""}</span></li>`;
    return `<section class="s" id="works"><div class="wrap">
      ${sh("04","Works","作品・制作実績")}
      <p class="lede" style="margin-bottom:44px;max-width:32em">作れて、弾ける。曲づくりから演奏まで、一人で通せるのが強みです。</p>
      <div class="cats hs" id="cats">${CATS.map(x => `<button class="cat" type="button" data-cat="${x.n}">${pic(x.img,x.alt)}<span class="n">${x.n}</span><span class="t">${x.t}</span><span class="j">${x.j}</span><span class="d">${x.d}</span><span class="c">${x.c}</span></button>`).join("")}</div>${swipe(CATS.length)}
      <div class="feat-head"><h3>Featured Works</h3><p>ジャケットを押すと、ここで再生できます。</p></div>
      <div class="feat hs" id="feat">${feat.map((c,i) => {
        const id = (c.spotify||"").split("/track/")[1];
        return `<article class="song"><button class="art" type="button" data-track="${id}" aria-label="${esc(c.title)} を再生" style="background-image:url('https://i.scdn.co/image/${c.jacket}')"><span class="no">0${i+1}</span><span class="play"><i></i>LISTEN</span></button>
        <h4>${esc(c.title)}</h4><div class="who">${esc(c.artist)}<em>${c.year||""}</em></div>
        <ul class="tags">${tagsOf(c).map(t=>`<li>${t}</li>`).join("")}</ul><div class="jr">${esc((c.roles||[]).join("・"))}</div>
        <a class="sp" href="${c.spotify}" target="_blank" rel="noopener">${svg("sp")}Spotifyで聴く</a></article>`;}).join("")}</div>
      <div class="swipe" aria-hidden="true"><span>横にスワイプ</span><span class="dots">${feat.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</span></div>
      <div class="player" id="player"></div>
      <details class="acc allworks" id="credits"><summary><b>すべての制作実績を見る</b><span class="meta">${comp.length+gtr.length+kara.length} CREDITS</span></summary>
        <div class="in">
          <div class="filters" role="group" aria-label="種類で絞り込む" data-grid="cgrid">
            <button type="button" class="fchip" data-f="ALL" aria-pressed="true">すべて<em>${comp.length+gtr.length+1}</em></button>
            <button type="button" class="fchip" data-f="compose" aria-pressed="false">作詞・作曲・編曲<em>${comp.length}</em></button>
            <button type="button" class="fchip" data-f="guitar" aria-pressed="false">ギター参加<em>${gtr.length}</em></button>
            <button type="button" class="fchip" data-f="karaoke" aria-pressed="false">カラオケ音源<em>${kara.length}</em></button></div>
          <ul class="grid4" id="cgrid">${[...comp,...gtr].map(c=>`<li class="card credit ${ph(c.category==="compose"?"studio":"guitar")}" data-k="${c.category}"><div class="row">${chip(c.category==="compose"?"COMPOSE":"GUITAR", c.category==="compose"?"gr":"")}${c.year?`<span class="yr2">${c.year}</span>`:""}</div><b>${esc(c.title)}</b><small>${esc(c.artist)}</small></li>`).join("")}
            <li class="card credit ${ph("desk")}" data-k="karaoke"><div class="row">${chip("PRODUCTION","gr")}<span class="yr2">×${kara.length}</span></div><b>有名歌い手のカラオケ音源</b><small>原曲を再現して制作・作品名は非公開</small></li></ul>
        </div></details>
    </div></section>`;
  }

  function listen(){
    const W = P.work;
    return `<section class="s" id="listen"><div class="wrap">
      ${sh("05","Listen","聴く・見る")}
      <div class="listen">
        <a class="media" href="${P.links.spotify}" target="_blank" rel="noopener">
          <div class="bg mosaic" aria-hidden="true">${feat.map(c=>`<span style="background-image:url('https://i.scdn.co/image/${c.jacket}')"></span>`).join("")}</div>
          <span class="ico" style="background:#1DB954">${svg("sp")}</span><b>Spotify</b><p>提供曲・参加曲をまとめて聴く</p><span class="go">OPEN PLAYLIST</span></a>
        <a class="media" href="${P.links.youtube}" target="_blank" rel="noopener">
          <div class="bg" aria-hidden="true">${pic("play","")}</div>
          <span class="ico" style="background:#FF0000">${svg("yt")}</span><b>YouTube</b><p>演奏・制作実績を見る</p><span class="go">OPEN CHANNEL</span></a>
      </div>
      <div class="workcta">
        <div><h3>仕事を依頼する</h3><p>作曲・編曲・ギターREC・楽曲制作のご相談はこちら</p>
          <ul class="serv">${W.services.map(s=>`<li class="card"><b>${esc(s.name)}</b>${s.note?`<small>${esc(s.note)}</small>`:""}</li>`).join("")}</ul>
          <p class="small" style="margin-top:14px">納期：${esc(W.delivery)}　｜　${esc(W.style)}　｜　料金：${esc(W.price)}</p></div>
        <button class="btn gr" type="button" data-open="お仕事">仕事を依頼する</button>
      </div>
    </div></section>`;
  }

  function lesson(){
    const L = D.lessonPlans, base = L.single.price;
    const plan = p => { const per = Math.round(p.price/p.count), save = base*p.count - p.price;
      return `<li class="card plan ${p.rec?"rec":""} ${ph(({2:"hands",4:"guitar",8:"play"})[p.count])}">${p.rec?'<span class="badge">人気No.1</span>':""}<div class="nm">${esc(p.name)}</div><div class="ct">60分×${p.count}回</div>
        <div class="p">¥${yen(p.price)}<small>/ 月</small></div><div class="per">1回あたり ¥${yen(per)}${save>0?`<em>単発より月¥${yen(save)}おトク</em>`:""}</div>
        <button class="pick" type="button" data-open="レッスン" data-plan="${esc(p.name)}">このプランを選ぶ</button></li>`; };
    return `<section class="s" id="lesson"><div class="wrap">
      ${sh("06","Lesson","ギターレッスン")}
      <div class="les">
        <div class="pw"><div class="photo reveal">${pic("lesson","ギターを持ち、こちらを見てほほえむ北川弘喜")}</div><span class="bigword or" aria-hidden="true">Let's play</span></div>
        <div>
          <p class="lede">現場で培った経験を、あなたのギターへ。</p>
          <ul class="lstats">${D.lessonStats.map(x=>`<li class="card"><b>${esc(x.v)}<small>${esc(x.u)}</small></b><span>${esc(x.l)}</span></li>`).join("")}</ul>
          <ul class="tg"><li>初心者〜経験者まで</li><li>オンライン対応</li><li>プロ志向の方も</li><li>2021年から指導</li></ul>
          <div class="card trial ${ph("lesson")}"><div><span class="chip or">FIRST</span><b>体験レッスン</b><small>初回のみ・60分</small></div><div class="p">¥${yen(L.trial.price)}</div>
            <button class="pick or" type="button" data-open="レッスン" data-plan="体験レッスン">体験を申し込む</button></div>
          <ul class="plans hs" id="plans">${L.monthly.map(plan).join("")}
            <li class="card plan ${ph("guitars")}"><div class="nm">単発</div><div class="ct">60分×1回</div><div class="p">¥${yen(base)}<small>/ 回</small></div><div class="per">好きなときに1回から</div>
            <button class="pick" type="button" data-open="レッスン" data-plan="単発">このプランを選ぶ</button></li></ul>${swipe(L.monthly.length+1)}
          <p class="small" style="margin:14px 0 0">料金はすべて税込です。レンタルスタジオで行う場合、スタジオ代は別にかかります。</p>
          <details class="acc open-card les-info"><summary><b>受付の時間・場所・お支払い</b></summary><div class="in">
            <table class="hours"><tr><th>水・木・金</th><td>16時から<small>前の月の20日を過ぎたら 22時から</small></td></tr>
            <tr><th>土・日</th><td>12時から<small>前の月の20日を過ぎたら 21時から</small></td></tr>
            <tr><th>場所</th><td>${esc(P.lesson.place)}</td></tr><tr><th>お支払い</th><td>${esc(P.lesson.payment)}</td></tr></table>
            <p class="small" style="margin-top:12px">月謝の方は、毎月20日までに翌月ぶんをご予約ください。</p></div></details>
        </div>
      </div>
      <div class="les-extra">
        <div><h3><span>STEP</span>はじめるまで</h3>
          <ol class="flow hs" id="flow">
            <li class="card"><span class="n">01</span><b>フォームから申し込む</b><small>ご用件で「レッスン」を選んで送信</small></li>
            <li class="card"><span class="n">02</span><b>日程を決める</b><small>2日以内にメールでご返信します</small></li>
            <li class="card"><span class="n">03</span><b>体験レッスン</b><small>初回60分。合えば月謝か単発へ</small></li>
          </ol>${swipe(3)}</div>
        <div class="faq"><h3><span>FAQ</span>よくある質問</h3>
          <details><summary>まったくの初心者でも大丈夫？</summary><p>大丈夫です。初心者からプロを目指す方まで、それぞれに合わせて進めます。</p></details>
          <details><summary>オンラインでも受けられる？</summary><p>受けられます。レンタルスタジオ・ご自宅・オンラインから選べます。</p></details>
          <details><summary>スタジオ代はかかる？</summary><p>レンタルスタジオで行う場合は、レッスン料金とは別にスタジオ代がかかります。</p></details>
          <details><summary>支払い方法は？</summary><p>${esc(P.lesson.payment)}に対応しています。</p></details>
          <details><summary>予約はいつまでに？</summary><p>月謝の方は、毎月20日までに翌月ぶんをご予約ください。20日を過ぎると、受付の時間が遅めになります。</p></details>
        </div>
      </div>
    </div></section>`;
  }

  const KINDS = ["レッスン","お仕事","その他"];
  const KDESC = {"レッスン":"体験・月謝・単発","お仕事":"作曲・編曲・ギターREC・ライブサポート","その他":"取材・ご相談など"};
  function contact(){
    const W = P.work;
    return `<section class="s" id="contact" style="background-image:linear-gradient(180deg,rgba(6,8,13,.86),rgba(6,8,13,.94)),url('${IMG.strings}')"><div class="wrap">
      ${sh("07","Contact","お問い合わせ")}
      <div class="ct">
        <div class="side">
          <p>レッスンのお申し込み、制作・演奏・ライブサポート等のお仕事は、こちらのフォームからご連絡ください。2日以内にメールでご返信します。</p>
          <dl><dt>お仕事</dt><dd>作詞・作曲／編曲・トラック制作／ギターREC／ライブサポート</dd><dt>納期</dt><dd>${esc(W.delivery)}</dd><dt>料金</dt><dd>${esc(W.price)}</dd><dt>レッスン</dt><dd>体験 初回60分 ¥${yen(D.lessonPlans.trial.price)}</dd></dl>
          <div class="quick">
            <a class="dm" href="${P.links.instagram}" target="_blank" rel="noopener"><i>${svg("ig")}</i><span><b>Instagram の DM でも受け付けています</b><small>曲の尺と納期だけ書いていただければ返信します</small></span></a>
          </div>
        </div>
        <form class="f" id="form" novalidate>
          <fieldset class="kinds"><legend>ご用件を選んでください<i>必須</i></legend>
            ${KINDS.map((k,i)=>`<label class="kc ${k==="レッスン"?"or":""}"><input type="radio" name="kind" value="${k}"><span><b>${k}</b><small>${KDESC[k]}</small></span></label>`).join("")}
            <input type="hidden" id="f_kind"><p class="err" hidden></p></fieldset>
          <div class="two">
            <div><label for="f_name">お名前<i>必須</i></label><input id="f_name" name="name" autocomplete="name" required><p class="err" hidden></p></div>
            <div><label for="f_mail">メールアドレス<i>必須</i></label><input id="f_mail" name="email" type="email" inputmode="email" autocomplete="email" required><p class="err" hidden></p></div>
          </div>
          <div><label for="f_sub">件名</label><input id="f_sub" name="subject" placeholder="例：体験レッスンの希望日について"></div>
          <div><label for="f_msg">メッセージ<i>必須</i></label><textarea id="f_msg" name="message" required placeholder="ご希望の内容、日程、納期など"></textarea><p class="err" hidden></p></div>
          <input type="hidden" name="from" id="f_from">
          <button class="btn gr send" type="submit" id="send">この内容で送る</button>
          <div class="done" id="done" hidden role="status">ありがとうございます。送信しました。2日以内にメールでご返信します。</div>
          <p class="err" id="sendErr" hidden>送信できませんでした。通信の状態を確かめて、もう一度お試しください。うまくいかない場合は Instagram の DM からご連絡ください。</p>
        </form>
      </div>
    </div></section>`;
  }

  const band = (words, rev) => { const one = words.map(w=>`<span>${w}</span><i></i>`).join(""); return `<div class="band ${rev?"rev":""}" aria-hidden="true"><div class="tr">${one}${one}${one}${one}</div></div>`; };

  const main = hero()+band(["Guitar","Compose","Arrange","Live Support"])+profile()+career()+live()+works()+listen()+band(["Lesson","Beginner","Online","Pro"],true)+lesson()+contact();

  const url = p.siteUrl;
  const meta = `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${url}${IMG.ogp}">`;
  const ld = {"@context":"https://schema.org","@type":"Person","name":p.name,"alternateName":p.nameEn,"jobTitle":["ギタリスト","作曲家","編曲家","ギター講師"],
    "description":"書けるギタリスト、弾ける作曲家。ライブ・舞台・TVのサポートギター、作詞・作曲・編曲、ギターレッスン。","address":{"@type":"PostalAddress","addressLocality":"東京"},
    "url":url,"sameAs":["instagram","tiktok","x","youtube","spotify"].map(k => p.links[k]).filter(Boolean)};
  const cfg = JSON.stringify({form: site.form}).replace(/</g,"\\u003c");

  let html = files["src/template.html"];
  const put = (mark, val) => { if(!html.includes(mark)) warnings.push("差込口が見つかりません: " + mark); html = html.split(mark).join(val); };
  put("<!--@meta-->", meta);
  put("<!--@jsonld-->", `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,"\\u003c")}</script>`);
  put("<!--@phstyle-->", phStyle);
  put("<!--@main-->", main);
  put("<!--@sns-->", snsHTML());
  put("<!--@config-->", cfg);
  for(const bad of ["undefined","null</","NaN"]) if(main.includes(bad)) warnings.push("本文に " + bad + " が出ています。データを確かめてください");
  if(main.includes("要確認")) warnings.push("「要確認」が画面に出ています");
  return { files: {"index.html": html}, warnings };
}
