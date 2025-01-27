ARG NODE_VERSION=22.13.1
FROM node:${NODE_VERSION}

RUN mkdir /build/
WORKDIR /build
COPY . /build/

