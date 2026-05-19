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

This repo keeps `docker-compose.yml` as the base file and provides
`docker-compose.override.example.yml` as a local template.

1. Copy the example:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
```

2. Adjust ports/volumes as needed locally.

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

The MCP server configuration is located at `/config/config.json` and controls all MCP server settings:

- **Port**: 3002
- **Browser**: Chrome (non-headless)
- **Capabilities**: PDF and vision support
- **Output Directory**: `/config/output`

## Volumes

The container uses Docker named volumes for persistent data:

| Volume | Mount | Purpose |
|--------|-------|---------|
| `chrome-mcp-dev-profile` | `/config/chrome-profile` | Chrome browser profile (cookies, sessions, logins) |
| `chrome-mcp-dev-output` | `/config/output` | Automation artifacts, screenshots, PDFs, logs |

> **Warning**: Running `docker compose down -v` will **permanently destroy** these volumes and all stored data. Use `docker compose down` (without `-v`) to stop the container while preserving data.

### Migrating from bind mounts

If you previously used bind mounts (`./config/chrome-profile`), copy your data into the named volume:

```bash
docker compose up -d
docker cp ./config/chrome-profile/. chrome-mcp-dev:/config/chrome-profile/
```

## Architecture

- **Base Image**: `ghcr.io/linuxserver/baseimage-kasmvnc:debianbookworm`
- **MCP Server**: `@playwright/mcp@latest`
- **Browser**: Chrome with Playwright

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

## Advanced: Playwright Extension Mode (Future)

The Playwright MCP server supports an `extension` mode that allows controlling an already-running Chrome browser via the [Playwright Extension](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm) Chrome add-on (`mmlmfjhmonkocbjadbfplnigmagldckm`).

**Potential benefit**: Control the VNC-visible Chrome directly, enabling better integration with manual browsing sessions and persistent login state.

**Current limitations**:
- Timeout issues during extension connection (timeout is controlled by the MCP client, not the server)
- Requires architecture changes: MCP server cannot start before Chrome is running
- Startup ordering between Chrome and MCP service needs coordination

This feature is tracked in [GitHub Issues](../../issues) — search for "Playwright Extension" for the analysis issue.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
