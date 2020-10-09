#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

PATH=$PATH:~/bin/
WD=$(pwd)
nvm use default

cd $(dirname $0)
source env.sh

node dist/index.js $WD | yarn pino-elasticsearch --node $LOG

youtube-dl -U
