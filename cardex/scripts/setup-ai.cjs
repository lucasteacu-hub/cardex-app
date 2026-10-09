// Run locally in your own terminal. Input is never printed or sent to chat.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../server/credentials.local.json');
if (!process.stdin.isTTY) { console.error('Run this in an interactive Terminal on your Mac.'); process.exit(1); }
let input = '';
process.stdout.write('Paste your OpenAI API key (hidden), then press Return: ');
process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
function finish() { process.stdin.setRawMode(false); process.stdin.pause(); }
process.stdin.on('data', chunk => {
  for (const char of chunk) {
    if (char === '\u0003') { finish(); process.stdout.write('\nCancelled.\n'); process.exit(0); }
    if (char === '\r' || char === '\n') {
      finish(); const key = input.trim();
      if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) { console.error('\nThat does not look like an OpenAI API key. Nothing was saved.'); process.exit(1); }
      fs.writeFileSync(file, JSON.stringify({ apiKey: key }), { mode: 0o600 }); fs.chmodSync(file, 0o600);
      process.stdout.write('\nSaved privately on this Mac. You can now tap Identify this car.\n'); process.exit(0);
    }
    if (char === '\u007f' || char === '\b') input = input.slice(0,-1);
    else if (char >= ' ') input += char;
  }
});
