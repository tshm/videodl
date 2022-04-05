#!/bin/bash
WD=$(pwd)
cd $(dirname $0)

export $(cat .env | xargs)

docker run --rm --env-file .env -v $WD:/home/node/dl videodl |\
  vector --config .vector.toml

# docker run -v $(pwd)/vector.toml:/etc/vector/vector.toml:ro -p 8383:8383 timberio/vector:0.20.0-alpine
