/* ============================================================
   build.mjs — data/*.json + src/template.html → index.html

   実行： node build.mjs
   Node が入っていない Mac では： sh tools/build.sh
   （どちらも src/render.mjs を呼ぶので、出力は同じ）

   依存パッケージは入れない。Node 標準ライブラリだけで書く。
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage, auditHtml } from "./src/render.mjs";
import { buildOutputs, ROOT_FILES } from "./src/pipeline.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const files = {};
for (const p of ROOT_FILES) files[p] = read(p);

const out = buildOutputs(files, { renderPage, auditHtml, now: new Date().getFullYear() });

for (const [name, body] of Object.entries(out.files)) {
  writeFileSync(join(ROOT, name), body);
  console.log("書き出し: " + name + "  " + Buffer.byteLength(body) + " bytes");
}
for (const w of out.warnings) console.log("警告: " + w);
console.log("ビルド OK");
