/* ============================================================
   render.mjs — data/*.json ＋ src/template.html → index.html の中身
   入出力を持たない（読み書きは build.mjs / tools/build.jsc.mjs がやる）。
   ページの文章・カードはすべてここで組み立てて、静的な HTML として書き出す。
   ボタンの動き（絞り込み・メニュー・フォーム送信など）は assets/js/main.js。
   ============================================================ */
export const ROOT_FILES = ["src/template.html","data/voices.json","data/profile.json","data/credits.json","data/live.json","data/media.json","data/site.json","data/images.json","assets/css/kk-design-system.css","assets/css/site.css","assets/js/main.js"];
const ASSETS = ["assets/css/kk-design-system.css","assets/css/site.css","assets/js/main.js"];
/* 中身から短い印をつくる（CSS・JSを直したら、見る人のブラウザに古いものが残らないよう ?v= を変える） */
const stamp = t => { let h = 5381; for(let i=0;i<t.length;i++) h = ((h<<5) + h + t.charCodeAt(i)) >>> 0; return h.toString(36); };

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
    voices: (J("data/voices.json").items||[]).filter(v => v && v.text), lessonPlans: site.lessonPlans, lessonStats: site.lessonStats, booking: (site.booking||{}).url||"", bookingEmbed: (site.booking||{}).embed||(site.booking||{}).url||"", video: site.video||{}, news: ((site.news||{}).items||[]).filter(n=>n&&n.text).slice(0,3), timeline: site.timeline, liveYears: site.liveYears
  };
  const IMG = images.paths, ICON = site.icons;
  const warnings = [];

  const P = D.profile, C = D.credits;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
  const SNS = [["instagram","ig","Instagram"],["tiktok","tt","TikTok"],["x","x","X"],["youtube","yt","YouTube"],["spotify","sp","Spotify"]];
  const snsHTML = (label=false) => SNS.map(([k,i,n]) => `<a class="c-${i}" href="${P.links[k]}" target="_blank" rel="noopener" aria-label="${n}">${svg(i)}${label?`<span>${n}</span>`:""}</a>`).join("");
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
        <h1 class="cp"><span class="l1"><em class="kw or">書ける</em>ギタリスト、</span><span class="l2"><em class="kw bl">弾ける</em>作曲家。</span></h1>
        <p class="name">KOKI KITAGAWA</p>
        <p class="lead">ギタリストとしてライブやレコーディング、コンポーザーとして作詞・作曲・編曲まで。「弾く」と「作る」の両方で活動しています。</p>
        <div class="cta">
          <button class="btn or" type="button" data-open="レッスン">レッスンを申し込む</button>
          <button class="btn gr" type="button" data-open="お仕事">仕事を依頼する</button>
        </div>
        <ul class="marks" aria-label="主な実績">
          <li><i>FESTIVAL</i><b>SUMMER SONIC</b><span>2023 出演・サポートギター</span></li>
          <li><i>FESTIVAL</i><b><span class="ib">イナズマロック</span><span class="ib">フェス</span></b><span>2023 出演・サポートギター</span></li>
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
  const phStyle = `<style>${PH.filter(k=>IMG[k]).map(k=>`.ph-${k}::before{background-image:url("${IMG[k]}")}`).join("")}${Object.entries(SBG).map(([id,k])=>`#${id}.sbg::before{background-image:url("${IMG[k]}")}`).join("")}</style>`;
  const ph = k => `ph ph-${k}`;
  const pbg = (k, tone) => `<div class="pbg ${tone}" aria-hidden="true"><i style="background-image:url('${IMG[k]}')"></i></div>`;
  const chip = (t, cls="") => `<span class="chip ${cls}">${t}</span>`;

  function profile(){
    const g = P.gear.groups.map(x => `<li class="gcard"><b>${esc(x.name)}</b>${x.items.map(i=>`<span>${esc(i)}</span>`).join("")}</li>`).join("");
    const SK = [["GUITAR","サポートギター","フェス・ツアー・舞台・TVで演奏","stage","リハーサル中のステージに並ぶギター"],["COMPOSE","作詞・作曲・編曲","提供曲は作詞からギターまで一人で","studio","紫の光に照らされた作曲デスクとギター"],["LESSON","ギターレッスン","初心者からプロ志向まで","hands","ギターの弦を押さえる手元"]];
    return `<section class="s sbg" id="profile"><div class="wrap">
      ${sh("01","Profile","プロフィール・経歴")}
      <div class="prof">
        <div class="pw"><div class="photo reveal">${pic("profile","椅子に座ってギターを弾く北川弘喜")}</div><span class="bigword" aria-hidden="true">Guitarist</span></div>
        <div>
          <p class="lede hl">${esc(P.bio[0])}</p>
          <div class="body bio">${P.bio.slice(1).map(x=>`<p>${esc(x)}</p>`).join("")}</div>
          <ul class="skills hs" id="skills">${SK.map(s=>`<li class="card skill">${pic(s[3],s[4])}<span class="k">${s[0]}</span><b>${s[1]}</b><small>${s[2]}</small></li>`).join("")}</ul>${swipe(SK.length)}
          <div class="sns color pills">${snsHTML(true)}</div>
          <details class="acc open-card"><summary><b>使用機材</b><span class="meta">${P.gear.groups.reduce((n,g)=>n+g.items.length,0)} ITEMS</span></summary>
            <div class="in"><ul class="gcards">${g}</ul></div></details>
        </div>
      </div>
    </div></section>`;
  }

  function career(){
    const T = D.timeline;
    return `<section class="s pb" id="career">${pbg("tubesBlue","blue")}<div class="wrap">
      ${sh("02","Career","経歴・実績")}
      <ol class="tl">${T.map(y => `<li class="tly${y.items.some(i=>i.key)?" has-key":""}"><div class="y">${y.year}</div><div class="evs">${y.items.map(it => it.key
        ? `<div class="ev key"><span class="k">${/SUMMER|フェス/i.test(it.t)?"FESTIVAL":/ステージ|ミュージカル/.test(it.t)?"STAGE":"SONGWRITING"}</span><b>${esc(it.t)}</b>${it.s?`<small>${esc(it.s)}</small>`:""}</div>`
        : `<div class="ev"><b>${esc(it.t)}</b>${it.s?`<small>${esc(it.s)}</small>`:""}</div>`).join("")}</div></li>`).join("")}</ol>
      <p class="small" style="margin-top:22px">出演したライブ・舞台・テレビの一覧は <a href="#works" data-tab-go="stage" style="text-decoration:underline;text-underline-offset:4px">WORKS</a> にまとめています。</p>
    </div></section>`;
  }

  function works(){
    const kind = t => /SUMMER SONIC|フェス|FESTIVAL|SP-RING/i.test(t) ? "FES" : "LIVE";
    const items = [
      ...D.live.map(x => ({k:kind(x.title), t:x.title, s:`${x.artist} サポートギター${x.venue?"・"+x.venue:""}`, y:x.year || yearOf(x.title)})),
      ...stage.map(x => ({k:"STAGE", t:x.title, s:x.role ? "舞台・"+x.role : "舞台", y:x.year})),
      {k:"TV", t:"CDTV", s:`バック演奏（${tv.length}回出演）`, y:null}];
    const BIG = /SUMMER SONIC|イナズマ|CDTV|あんさんぶる/;   // 大きい仕事は最初の6件に必ず入れる
    items.sort((a,b) => (BIG.test(b.t)-BIG.test(a.t)) || (b.y||0)-(a.y||0));
    const F = [["ALL","すべて"],["FES","フェス"],["LIVE","ライブ"],["STAGE","舞台"],["TV","テレビ"]];
    const gig = x=>`<li class="card gig ${ph(({FES:"stage",LIVE:"live",STAGE:"pedal",TV:"play"})[x.k])}" data-k="${x.k}"><div class="row">${chip(x.k, x.k==="TV"?"tv":"")}${x.y?`<span class="yr2">${x.y}</span>`:""}</div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></li>`;
    const W = P.work, nMusic = comp.length+gtr.length+kara.length;
    return `<section class="s sbg" id="works"><div class="wrap">
      ${sh("03","Works","作品・ライブ・出演")}
      <div class="works-top"><p class="lede">作れて、弾ける。曲づくりから演奏まで、一人で通せるのが強みです。</p>
        <div class="seg" role="tablist" aria-label="作品の種類">
          <button type="button" role="tab" id="t-music" aria-controls="p-music" aria-selected="true" data-tab="music">楽曲<em>${nMusic}</em></button>
          <button type="button" role="tab" id="t-stage" aria-controls="p-stage" aria-selected="false" data-tab="stage">ライブ・TV<em>${items.length}</em></button></div></div>
      ${videoBlock()}
      <div class="tabp on" id="p-music" role="tabpanel" aria-labelledby="t-music">
        <div class="feat hs" id="feat">${feat.map((c,i) => {
          const id = (c.spotify||"").split("/track/")[1];
          return `<article class="song"><button class="art" type="button" data-track="${id}" aria-label="${esc(c.title)}（${esc(c.artist)}）を再生" aria-pressed="false" style="background-image:url('https://i.scdn.co/image/${c.jacket}')"><span class="no">0${i+1}</span><span class="pp" aria-hidden="true"><i class="tri"></i><i class="bars"></i></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="bar" aria-hidden="true"><i></i></span></button>
          <h4>${esc(c.title)}</h4><div class="who">${esc(c.artist)}<em>${c.year||""}</em></div></article>`;}).join("")}</div>
        <div class="swipe" aria-hidden="true"><span>横にスワイプ</span><span class="dots">${feat.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</span></div>
        <div class="sp-host" id="spHost" aria-hidden="true"><div id="spEmbed"></div></div>
        <details class="acc allworks" id="credits"><summary><b>すべての制作実績を見る</b><span class="meta">${nMusic} CREDITS</span></summary>
          <div class="in">
            <div class="filters" role="group" aria-label="種類で絞り込む" data-grid="cgrid">
              <button type="button" class="fchip" data-f="ALL" aria-pressed="true">すべて<em>${nMusic}</em></button>
              <button type="button" class="fchip" data-f="compose" aria-pressed="false">作詞・作曲・編曲<em>${comp.length}</em></button>
              <button type="button" class="fchip" data-f="guitar" aria-pressed="false">ギター参加<em>${gtr.length}</em></button>
              <button type="button" class="fchip" data-f="karaoke" aria-pressed="false">カラオケ音源<em>${kara.length}</em></button></div>
            <ul class="grid4" id="cgrid">${[...comp,...gtr].map(c=>`<li class="card credit ${ph(c.category==="compose"?"studio":"guitar")}" data-k="${c.category}"><div class="row">${chip(c.category==="compose"?"COMPOSE":"GUITAR", c.category==="compose"?"gr":"")}${c.year?`<span class="yr2">${c.year}</span>`:""}</div><b>${esc(c.title)}</b><small>${esc(c.artist)}</small></li>`).join("")}
              <li class="card credit ${ph("desk")}" data-k="karaoke"><div class="row">${chip("PRODUCTION","gr")}<span class="yr2">×${kara.length}</span></div><b>有名歌い手のカラオケ音源</b><small>原曲を再現して制作・作品名は非公開</small></li></ul>
          </div></details>
      </div>
      <div class="tabp" id="p-stage" role="tabpanel" aria-labelledby="t-stage">
        <div class="strip">
          <div class="photo reveal">${pic("venue","本番前のホール。ステージに照明が当たっている")}<span class="cap">VENUE</span></div>
          <div class="photo reveal">${pic("stage","ライブ会場のステージに立てたギターとアンプ")}<span class="cap">STAGE</span></div>
          <div class="photo reveal">${pic("pedal","青い照明のステージに組んだエフェクターボード")}<span class="cap">GEAR</span></div>
        </div>
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
        <div><h3>仕事を依頼する</h3><p>作曲・編曲・ギターREC・楽曲制作のご相談はこちら。${esc(W.policy)}</p>
          <ul class="serv">${W.services.map(s=>`<li class="card"><b>${esc(s.name)}</b>${s.note?`<small>${esc(s.note)}</small>`:""}</li>`).join("")}</ul>
          <ol class="wflow">${W.flow.map((s,i)=>`<li><span>${String(i+1).padStart(2,"0")}</span>${esc(s)}</li>`).join("")}</ol>
          <p class="small" style="margin-top:14px">${esc(W.style)}　｜　料金：${esc(W.price)}　｜　${esc(W.revisionNote)}</p></div>
        <button class="btn gr" type="button" data-open="お仕事">仕事を依頼する</button>
      </div>
    </div></section>`;
  }

  /* 動画1本（オリジナル曲のPVなど）。data/site.json の video.youtube が空なら出さない */
  function videoBlock(){
    const V = D.video; const id = ytId(V.youtube); if(!id) return "";
    return `<div class="pv"><button class="pv-frame" type="button" data-yt="${id}" aria-label="${esc(V.title||"動画")}を再生" style="background-image:url('https://i.ytimg.com/vi/${id}/maxresdefault.jpg')"><span class="pp" aria-hidden="true"><i class="tri"></i></span></button>
      <div class="pv-tx"><span class="chip or">ORIGINAL</span><b>${esc(V.title)}</b>${V.sub?`<small>${esc(V.sub)}</small>`:""}</div></div>`;
  }
  function lesson(){
    const L = D.lessonPlans, base = L.single.price;
    const plan = p => { const per = Math.round(p.price/p.count), save = base*p.count - p.price;
      return `<li class="card plan ${p.rec?"rec":""} ${ph(({2:"hands",4:"guitar",8:"play"})[p.count])}">${p.rec?'<span class="badge">人気No.1</span>':""}<div class="nm">${esc(p.name)}</div><div class="ct">60分×${p.count}回</div>
        <div class="p">¥${yen(p.price)}<small>/ 月</small></div><div class="per">1回あたり ¥${yen(per)}${save>0?`<em>単発より月¥${yen(save)}おトク</em>`:""}</div>
        <button class="pick" type="button" data-open="レッスン" data-plan="${esc(p.name)}">このプランを選ぶ</button></li>`; };
    return `<section class="s sbg" id="lesson"><div class="wrap">
      ${sh("04","Lesson","ギターレッスン")}
      <div class="les">
        <div class="pw"><div class="photo reveal">${pic("lesson","ギターを持ち、こちらを見てほほえむ北川弘喜")}</div><span class="bigword or" aria-hidden="true">Let's play</span></div>
        <div>
          <p class="lede">現場で培った経験を、あなたのギターへ。</p>
          <ul class="lstats">${D.lessonStats.map(x=>`<li class="card"><b>${esc(x.v)}<small>${esc(x.u)}</small></b><span>${esc(x.l)}</span></li>`).join("")}</ul>
          <ul class="tg"><li>${esc(P.lesson.area)}・オンライン</li><li>3歳から大人まで</li><li>初心者〜経験者まで</li><li>プロ志向の方も</li><li>2021年から指導</li></ul>
          <div class="card trial ${ph("lesson")}"><div><span class="chip or">FIRST</span><b>体験レッスン</b><small>初回のみ・60分・ギターはスタジオで借りられます</small></div><div class="p">¥${yen(L.trial.price)}</div>
            <ol class="tsteps">${(P.lesson.trialSteps||[]).map((t,i)=>`<li><span>${i+1}</span>${esc(t)}</li>`).join("")}</ol>
            ${D.booking ? `<button class="pick or" type="button" data-book>空いている日時を見て予約する</button>` : `<button class="pick or" type="button" data-open="レッスン" data-plan="体験レッスン">体験を申し込む</button>`}</div>
          <ul class="plans hs" id="plans">${L.monthly.map(plan).join("")}
            <li class="card plan ${ph("guitars")}"><div class="nm">単発</div><div class="ct">60分×1回</div><div class="p">¥${yen(base)}<small>/ 回</small></div><div class="per">好きなときに1回から</div>
            <button class="pick" type="button" data-open="レッスン" data-plan="単発">このプランを選ぶ</button></li></ul>${swipe(L.monthly.length+1)}
          <p class="small" style="margin:14px 0 0">料金はすべて税込です。レンタルスタジオで行う場合、スタジオ代は別にかかります。</p>
          <details class="acc open-card les-info"><summary><b>受付の時間・場所・お支払い</b></summary><div class="in">
            <table class="hours"><tr><th>水・木・金</th><td>16時から<small>前月20日を過ぎてからのご予約は 22時から</small></td></tr>
            <tr><th>土・日</th><td>12時から<small>前月20日を過ぎてからのご予約は 21時から</small></td></tr>
            <tr><th>場所</th><td>${esc(P.lesson.place)}</td></tr><tr><th>お支払い</th><td>${esc(P.lesson.payment)}</td></tr>
            <tr><th>キャンセル・振替</th><td>${esc(P.lesson.cancel)}</td></tr></table>
            <p class="small" style="margin-top:12px">月謝の方は、毎月20日までに翌月ぶんをご予約ください。</p></div></details>
        </div>
      </div>
      <div class="les-extra">
        <div><h3><span>STEP</span>はじめるまで</h3>
          <ol class="flow hs" id="flow">
            ${D.booking ? `<li class="card"><span class="n">01</span><b>空いている日時を選ぶ</b><small>カレンダーから、その場で予約できます</small></li>
            <li class="card"><span class="n">02</span><b>確認のメールが届く</b><small>場所と当日の流れをお送りします</small></li>` : `<li class="card"><span class="n">01</span><b>フォームから申し込む</b><small>ご用件で「レッスン」を選んで送信</small></li>
            <li class="card"><span class="n">02</span><b>日程を決める</b><small>2日以内にメールでご返信します</small></li>`}
            <li class="card"><span class="n">03</span><b>体験レッスン</b><small>初回60分。合えば月謝か単発へ</small></li>
          </ol>${swipe(3)}</div>
        <div class="faq"><h3><span>FAQ</span>よくある質問</h3>
          <details><summary>まったくの初心者でも大丈夫？</summary><p>大丈夫です。初心者からプロを目指す方まで、それぞれに合わせて進めます。</p></details>
          <details><summary>ギターを持っていなくても受けられる？</summary><p>${esc(P.lesson.guitarRental)}</p></details>
          <details><summary>体験レッスンでは何をする？</summary><p>${esc((P.lesson.trialSteps||[]).join("→"))}の流れで、60分です。</p></details>
          <details><summary>体験のあと、入会をすすめられる？</summary><p>${esc(P.lesson.noPush)}</p></details>
          <details><summary>何歳から受けられる？</summary><p>${esc(P.lesson.ages)}</p></details>
          <details><summary>どこでレッスンする？</summary><p>${esc(P.lesson.place)}。オンラインでも受けられます。</p></details>
          <details><summary>スタジオ代はかかる？</summary><p>スタジオで行う場合は、レッスン料金とは別にスタジオ代がかかります。</p></details>
          <details><summary>支払い方法は？</summary><p>${esc(P.lesson.payment)}に対応しています。</p></details>
          <details><summary>キャンセル・日程の変更はできる？</summary><p>${esc(P.lesson.cancel)}</p></details>
          <details><summary>予約はいつまでに？</summary><p>月謝の方は、毎月20日までに翌月ぶんをご予約ください。20日を過ぎると、受付の時間が遅めになります。</p></details>
        </div>
      </div>${voices()}
    </div></section>`;
  }
  /* 生徒さんの声：data/voices.json に本人からもらった言葉が入ったときだけ出す */
  function voices(){
    if(!D.voices.length) return "";
    return `<div class="voices"><h3><span>VOICE</span>生徒さんの声</h3><ul class="vgrid hs" id="voices">${D.voices.map(v=>`<li class="card voice"><span class="q" aria-hidden="true">“</span><p>${esc(v.text)}</p><div class="who"><b>${esc(v.who||"生徒さん")}</b>${[v.years,v.plan].filter(Boolean).map(x=>`<span class="chip or">${esc(x)}</span>`).join("")}</div></li>`).join("")}</ul>${D.voices.length>1?swipe(D.voices.length):""}</div>`;
  }

  const KINDS = ["レッスン","お仕事","その他"];
  const KDESC = {"レッスン":"体験・月謝・単発","お仕事":"作曲・編曲・ギターREC・ライブサポート","その他":"取材・ご相談など"};
  function contact(){
    const W = P.work;
    return `<section class="s pb" id="contact">${pbg("tubesAmber","amber")}<div class="wrap">
      ${sh("05","Contact","お問い合わせ")}
      <div class="ct">
        <div class="side">
          <p>レッスンのお申し込み、制作・演奏・ライブサポート等のお仕事は、こちらのフォームからご連絡ください。2日以内にメールでご返信します。</p>
          <div class="quick">
            <a class="dm" href="${P.links.instagram}" target="_blank" rel="noopener"><i>${svg("ig")}</i><span><b>レッスンのご質問は Instagram の DM でも</b><small>お仕事のご依頼は、こちらのフォームからお願いします</small></span></a>
          </div>
        </div>
        <form class="f" id="form" novalidate>
          <fieldset class="kinds"><legend>ご用件を選んでください<i>必須</i></legend>
            ${KINDS.map((k,i)=>`<label class="kc ${({"レッスン":"or","その他":"bl"})[k]||""}"><input type="radio" name="kind" value="${k}"><span><b>${k}</b><small>${KDESC[k]}</small></span></label>`).join("")}
            <input type="hidden" id="f_kind"><p class="err" hidden></p></fieldset>
          <div class="two">
            <div><label for="f_name">お名前<i>必須</i></label><input id="f_name" name="name" autocomplete="name" required><p class="err" hidden></p></div>
            <div><label for="f_mail">メールアドレス<i>必須</i></label><input id="f_mail" name="email" type="email" inputmode="email" autocomplete="email" required><p class="err" hidden></p></div>
          </div>
          <div class="xf" data-for="レッスン">
            <div class="two">
              <div><label for="f_plan">希望プラン<i>必須</i></label><select id="f_plan"><option value="">選んでください</option>${["体験レッスン",...D.lessonPlans.monthly.map(m=>m.name),"単発","まだ決めていない"].map(x=>`<option>${esc(x)}</option>`).join("")}</select><p class="err" hidden></p></div>
              <div><label for="f_level">ギター歴</label><select id="f_level"><option value="">選んでください</option><option>はじめて</option><option>1年未満</option><option>1〜3年</option><option>3年以上</option></select></div>
            </div>
            <fieldset class="opts"><legend>受ける場所</legend>${["小岩のスタジオ","オンライン","相談したい"].map(x=>`<label class="opt"><input type="radio" name="f_place" value="${x}"><span>${x}</span></label>`).join("")}</fieldset>
            <div><label for="f_when">希望の曜日・時間</label><input id="f_when" placeholder="例：水曜の夜、土日の昼"></div>
          </div>
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
          <div><label for="f_sub">件名</label><input id="f_sub" name="subject" placeholder="例：体験レッスンの希望日について"></div>
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

  /* 流れる文字の帯：6本の弦の上を、細い文字がゆっくり流れる（フレットの印でつなぐ） */
  const band = (words, rev) => { const one = words.map(w=>`<span>${w}</span><i></i>`).join(""); return `<div class="band ${rev?"rev":""}" aria-hidden="true"><div class="tr">${one}${one}${one}${one}</div></div>`; };

  const bookModal = D.booking ? `<div class="bk" id="bk" hidden role="dialog" aria-modal="true" aria-label="体験レッスンの予約"><div class="bk-in"><div class="bk-top"><b>体験レッスンの予約</b><button class="x" type="button" data-book-close aria-label="閉じる">×</button></div><iframe title="体験レッスンの予約カレンダー" data-src="${esc(D.bookingEmbed)}" loading="lazy"></iframe><a class="small" href="${esc(D.booking)}" target="_blank" rel="noopener">うまく表示されないときは、こちらから予約ページを開いてください</a></div></div>` : "";
  const main = hero()+band(["Guitar","Compose","Arrange","Live Support"])+profile()+career()+works()+band(["Lesson","Beginner","Online","Pro"],true)+lesson()+contact()+bookModal;

  const url = p.siteUrl;
  const meta = `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${url}${IMG.ogp}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="ギターを弾く北川弘喜。書けるギタリスト、弾ける作曲家。">`;
  const ld = {"@context":"https://schema.org","@type":"Person","name":p.name,"alternateName":p.nameEn,"jobTitle":["ギタリスト","作曲家","編曲家","ギター講師"],
    "description":"書けるギタリスト、弾ける作曲家。ライブ・舞台・TVのサポートギター、作詞・作曲・編曲、ギターレッスン。","address":{"@type":"PostalAddress","addressRegion":"東京都","addressLocality":"江戸川区"},
    "url":url,"sameAs":["instagram","tiktok","x","youtube","spotify"].map(k => p.links[k]).filter(Boolean)};
  const ldLesson = {"@context":"https://schema.org","@type":"Service","name":"北川弘喜のギターレッスン（小岩・オンライン）","serviceType":"ギターレッスン",
    "provider":{"@type":"Person","name":p.name,"url":url},"areaServed":[{"@type":"Place","name":"東京都江戸川区 小岩"},{"@type":"Place","name":"オンライン"}],
    "availableChannel":{"@type":"ServiceChannel","serviceLocation":{"@type":"Place","name":"サウンドスタジオM小岩店","address":{"@type":"PostalAddress","addressRegion":"東京都","addressLocality":"江戸川区","streetAddress":"西小岩1-27-16 オルフェウスビル4F"}}},
    "offers":[{"@type":"Offer","name":"体験レッスン（60分）","price":site.lessonPlans.trial.price,"priceCurrency":"JPY"},{"@type":"Offer","name":"単発レッスン（60分）","price":site.lessonPlans.single.price,"priceCurrency":"JPY"}],
    "url":url+"#lesson"};
  const cfg = JSON.stringify({form: site.form}).replace(/</g,"\\u003c");

  let html = files["src/template.html"];
  for(const f of ASSETS) html = html.split(`"${f}"`).join(`"${f}?v=${stamp(files[f])}"`);
  const put = (mark, val) => { if(!html.includes(mark)) warnings.push("差込口が見つかりません: " + mark); html = html.split(mark).join(val); };
  put("<!--@meta-->", meta);
  put("<!--@jsonld-->", [ld, ldLesson].map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g,"\\u003c")}</script>`).join("\n"));
  put("<!--@phstyle-->", phStyle);
  put("<!--@main-->", main);
  /* 予約ページがあるときは、上・下・メニューの「レッスンを申し込む」も予約カレンダーを開く（はじめての人の入口は体験レッスンなので） */
  if(D.booking) html = html.split('data-open="レッスン">レッスンを申し込む').join('data-book>体験レッスンを予約');
  put("<!--@sns-->", snsHTML());
  put("<!--@config-->", cfg);
  for(const bad of ["undefined","null</","NaN"]) if(main.includes(bad)) warnings.push("本文に " + bad + " が出ています。データを確かめてください");
  if(main.includes("要確認")) warnings.push("「要確認」が画面に出ています");
  return { files: {"index.html": html, "privacy.html": privacyPage(files, p, url, {video: !!ytId(D.video.youtube), booking: !!D.booking}), "404.html": notFoundPage(files, url, !!D.booking)}, warnings };
}

/* プライバシーポリシー（privacy.html）。トップと同じCSSを使う */
function privacyPage(files, p, url, ext = {}){
  const css = ["assets/css/kk-design-system.css","assets/css/site.css"].map(f => `<link rel="stylesheet" href="${f}?v=${stamp(files[f])}">`).join("\n");
  const S = [
    ["運営者", `このサイト（${url}）は、ギタリスト・作曲家の ${p.name}（${p.nameEn}）が個人で運営しています。`],
    ["お預かりする情報", "お問い合わせフォームに入力いただいた、お名前・メールアドレス・ご用件・メッセージなどの内容です。"],
    ["使い道", "お問い合わせへの返信と、レッスン・お仕事のご連絡のためだけに使います。それ以外の目的には使いません。"],
    ["保管のしかた", "フォームの内容は Google フォーム（Google LLC のサービス）を通じて受け取り、Google のスプレッドシートに保存します。"],
    ["第三者への提供", "法令にもとづく場合を除き、ご本人の同意なく第三者に渡すことはありません。"],
    ["外部のサービス", `楽曲の再生に Spotify の埋め込みプレーヤーを${ext.video ? "、動画の再生に YouTube を" : ""}${ext.booking ? "、レッスンの予約に Google カレンダーの予約ページを" : ""}、文字の表示に Google Fonts を使っています。これらのサービスが、それぞれの方針にもとづいて閲覧の情報を扱うことがあります。`],
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
    <a class="btn or" href="${url}#lesson">${booking ? "体験レッスンを見る" : "レッスンを見る"}</a>
    <a class="btn gr" href="${url}#contact">お問い合わせ</a>
  </div>
</main>
</body>
</html>
`;
}
