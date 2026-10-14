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
import { buildOutputs, ROOT_FILES } from "./src/render.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const files = {};
for (const p of ROOT_FILES) files[p] = readFileSync(join(ROOT, p), "utf8");

const out = buildOutputs(files);
for (const [name, body] of Object.entries(out.files)) {
  writeFileSync(join(ROOT, name), body);
  console.log("書き出し: " + name + "  " + Buffer.byteLength(body) + " bytes");
}
for (const w of out.warnings) console.log("警告: " + w);
if (out.warnings.length) process.exitCode = 1; else console.log("ビルド OK");
