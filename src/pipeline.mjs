/* ============================================================
   pipeline.mjs — 「読み込んだ文字列 → 書き出す文字列」の段取り。
   ファイルの読み書きそのものは呼び出し側（build.mjs / tools/build.jsc.mjs）が持つ。
   ここも Node 固有の API を使わないこと。
   ============================================================ */

export const ROOT_FILES = [
  "src/template.html",
  "data/profile.json",
  "data/credits.json",
  "data/live.json",
  "data/media.json",
  "data/images.json",
  "assets/img/manifest.json",
];

function parse(files, name) {
  try {
    return JSON.parse(files[name]);
  } catch (e) {
    throw new Error(`${name} が JSON として読めない: ${e.message}`);
  }
}

/** データの最低限の点検。おかしければ止める（黙って空を出さない） */
function validate(profile, credits, live, media, images, manifest) {
  const bad = [];
  if (!profile.name) bad.push("profile.json に name が無い");
  if (!Array.isArray(credits) || credits.length === 0) bad.push("credits.json が空");
  const CATS = ["compose", "guitar", "karaoke"];
  credits.forEach((c, i) => {
    if (!c.title)  bad.push(`credits[${i}] に title が無い`);
    if (!c.artist) bad.push(`credits[${i}] (${c.title}) に artist が無い`);
    if (!CATS.includes(c.category)) bad.push(`credits[${i}] (${c.title}) の category が不正: ${c.category}`);
    if (c.year !== null && typeof c.year !== "number") bad.push(`credits[${i}] (${c.title}) の year は数値か null`);
  });
  const TYPES = ["live", "tv", "stage"];
  live.concat(media).forEach((it, i) => {
    if (!it.title) bad.push(`live/media[${i}] に title が無い`);
    if (!TYPES.includes(it.type)) bad.push(`live/media[${i}] (${it.title}) の type が不正: ${it.type}`);
    if (it.year !== null && typeof it.year !== "number") bad.push(`live/media[${i}] (${it.title}) の year は数値か null`);
  });
  for (const role of Object.keys(images)) {
    if (!manifest[role]) bad.push(`images.json の '${role}' に対応する画像が無い（tools/build-images.py を実行する）`);
    else if (!images[role].alt) bad.push(`images.json の '${role}' に alt が無い`);
  }
  if (bad.length) throw new Error("データの不備:\n  - " + bad.join("\n  - "));
}

export function buildOutputs(files, { renderPage, auditHtml, now }) {
  const template = files["src/template.html"];
  const profile  = parse(files, "data/profile.json");
  const credits  = parse(files, "data/credits.json");
  const live     = parse(files, "data/live.json");
  const media    = parse(files, "data/media.json");
  const images   = parse(files, "data/images.json");
  const manifest = parse(files, "assets/img/manifest.json");

  validate(profile, credits, live, media, images, manifest);

  const site = { url: profile.siteUrl || null, year: now };
  const html = renderPage(template, { profile, credits, live, media, manifest, images, site });

  const problems = auditHtml(html);
  if (problems.length) throw new Error("生成物の自己点検で不合格:\n  - " + problems.join("\n  - "));

  const out = { "index.html": html };
  const warnings = [];

  // robots.txt / sitemap.xml。公開URLが決まるまで sitemap は作らない（URLを捏造しない）
  if (site.url) {
    const base = site.url.replace(/\/$/, "") + "/";
    out["robots.txt"] = `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`;
    out["sitemap.xml"] =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n    <loc>${base}</loc>\n  </url>\n</urlset>\n`;
  } else {
    out["robots.txt"] = `User-agent: *\nAllow: /\n`;
    warnings.push("profile.json の siteUrl が未設定。sitemap.xml と OGP の絶対URLを出していない（公開URLが決まったら入れて再ビルド）");
  }

  return { files: out, warnings };
}
