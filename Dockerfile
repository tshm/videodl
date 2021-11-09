FROM node:16-alpine
ENV APP_ROOT /app/
ENV PATH $PATH:$APP_ROOT/bin
ENV CONF /root/.config/yt-dlp

WORKDIR $APP_ROOT

RUN apk add --no-cache python3 && \
  mkdir -p bin $CONF &&\
  wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O bin/youtube-dl && \
  chmod a+x bin/youtube-dl

COPY package*.json yarn.lock ./
RUN yarn --prod --link-duplicates --pure-lockfile

COPY index.mjs .
CMD ["sh", "-c", "echo $YT_DL_CONF > $CONF/config && node index.mjs ./dl"]
# ./node_modules/.bin/pino-elasticsearch --node $LOG
