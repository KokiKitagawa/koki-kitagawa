/* ============================================================
   render.mjs — データ → HTML 断片
   ここには入出力（ファイル読み書き）を書かない。純粋な関数だけ。
   build.mjs（Node）と tools/build.jsc.mjs（Node 無しの Mac 用）の
   両方から呼ばれるので、Node 固有の API を使わないこと。
   ============================================================ */

/* ---------- 小道具 ---------- */

export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** 「要確認」を含む値・空の値は画面に出さない（SPEC 受入基準） */
export function known(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0 && v.every(known);
  const s = String(v).trim();
  return s !== "" && !s.includes("要確認");
}

const nest = (n, s) => s.split("\n").map((l, i) => (i === 0 || !l ? l : " ".repeat(n) + l)).join("\n");
const ind = (n, s) => s.split("\n").map(l => (l ? " ".repeat(n) + l : l)).join("\n");

/* ---------- 画像 ---------- */

export function img(role, manifest, meta, extra = {}) {
  const m = manifest[role], c = meta[role];
  if (!m || !c) throw new Error(`画像 '${role}' が manifest.json か data/images.json に無い`);
  const srcset = m.widths.map(w => `assets/img/${role}-${w}.webp ${w}w`).join(", ");
  const fallback = m.widths.includes(1200) ? 1200 : m.widths[m.widths.length - 1];
  const eager = c.eager === true;
  const attrs = [
    `src="assets/img/${role}-${fallback}.webp"`,
    `srcset="${srcset}"`,
    `sizes="${esc(c.sizes)}"`,
    `width="${m.w}"`, `height="${m.h}"`,
    `alt="${esc(c.alt)}"`,
    eager ? `fetchpriority="high"` : `loading="lazy"`,
    `decoding="async"`,
  ];
  if (extra.class) attrs.unshift(`class="${extra.class}"`);
  return `<img ${attrs.join(" ")}>`;
}

/* ---------- 部品 ---------- */

const head = (en, ja, extra = "") =>
`<div class="section__head">
  <p class="t-label">${esc(en)}</p>
  <h2 class="t-vert">${esc(ja)}</h2>${extra ? "\n  " + extra : ""}
</div>`;

/** 曲名から決まる「波形」の棒の高さ（%）を返す。
    ジャケット画像が無いので、カードの絵はここで作る。乱数は使わない ——
    同じ曲名なら毎回同じ波形が出て、ビルドし直しても絵が変わらないようにする。
    ジャケットが手に入ったら、この波形ごと <img> に差し替えればよい。 */
export function waveBars(seed, n = 20) {
  let h = 2166136261;
  for (const ch of String(seed)) {           // FNV-1a で曲名を1つの数にする
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const bars = [];
  for (let i = 0; i < n; i++) {
    h ^= (h << 13) >>> 0; h >>>= 0;          // xorshift。桁あふれを毎回落とす
    h ^= h >>> 17;
    h ^= (h << 5) >>> 0;  h >>>= 0;
    const env = Math.sin(((i + 0.5) / n) * Math.PI);   // 中央が高い包絡線
    bars.push(Math.max(8, Math.round((0.2 + (h % 1000) / 1000 * 0.8) * env * 100)));
  }
  return bars;
}

/** 「（シユイ サポート）」— サポート出演は自分名義の公演と混ぜない */
export function supportSuffix(item) {
  const isSupport = known(item.role) && String(item.role).includes("サポート");
  return isSupport && known(item.artist) ? `（${item.artist} サポート）` : "";
}

/* ---------- 各セクション ---------- */

export function renderHero(p, manifest, imeta) {
  const highlights = known(p.highlights)
    ? `\n      <p class="hero__highlights">${p.highlights.map(esc).join(" ／ ")}</p>` : "";
  const main = known(p.headline)
    ? `\n    <p class="hero__vert hero__vert--main">${esc(p.headline)}</p>` : "";
  return `<section class="hero" id="top">
  <div class="hero__media">${img("hero", manifest, imeta)}</div>
  <div class="hero__copy">${main}
    <p class="hero__vert hero__vert--sub is-accent">ギタリスト／作曲・編曲</p>
    <div class="hero__bottom">${highlights}
      <p class="hero__cta">
        <a class="btn" href="#contact">制作のご依頼</a>
        <a class="link hero__cta-sub" href="#works">聴いてみる &rarr;</a>
      </p>
      <p class="t-caption hero__ctanote">料金・納期・お受けできる内容へ。ご依頼は Instagram の DM から。</p>
      <a class="hero__scroll" href="#about"><span>Scroll</span></a>
    </div>
  </div>
</section>`;
}

export function renderAbout(p, manifest, imeta) {
  const bio = p.bio.filter(known).map(t => `<p>${esc(t)}</p>`).join("\n        ");
  const career = p.career.filter(c => known(c.label)).map(c => {
    const d = known(c.detail) ? `<span class="career__detail">${esc(c.detail)}</span>` : "";
    return `<li>${esc(c.label)}${d}</li>`;
  }).join("\n        ");
  const ag = p.agency;
  const agency = (ag && ag.publish === true && known(ag.names) && ag.names.length)
    ? `\n      <p class="about__agency t-caption">${esc(ag.label)}：${ag.names.map(esc).join(" ／ ")}</p>` : "";
  const g = p.gear;
  const gear = (g && g.publish === true && known(g.groups) && g.groups.length)
    ? `\n      <details class="gear fold">
        <summary class="fold__sum"><span class="t-label">Gear</span><span class="fold__hint">機材を見る</span></summary>
        <dl class="gear__list">
          ${g.groups.map(gr => `<div class="gear__group">
            <dt>${esc(gr.name)}</dt>
            <dd>${gr.items.map(esc).join("<br>")}</dd>
          </div>`).join("\n          ")}
        </dl>
      </details>` : "";
  return `<section class="section" id="about">
  <div class="container">
    ${nest(4, head("About", "経歴"))}
  </div>
  <div class="container split">
    <div class="split__text reveal">
      <p class="t-h2">作る側にも、<br>弾く側にも立てる。</p>
      <div class="t-body about__bio">
        ${bio}
      </div>
      <ul class="about__career">
        ${career}
      </ul>${agency}
    </div>
    <div class="split__media">
      <figure class="portrait reveal">
        ${img("portrait", manifest, imeta)}
        <figcaption class="t-caption portrait__cap">${esc(p.name)}<span>${esc(p.nameEn)}</span></figcaption>
      </figure>
      <div class="reveal">${img("about-1", manifest, imeta)}</div>
      <div class="reveal">${img("about-2", manifest, imeta)}</div>
      <div class="reveal">${img("about-3", manifest, imeta)}</div>
    </div>
  </div>
  <div class="container">${gear}</div>
</section>`;
}

export function renderWorks(credits, profile) {
  const list = credits.filter(c => c.category === "compose" && c.featured === true).slice(0, 6);
  if (list.length === 0) throw new Error("works: featured な楽曲が1件も無い");
  const cards = list.map((c, i) => {
    // 画面に出せるのは曲名とアーティスト名だけ。担当と年は分かってから足す
    const meta = [known(c.roles) ? c.roles.join("・") : null, known(c.year) ? c.year : null].filter(known);
    const metaLine = meta.length
      ? `\n        <p class="card__meta">${meta.map(esc).join(" ／ ")}</p>` : "";
    const wave = waveBars(c.title).map(v => `<span style="height:${v}%"></span>`).join("");
    // 聴ける曲はカードごとリンクにする。聴けない曲は静かなカードのまま（嘘の導線を作らない）
    const playable = known(c.spotify);
    const id = playable ? String(c.spotify).split("/track/")[1] : null;
    // ジャケットは Spotify の画像CDNをそのまま参照する（自前で持たない＝規約どおり）。
    // 読み込めなかったときは下の波形カードがそのまま出るので崩れない
    const art = known(c.jacket)
      ? ` style="--art:url('https://i.scdn.co/image/${esc(c.jacket)}')"` : "";
    const artClass = known(c.jacket) ? " card__frame--art" : "";
    const openTag = playable
      ? `<a class="card__frame card__frame--play${artClass}"${art} data-embed="https://open.spotify.com/embed/track/${esc(id)}" href="${esc(c.spotify)}" target="_blank" rel="noopener" aria-label="${esc(c.title)} を再生する">`
      : `<div class="card__frame">`;
    const closeTag = playable ? `</a>` : `</div>`;
    const label = playable
      ? `<span class="card__label card__label--play">再生</span>`
      : `<span class="card__label">Song</span>`;
    // ジャケットがある曲は「写真の上に文字を重ねない」。
    // ジャケット自体に曲名が入っていることが多く、重ねると二重になって読めなくなる
    const inner = known(c.jacket)
      ? `
          <div class="card__art" aria-hidden="true"></div>
          <div class="card__name">
            <div class="card__top">
              <span class="card__index">${String(i + 1).padStart(2, "0")}</span>
              ${label}
            </div>
            <h3 class="card__title">${esc(c.title)}</h3>
            <p class="card__artist">${esc(c.artist)}</p>
          </div>
        `
      : `
          <div class="card__top">
            <span class="card__index">${String(i + 1).padStart(2, "0")}</span>
            ${label}
          </div>
          <div class="card__name">
            <h3 class="card__title">${esc(c.title)}</h3>
            <p class="card__artist">${esc(c.artist)}</p>
          </div>
          <div class="card__wave" aria-hidden="true">${wave}</div>
        `;
    return `<article class="card card--song reveal">
        ${openTag}${inner}${closeTag}${metaLine}
      </article>`;
  }).join("\n      ");
  const ctrl = `<div class="rail-ctrl" data-rail-ctrl hidden>
  <button type="button" aria-label="前のカードへ">&larr;</button>
  <button type="button" aria-label="次のカードへ">&rarr;</button>
</div>`;
  return `<section class="section" id="works">
  <div class="container">
    ${nest(4, head("Works", "楽曲提供", ctrl))}
  </div>
  <div class="container">
    <div class="rail" tabindex="0" role="group" aria-label="代表曲">
      ${cards}
    </div>
    <p class="t-caption rail__note">ジャケットのあるカードは、押すとこの画面で再生できます。全${credits.filter(c => c.category === "compose").length}曲の一覧は <a href="#credits">全実績</a> に掲載しています。</p>
${ind(4, renderListenBlock(profile))}
    <p class="cta-quiet"><a class="link" href="#contact">この人に頼む</a></p>
  </div>
</section>`;
}

const CATS = [
  { key: "compose", label: "楽曲提供" },
  { key: "guitar",  label: "ギター参加" },
  { key: "karaoke", label: "カラオケ音源" },
];

export function renderCredits(credits) {
  const buttons = CATS.map((c, i) =>
    `<button type="button" class="filter__btn" data-filter="${c.key}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(c.label)}<span class="filter__count">${credits.filter(x => x.category === c.key).length}</span></button>`
  ).join("\n      ");

  // カラオケ音源は作品名・発注元を伏せる約束（2026/10/5）。曲ごとに並べず1行にまとめる
  const kara = credits.filter(c => c.category === "karaoke");
  const listed = credits.filter(c => c.category !== "karaoke");
  if (kara.length) listed.push({
    category: "karaoke", year: null,
    title: "有名歌い手のカラオケ音源（作品名は非公開）",
    artist: `配信で活躍する歌い手の楽曲 ${kara.length}曲`, roles: ["カラオケ音源制作"],
  });
  const rows = listed.map(c => {
    const bits = [c.artist];
    if (known(c.roles)) bits.push(c.roles.join("・"));
    if (known(c.note)) bits.push(c.note);
    return `<div class="row reveal" data-category="${esc(c.category)}">
        <span class="row__date">${known(c.year) ? esc(c.year) : ""}</span>
        <div>
          <h3 class="t-h3">${esc(c.title)}</h3>
          <p class="row__meta">${bits.filter(known).map(esc).join(" ／ ")}</p>
        </div>
      </div>`;
  }).join("\n      ");

  return `<section class="section" id="credits">
  <div class="container">
    ${nest(4, head("Credits", "全実績"))}
    <div class="filter" data-filter-group>
      ${buttons}
    </div>
    <div class="rows" data-filter-target>
      ${rows}
    </div>
  </div>
</section>`;
}

const TYPE_LABEL = { live: "LIVE", tv: "TV", stage: "STAGE" };

export function renderLive(live, media, manifest, imeta) {
  const all = live.concat(media).slice().sort((a, b) => {
    if (a.year === b.year) return 0;
    if (!known(a.year)) return 1;          // 年が分からないものは下に置く（推測で埋めない）
    if (!known(b.year)) return -1;
    return b.year - a.year;
  });
  const rowOf = (it) => {
    const label = TYPE_LABEL[it.type] || "";
    const suffix = supportSuffix(it);
    const bits = [];
    // サポート名義は見出しの「（◯◯ サポート）」で出しているので、ここでは重ねない
    if (!suffix && known(it.artist)) bits.push(it.artist);
    if (known(it.venue)) bits.push(it.venue);
    if (known(it.role)) bits.push(it.role);
    const lines = [`<h3 class="t-h3">${esc(it.title)}${esc(suffix)}</h3>`];
    if (bits.length) lines.push(`<p class="row__meta">${bits.map(esc).join(" ／ ")}</p>`);
    return `<div class="row reveal">
        <span class="row__date">${known(it.year) ? esc(it.year) : ""}<span class="row__type">${esc(label)}</span></span>
        <div>
          ${lines.join("\n          ")}
        </div>
      </div>`;
  };
  const HEAD_N = 5;
  const rows = all.slice(0, HEAD_N).map(rowOf).join("\n      ");
  const rest = all.slice(HEAD_N);
  const more = rest.length
    ? `\n    <details class="fold">
      <summary class="fold__sum"><span class="fold__hint">出演をすべて見る（全${all.length}件）</span></summary>
      <div class="rows">
        ${rest.map(rowOf).join("\n        ")}
      </div>
    </details>` : "";

  return `<section class="section" id="live">
  <div class="container">
    ${nest(4, head("Live", "出演"))}
    <div class="rows">
      ${rows}
    </div>${more}
  </div>
  <div class="live__media reveal">${img("live-1", manifest, imeta)}</div>
</section>`;
}

export function spotifyEmbed(url) {
  const m = /open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/.exec(String(url || ""));
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

export function renderListenBlock(p) {
  // 代表3曲は Works で鳴らせるようになったので、ここは全曲まとめて聴ける
  // プレイリスト1本にする（同じ曲を2度出さない）
  const embed = spotifyEmbed(p.links.spotify);
  const list = known(p.spotifyTracks) && p.spotifyTracks.length
    ? `<p class="listen__lead t-caption">まずはこの3曲から：${p.spotifyTracks.map(t => esc(t.title)).join(" ／ ")}</p>` : "";
  const spotify = known(p.links.spotify)
    ? `<div class="listen__item reveal">
        <p class="t-label">Spotify</p>
        <div class="embed"${embed ? ` data-embed="${esc(embed)}"` : ""}>
          <a class="embed__link" href="${esc(p.links.spotify)}" target="_blank" rel="noopener">
            <span class="embed__label">プレイリストを再生</span>
            <span class="t-caption">提供曲・参加曲をまとめて</span>
          </a>
        </div>
      </div>` : "";
  const youtube = known(p.links.youtube)
    ? `<div class="listen__item reveal">
        <p class="t-label">YouTube</p>
        <div class="embed">
          <a class="embed__link" href="${esc(p.links.youtube)}" target="_blank" rel="noopener">
            <span class="embed__label">チャンネルを見る</span>
            <span class="t-caption">YouTube で開く</span>
          </a>
        </div>
      </div>` : "";
  const inner = [spotify, youtube].filter(Boolean);
  if (!inner.length) return "";
  return `<div class="listen-block">
  <p class="t-label listen-block__head">Listen &mdash; まとめて聴く</p>
  ${list}
  <div class="listen listen--two">
    ${inner.join("\n    ")}
  </div>
</div>`;
}

export function renderLesson(p) {
  const l = p.lesson;
  const plans = known(l.plans) ? l.plans.filter(x => known(x.name) && known(x.price)) : [];
  const planRows = plans.map(x => {
    const rec = x.recommended === true ? `<span class="plan__rec">おすすめ</span>` : "";
    const note = known(x.note) ? `<span class="plan__note">${esc(x.note)}</span>` : "";
    return `<div class="row${x.recommended === true ? " row--rec" : ""}">
        <span class="row__date">${esc(x.name)}</span>
        <div><b class="plan__price">${esc(x.price)}</b>${rec}${note}</div>
      </div>`;
  }).join("\n      ");
  const extra = [["対象", l.target], ["場所", l.place], ["お支払い", l.payment]]
    .filter(r => known(r[1])).map(r =>
    `<div class="row">
        <span class="row__date">${esc(r[0])}</span>
        <div>${esc(r[1])}</div>
      </div>`).join("\n      ");
  return `<section class="section invert" id="lesson">
  <div class="container">
    ${nest(4, head("Lesson", "レッスン"))}
    <div class="rows">
      ${[planRows, extra].filter(Boolean).join("\n      ")}
    </div>
    <p class="lesson__note">体験レッスンのお申し込み・ご相談は <a href="#contact">連絡先</a> から。</p>
  </div>
</section>`;
}

export function renderContact(p) {
  const w = p.work || {};
  const workRows = [["料金", w.price], ["納期", w.delivery], ["収録", w.style]]
    .filter(r => known(r[1])).map(r =>
    `<div class="row reveal">
        <span class="row__date">${esc(r[0])}</span>
        <div>${esc(r[1])}</div>
      </div>`).join("\n      ");
  // 何を頼めるか（品目）— 料金や納期より先に出す
  const services = known(w.services) && w.services.length
    ? `<ul class="services">
      ${w.services.filter(s => known(s.name)).map(s => {
        const n = known(s.note) ? `<span class="services__note">${esc(s.note)}</span>` : "";
        return `<li>${esc(s.name)}${n}</li>`;
      }).join("\n      ")}
    </ul>` : "";

  const work = (services || workRows)
    ? `<p class="t-label contact__sub">ご依頼いただけること</p>
    ${services}
    ${workRows ? `<div class="rows">\n      ${workRows}\n    </div>` : ""}` : "";

  // フォームが未完成のあいだも、受け口を必ず1つ出しておく
  const cta = known(p.contactForm)
    ? { url: p.contactForm, action: "お問い合わせフォームへ", note: "" }
    : (known(p.contactCta) && known(p.contactCta.url) ? p.contactCta : null);
  const form = cta
    ? `<p class="contact__cta">
      <a class="btn" href="${esc(cta.url)}" target="_blank" rel="noopener">${esc(cta.action)}</a>
    </p>${known(cta.note) ? `\n    <p class="t-caption contact__ctanote">${esc(cta.note)}</p>` : ""}` : "";

  const items = [];
  if (known(p.email)) items.push(["Email", p.email, `mailto:${p.email}`]);
  const L = p.links;
  if (known(L.instagram)) items.push(["Instagram", "@kitagawa_kouki", L.instagram]);
  if (known(L.x))         items.push(["X", "@Gt_koki_", L.x]);
  if (known(L.youtube))   items.push(["YouTube", "@KokiKitagawa", L.youtube]);
  const rows = items.map(([k, v, href]) => {
    const ext = href.startsWith("mailto:") ? "" : ` target="_blank" rel="noopener"`;
    return `<div class="row reveal">
        <span class="row__date">${esc(k)}</span>
        <div><a class="link" href="${esc(href)}"${ext}>${esc(v)}</a></div>
      </div>`;
  }).join("\n      ");
  return `<section class="section" id="contact">
  <div class="container">
    ${nest(4, head("Contact", "連絡先"))}
    ${work}${form}
    <p class="t-label contact__sub">SNS</p>
    <div class="rows">
      ${rows}
    </div>
  </div>
</section>`;
}

/* ---------- head 内（メタ・OGP・構造化データ） ---------- */

export function renderHead(p, site) {
  const title = "北川弘喜 | ギタリスト・作編曲";
  const desc = "ギタリスト／作編曲家・北川弘喜のポートフォリオ。B-PROJECT・星名美怜らへの楽曲提供、SUMMER SONIC などのサポート出演、舞台での演奏・演技指導まで。";
  const abs = (path) => (site.url ? site.url.replace(/\/$/, "") + "/" + path : path);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    alternateName: p.nameEn,
    jobTitle: p.roles,
    sameAs: Object.values(p.links).filter(known),
  };
  if (site.url) ld.url = site.url;
  const canonical = site.url ? `\n<link rel="canonical" href="${esc(site.url)}">` : "";
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${canonical}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(abs("assets/img/ogp.jpg"))}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>`;
}

/* ---------- ページ全体 ---------- */

export function renderPage(template, data) {
  const { profile, credits, live, media, manifest, images, site } = data;
  const parts = {
    head:    renderHead(profile, site),
    hero:    renderHero(profile, manifest, images),
    about:   renderAbout(profile, manifest, images),
    works:   renderWorks(credits, profile),
    credits: renderCredits(credits),
    live:    renderLive(live, media, manifest, images),
    lesson:  renderLesson(profile),
    contact: renderContact(profile),
  };
  let html = template;
  for (const key of Object.keys(parts)) {
    const marker = `<!-- @${key} -->`;
    const re = new RegExp("^([ \\t]*)" + marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "m");
    const m = re.exec(html);
    if (!m) throw new Error(`template.html に ${marker} が無い`);
    // マーカーの字下げに合わせて断片を入れる（差分が読める形で出すため）
    html = html.replace(re, () => ind(m[1].length, parts[key]));
  }
  // 行の途中に置くマーカー（年号）だけは字下げを見ずにそのまま差し替える
  html = html.split("<!-- @year -->").join(String(site.year));
  return html;
}

/** 生成物の自己点検。SPEC 11章「受入基準」の機械で見られる部分。 */
export function auditHtml(html) {
  const problems = [];
  if (html.includes("要確認")) problems.push("『要確認』が画面に出ている");
  if (/<img(?![^>]*\salt=)/.test(html)) problems.push("alt の無い <img> がある");
  if (/<img(?![^>]*\swidth=)/.test(html)) problems.push("width の無い <img> がある");
  if (/<img(?![^>]*\sheight=)/.test(html)) problems.push("height の無い <img> がある");
  if ((html.match(/class="[^"]*\binvert\b/g) || []).length !== 1) problems.push(".invert が1箇所ではない");
  if ((html.match(/<h1\b/g) || []).length !== 1) problems.push("h1 が1つではない");
  if (html.includes("undefined") || html.includes("[object Object]")) problems.push("undefined / [object Object] が混ざっている");
  return problems;
}
