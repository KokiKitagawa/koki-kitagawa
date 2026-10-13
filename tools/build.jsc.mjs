/* Node が無い Mac 用のビルド入口（tools/build.sh から呼ばれる）。
   読み書きだけ JavaScriptCore の readFile / writeFile に差し替え、
   中身は build.mjs と同じ src/render.mjs・src/pipeline.mjs を使う。 */
import { renderPage, auditHtml } from "../src/render.mjs";
import { buildOutputs, ROOT_FILES } from "../src/pipeline.mjs";

const files = {};
for (const p of ROOT_FILES) files[p] = readFile(p);

const out = buildOutputs(files, { renderPage, auditHtml, now: new Date().getFullYear() });

for (const name of Object.keys(out.files)) {
  writeFile(name, out.files[name]);
  print("書き出し: " + name + "  " + out.files[name].length + " 文字");
}
for (const w of out.warnings) print("警告: " + w);
print("ビルド OK");
