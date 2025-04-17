# Arguments
ARG NODE_VERSION=lts-alpine

# NOTE: Ensure you set NODE_VERSION Build Argument as follows...
#
#  export NODE_VERSION="$(cat .nvmrc)-alpine" \
#  docker build \
#    --build-arg NODE_VERSION=$NODE_VERSION \
#    -t mojaloop/sdk-scheme-adapter:local \
#    . \
#

# Build Image
FROM node:${NODE_VERSION} AS builder

WORKDIR /opt/app

RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool openssl-dev autoconf automake chromium \
    && cd $(npm root -g)/npm

COPY package.json package-lock.json* /opt/app/
COPY patches /opt/app/patches
RUN npm ci

COPY src /opt/app/src

FROM node:${NODE_VERSION}
WORKDIR /opt/app

# Create a non-root user: ml-user
RUN adduser -D ml-user 
USER ml-user

COPY --chown=ml-user --from=builder /opt/app .
RUN npm prune --production

EXPOSE 3000
CMD ["npm", "start"]
