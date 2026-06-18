/**
 * Postinstall patch: @uiw/react-codemirror v4.25.10 coerces `value={undefined}` to `''`
 * in its index.js, which defeats the useCodeMirror early-return guard. This patch
 * preserves `undefined` so the uncontrolled mode works correctly (no value-sync during
 * IME composition). Must run after every `npm install`.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'node_modules/@uiw/react-codemirror/esm/index.js',
  'node_modules/@uiw/react-codemirror/cjs/index.js',
];

const needle = "value = _props$value === void 0 ? '' : _props$value,";
const replacement = "value = _props$value,";

let patched = 0;
for (const file of files) {
  const abs = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(abs)) continue;
  let content = fs.readFileSync(abs, 'utf8');
  if (content.includes(needle)) {
    content = content.replace(needle, replacement);
    fs.writeFileSync(abs, content, 'utf8');
    patched++;
  }
}

if (patched > 0) {
  console.log(`[patch-codemirror] Patched ${patched} file(s) for IME uncontrolled mode`);
}
