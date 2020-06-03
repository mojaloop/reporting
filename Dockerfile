FROM node:12.18.0-alpine as builder

RUN apk add --no-cache git

WORKDIR /opt/reports

COPY package.json package-lock.json* /opt/reports/
COPY src /opt/reports/src

RUN npm ci --production

FROM node:12.18.0-alpine

WORKDIR /opt/reports

COPY --from=builder /opt/reports .

EXPOSE 3000
CMD ["npm", "run", "start"]
