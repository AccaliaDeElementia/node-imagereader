FROM node:10

LABEL maintainer="docker@elementia.me"

ENV DEBIAN_FRONTEND noninteractive

USER node

WORKDIR /app
ADD . /app

VOLUME /images
VOLUME /data

RUN /usr/local/bin/npm install

EXPOSE 3000/tcp

ENV PICREAD_DB_NAME /data/persistance.sqlite

CMD ["/usr/local/bin/node", "/app/app.js"]