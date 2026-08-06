#!/usr/bin/env bash
# Deploy. Run from anywhere: /path/to/WInfBot/deploy.sh
#
# The node version comes from .nvmrc, which must match the `interpreter` pm2
# starts the bot with, so the build and the running process always agree.
cd "$(dirname "$0")"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
. "$NVM_DIR/nvm.sh"
nvm use || exit 1

set -euo pipefail

git pull
npm ci          # dev deps included - typescript is needed to build
npm run build   # `rm -rf dist && tsc`, fails loudly on a type error

test -f dist/index.js

pm2 restart winfbot
