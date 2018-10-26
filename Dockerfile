FROM node:10

LABEL maintainer="docker@elementia.me"

ENV DEBIAN_FRONTEND noninteractive



WORKDIR /app
ADD . /app

VOLUME /images
VOLUME /data

RUN chown -R node:node /app

USER node
RUN /usr/local/bin/npm install

EXPOSE 3000/tcp

ENV PICREAD_DB_NAME /data/persistance.sqlite

CMD ["/usr/local/bin/node", "/app/app.js"]