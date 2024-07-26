#!/bin/bash
WD=$(pwd)
DIR=$(dirname $0)
cd ${DIR}

export PATH=${PATH}:${DIR}/.devbox/nix/profile/default/bin
export $(cat .env.* | xargs)

bun run -r '@hyperdx/node-opentelemetry/build/src/tracing' index.ts ${WD}
