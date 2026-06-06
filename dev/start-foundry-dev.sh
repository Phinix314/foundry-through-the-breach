#!/usr/bin/env bash

### start with:
#~/foundry-dev/start-foundry-dev.sh
# Testserver should be up on: http://127.0.0.1:30001

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

nvm use 24 >/dev/null || exit 1

cd "$HOME/foundry-dev/app" || exit 1
node main.js --dataPath="$HOME/foundry-dev/data" --port=30001