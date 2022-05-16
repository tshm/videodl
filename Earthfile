VERSION 0.6

FROM node:16-alpine
RUN apk add --no-cache python3 ffmpeg && \
  npm install -g pnpm

ARG UNAME=node

ENV HOME /home/$UNAME
ENV PATH $PATH:$HOME/bin
ENV CONF $HOME/.config/yt-dlp
ENV IMAGE ghcr.io/tshm/videodl

USER $UNAME
WORKDIR $HOME

build:
  RUN mkdir -p bin &&\
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O bin/youtube-dl && \
    chmod a+x bin/youtube-dl

  COPY package*.json pnpm-lock.yaml ./
  RUN pnpm install --prod --frozen-lockfile

  COPY index.mjs .
  COPY .yt-dlp.conf $CONF/config
  CMD ["sh", "-c", "node index.mjs ./dl"]
  SAVE IMAGE --push $IMAGE:latest
