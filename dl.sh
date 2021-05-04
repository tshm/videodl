#!/bin/bash
PATH=$PATH:~/bin/
WD=$(pwd)

cd $(dirname $0)
source .env

node index.mjs $WD | yarn pino-elasticsearch --node $LOG
youtube-dl -U

