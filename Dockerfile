FROM node:12.18.0-alpine as builder

RUN apk add --no-cache git

WORKDIR /opt/reporting

COPY package.json package-lock.json* /opt/reporting/
COPY src /opt/reporting/src

RUN npm ci --production

FROM node:12.18.0-alpine

WORKDIR /opt/reporting

COPY --from=builder /opt/reporting .

EXPOSE 3000
CMD ["npm", "start"]
