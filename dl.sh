#!/bin/bash
WD=$(pwd)
cd $(dirname $0)

export PATH=${PATH}:.devbox/nix/profile/default/bin
export VECTOR_LOG_FORMAT=json
export $(cat .env | xargs)

bun run index.ts ${WD}
