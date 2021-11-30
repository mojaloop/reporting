FROM node:lts-buster-slim as builder

RUN apt-get update \
 && apt-get install -y git

WORKDIR /opt/reporting

COPY package.json package-lock.json* /opt/reporting/
COPY patches /opt/reporting/patches

RUN npm ci --production --unsafe-perm

COPY src /opt/reporting/src


FROM node:lts-buster-slim

WORKDIR /opt/reporting

RUN apt-get update \
 && apt-get install -y libdrm2 libgtk-3-0 libgbm1 libasound2 libxshmfence1 libnss3 libx11-xcb1

COPY --from=builder /opt/reporting .

EXPOSE 3000
CMD ["npm", "start"]
