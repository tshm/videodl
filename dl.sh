#!/bin/bash
WD=$(pwd)
DIR=$(dirname $0)
cd ${DIR}

export PATH=${PATH}:${DIR}/.devbox/nix/profile/default/bin
export VECTOR_LOG_FORMAT=json
export $(cat .env.* | xargs)

bun run index.ts ${WD} | vector
