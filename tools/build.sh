#!/bin/sh
# Node が入っていない Mac 用のビルド。
# macOS 同梱の JavaScriptCore で src/render.mjs をそのまま動かす。
# 出力は node build.mjs と同じ（描画の中身を共有しているため）。
set -e
JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
if [ ! -x "$JSC" ]; then
  echo "JavaScriptCore が見つかりません。node build.mjs を使ってください。" >&2
  exit 1
fi
cd "$(dirname "$0")/.."
"$JSC" -m tools/build.jsc.mjs
