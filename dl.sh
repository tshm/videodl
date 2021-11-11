#!/bin/bash
WD=$(pwd)
cd $(dirname $0)

docker run --rm --env-file .env -v $WD:/home/node/dl videodl

