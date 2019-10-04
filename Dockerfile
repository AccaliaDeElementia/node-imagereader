FROM node:12

LABEL maintainer="docker@elementia.me"

ENV DEBIAN_FRONTEND noninteractive

WORKDIR /app
ADD . /app


RUN mkdir /data \
  && \
  chown -R node:node /app \
  && \
  chown -R node:node /data \
  && \
  apt-get update \
  && \
  apt-get install -y webp

USER node
RUN /usr/local/bin/npm --production install

EXPOSE 3000/tcp

ENV PICREAD_DB_ENVIRONMENT production

VOLUME /images
VOLUME /data

CMD ["/usr/local/bin/node", "/app/app.js"]