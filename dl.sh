#!/bin/bash
WD=$(pwd)
DIR=$(dirname $0)
cd ${DIR}

export PATH=${PATH}:${HOME}/.local/bin:${DIR}/.devbox/nix/profile/default/bin
export $(cat .env.* | xargs)

yt-dlp -U
bun run -r '@hyperdx/node-opentelemetry/build/src/tracing' index.ts ${WD}
