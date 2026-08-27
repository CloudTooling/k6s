ARG K6_VERSION=2.2.0

FROM node:24.20.0-slim AS builder

WORKDIR /app
COPY . /app
RUN npm ci
RUN npm run build

FROM grafana/k6:${K6_VERSION}

ARG BUILD_DATE
ARG APP_VERSION

LABEL org.opencontainers.image.authors='Martin Reinhardt (martin@m13t.de)' \
    org.opencontainers.image.created=$BUILD_DATE \
    org.opencontainers.image.version=$APP_VERSION \
    org.opencontainers.image.url='https://hub.docker.com/r/cloudtooling/k6s' \
    org.opencontainers.image.documentation='https://github.com/CloudTooling/k6s' \
    org.opencontainers.image.source='https://github.com/CloudTooling/k6s.git' \
    org.opencontainers.image.licenses='MIT'

COPY --from=builder /app/dist /scripts

ENTRYPOINT ["k6"]