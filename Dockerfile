FROM node:16-alpine
RUN apk add --no-cache python3 ffmpeg && \
  npm install -g pnpm

ARG UNAME=node
# ARG UID=1000
# ARG GID=1000
# RUN grep :$GID: /etc/group || addgroup -g $GID $UNAME
# RUN adduser -D -u $UID -G $UNAME $UNAME

ENV HOME /home/$UNAME
ENV PATH $PATH:$HOME/bin
ENV CONF $HOME/.config/yt-dlp

USER $UNAME
WORKDIR $HOME
RUN mkdir -p bin $CONF &&\
  wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O bin/youtube-dl && \
  chmod a+x bin/youtube-dl

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY index.mjs .
CMD ["sh", "-c", "echo $YT_DL_CONF > $CONF/config && node index.mjs ./dl"]
# ./node_modules/.bin/pino-elasticsearch --node $LOG
