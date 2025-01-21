FROM grafana/k6:0.56.0 as builder
FROM node:22.13.0-slim

ARG BUILD_DATE
ARG APP_VERSION

LABEL org.opencontainers.image.authors='Martin Reinhardt (martin@m13t.de)' \
    org.opencontainers.image.created=$BUILD_DATE \
    org.opencontainers.image.version=$APP_VERSION \
    org.opencontainers.image.url='https://hub.docker.com/r/cloudtooling/k6s' \
    org.opencontainers.image.documentation='https://github.com/CloudTooling/k6s' \
    org.opencontainers.image.source='https://github.com/CloudTooling/k6s.git' \
    org.opencontainers.image.licenses='MIT'

COPY . /app

WORKDIR /app

RUN npm install --omit=dev &&\
    chown -R 1000:2000 /app

# apt update
RUN apt-get update && apt-get -y upgrade &&\
  # clean up to slim image
  apt-get clean autoclean && apt-get autoremove --yes && rm -rf /var/lib/{apt,dpkg,cache,log}/

COPY --from=builder /usr/bin/k6 /usr/bin/k6

USER 1000
