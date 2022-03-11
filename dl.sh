#!/bin/bash
WD=$(pwd)
cd $(dirname $0)

docker run --rm --env-file .env -v $WD:/home/node/dl videodl
# docker run -v $(pwd)/vector.toml:/etc/vector/vector.toml:ro -p 8383:8383 timberio/vector:0.20.0-alpine

