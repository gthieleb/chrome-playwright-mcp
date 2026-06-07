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

# Copy files
COPY --chown=1000:1000 config/config.json /config/config.json
COPY --chown=1000:1000 config/config-plus.json /config/config-plus.json
COPY --chown=0:0 s6-services /etc/services.d
RUN chmod +x /etc/services.d/playwright/run
RUN chown -R 1000:1000 /config
USER 1000:1000

EXPOSE 3002
WORKDIR /config
