FROM ghcr.io/linuxserver/baseimage-kasmvnc:debianbookworm

WORKDIR /app

# Configure KASM VNC
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TITLE=Playwright
ENV START_DOCKER=false
ENV NO_DECOR=true

RUN mkdir -p /config/chrome-profile /config/output /config/chrome-profile-plus /sessions/recherche /sessions/testing /sessions/admin && \
    chown -R 1000:1000 /config /sessions

# Use ARGs for versions to make updates easy and explicit
ARG UV_VERSION=0.8.3
ARG NODE_VERSION=20.x
ARG DEBIAN_FRONTEND=noninteractive

# Disable NPM update check
RUN npm config set update-notifier false > /dev/null

# Install playright and browser dependencies in one layer
RUN npx playwright install --with-deps && \
    npx playwright install chrome && \
    npm cache clean --force

# Install MCP support
RUN npm install -g @playwright/mcp@latest @ai-coding-labs/playwright-mcp-plus@latest && \
    npm cache clean --force

RUN chown -R 1000:1000 /config

# Copy config files to /defaults (linuxserver convention) since /config is a volume
COPY --chown=1000:1000 config/config.json /defaults/config.json
COPY --chown=1000:1000 config/config-plus.json /defaults/config-plus.json

# Install s6 service for s6-overlay v3
COPY --chown=0:0 s6-services/playwright/run /etc/s6-overlay/s6-rc.d/svc-playwright/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/svc-playwright/run && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/svc-playwright/type && \
    mkdir -p /etc/s6-overlay/s6-rc.d/svc-playwright/dependencies.d && \
    touch /etc/s6-overlay/s6-rc.d/svc-playwright/dependencies.d/init-services && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/svc-playwright

RUN chown -R 1000:1000 /config

EXPOSE 3002
WORKDIR /config
