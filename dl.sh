#!/bin/bash
PATH=$PATH:~/bin/
WD=$(pwd)

cd $(dirname $0)
source .env

node dist/index.js $WD | yarn pino-elasticsearch --node $LOG

