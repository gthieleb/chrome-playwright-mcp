# Chrome MCP Docker Container

A Docker container that provides a web-based desktop environment with Playwright MCP (Model Context Protocol) server for browser automation.

## Overview

This container combines:
- **KasmVNC**: Web-accessible Linux desktop environment
- **Playwright MCP Server**: Browser automation through Model Context Protocol
- **Chrome Browser**: For automation and manual use

## Features

- **x86_64 Architecture**: Built for amd64/x86_64 platforms (Chrome requirement)
- **Web-based desktop**: Accessible through any browser to see Chrome sessions
- **Playwright MCP server**: Running on port 3002
- **PDF and vision capabilities**: Built-in support
- **Structured browser automation**: Without screenshots
- **Output directory**: For saving results
- **Auto-built containers**: Available from GitHub Container Registry

## Quick Start

### Pull Pre-built Container (Recommended)

The container is automatically built for x86_64 architecture and published to GitHub Container Registry:

```bash
docker pull ghcr.io/bradsjm/chrome-mcp:latest
```

### Run the Container

```bash
docker run -d \
  --name chrome-mcp \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 3002:3002 \
  -v $(pwd)/config:/config \
  ghcr.io/bradsjm/chrome-mcp:latest
```

### Build Locally (Optional)

```bash
docker build -t chrome-mcp .
```

## Usage

1. Access the web desktop at `http://localhost:3000` or `https://localhost:3001`
2. Configure your MCP client to connect to the server (see above)
3. Use browser automation through your preferred MCP client
4. Outputs are saved to the mounted output directory

### Docker Compose Override (recommended for local setup)

This repo uses `docker-compose.yml` as the base file and
`docker-compose.override.example.yml` as a local template.

1. Copy the example:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
```

2. Adjust ports/volumes locally as needed.

3. Start normally:

```bash
docker compose up -d
```

Docker Compose automatically loads `docker-compose.override.yml` when present.

> `docker-compose.override.yml` is gitignored, so local machine-specific changes
> (ports, volume choice, host bindings) are not committed.

### MCP Server

The Playwright MCP server is available at `http://localhost:3002` and automatically starts when the container launches. It supports both SSE and streaming HTTP protocols.

For most MCP clients, add this configuration to connect to the containerized server:

- SSE: `http://localhost:3002/sse`
- Streaming HTTP: `http://localhost:3002/mcp`

## Configuration

The MCP server configuration is located at `/config/config.json`:

- **Port**: 3002
- **Browser**: Chrome (non-headless)
- **Capabilities**: PDF and vision support
- **Output Directory**: `/config/output`

## Architecture

- **Base Image**: `ghcr.io/linuxserver/baseimage-kasmvnc:debianbookworm`
- **MCP Server**: `@playwright/mcp@latest`
- **Browser**: Chrome with Playwright

## Process Overview

When the container is running, you should see the following processes:

### Core Services

- **s6-supervise playwright** (root): s6 service supervisor managing the Playwright MCP service
- **playwright-mcp** (abc/user): The Playwright MCP server listening on port 3002
- **Xvnc** (abc/user): KasmVNC server providing the web-based desktop

### Chrome Browser (when active)

When a browser session is initialized through the MCP server, Chrome processes appear:

- **chrome** (abc/user): Main Chrome browser process with `--user-data-dir=/config/chrome-profile`
- **chrome --type=gpu-process**: GPU rendering process
- **chrome --type=renderer**: Page rendering processes (one per tab)
- **chrome --type=zygote**: Process spawner
- **chrome_crashpad_handler**: Crash reporting handler

### Checking Process State

```bash
# List all Chrome and Playwright processes
docker exec chrome-mcp ps aux | grep -E "chrome|playwright"

# Check if MCP server is responding
curl -s http://localhost:3002/sse

# View Playwright MCP logs
docker exec chrome-mcp cat /config/output/playwright-mcp.log
```

> **Note**: Chrome only appears in the process list after the first browser automation call through the MCP server. The browser persists across calls when using `sharedBrowserContext: true` in the config.

## Development

The container includes:
- Xterm terminal access
- Chrome browser in the desktop menu
- Playwright browsers installed with dependencies
- MCP server auto-start configuration

## Container Registry

Pre-built container images are available at:
- **Registry**: `ghcr.io/bradsjm/chrome-mcp`
- **Supported Architecture**: linux/amd64 (x86_64 only - Chrome requirement)
- **Tags**: `latest`, `main`, version tags

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
