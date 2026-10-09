#!/bin/zsh
cd "${0:A:h}" || exit 1
if command -v node >/dev/null 2>&1; then
  node scripts/setup-ai.cjs
elif [[ -x /Users/karus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ]]; then
  /Users/karus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/setup-ai.cjs
else
  print 'Node.js is needed. Ask for help setting it up.'
fi
read '?Press Return to close.'
