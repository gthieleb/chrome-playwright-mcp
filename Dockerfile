FROM ghcr.io/linuxserver/baseimage-kasmvnc:debianbookworm

WORKDIR /app

# Configure KASM VNC
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TITLE=Playwright
ENV START_DOCKER=false
ENV NO_DECOR=true

RUN mkdir -p /config/chrome-profile /config/mcp-profile /config/output /config/sessions && \
    chown -R 1000:1000 /config

# Use ARGs for versions to make updates easy and explicit
ARG UV_VERSION=0.8.3
ARG NODE_MAJOR=22
ARG DEBIAN_FRONTEND=noninteractive

# Install Node.js LTS (stock @playwright/mcp requires Node >= 20; baseimage
# ships bookworm's node 18 which is too old)
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    node --version

# Disable NPM update check
RUN npm config set update-notifier false > /dev/null

# Install playright and browser dependencies in one layer
RUN npx playwright install --with-deps && \
    npx playwright install chrome && \
    npm cache clean --force

# Install MCP support (stock @playwright/mcp, pinned version)
ARG PLAYWRIGHT_MCP_VERSION=0.0.81
RUN npm install -g @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} && \
    npm cache clean --force

# kclient (LSIO baseimage) audio shim: its pulseaudio2 native module is prebuilt
# for Node 18 and throws on newer Node, crashing the kclient process at boot.
# Audio is irrelevant in this headless container, so stub it out gracefully.
RUN sed -i \
      -e "s|var PulseAudio = require('pulseaudio2');|var PulseAudio = function () {};|" \
      -e "s|var pulse = new PulseAudio();|var pulse = { on: function () {} };|" \
      /kclient/index.js && \
    node --check /kclient/index.js

RUN chown -R 1000:1000 /config

# Copy config files to /defaults (linuxserver convention) since /config is a volume
COPY --chown=1000:1000 config/config.json /defaults/config.json
COPY --chown=1000:1000 root/defaults/autostart /defaults/autostart
COPY --chown=1000:1000 root/defaults/menu.xml /defaults/menu.xml

# Install s6 service for s6-overlay v3
COPY --chown=0:0 s6-services/playwright/run /etc/s6-overlay/s6-rc.d/svc-playwright/run
COPY --chown=1000:1000 s6-services/session-tools/server.js /opt/session-tools/server.js
COPY --chown=0:0 s6-services/session-tools/run /etc/s6-overlay/s6-rc.d/svc-session-tools/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/svc-playwright/run /etc/s6-overlay/s6-rc.d/svc-session-tools/run && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/svc-playwright/type && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/svc-session-tools/type && \
    mkdir -p /etc/s6-overlay/s6-rc.d/svc-playwright/dependencies.d /etc/s6-overlay/s6-rc.d/svc-session-tools/dependencies.d && \
    touch /etc/s6-overlay/s6-rc.d/svc-playwright/dependencies.d/init-services && \
    touch /etc/s6-overlay/s6-rc.d/svc-session-tools/dependencies.d/init-services && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/svc-playwright && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/svc-session-tools

RUN chown -R 1000:1000 /config

EXPOSE 3002
WORKDIR /config
