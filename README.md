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

## Playwright Implementation

This container runs the **official** `@playwright/mcp` server (pinned version via the `PLAYWRIGHT_MCP_VERSION` build ARG, default `0.0.81`). The former Playwright Plus implementation (`@ai-coding-labs/playwright-mcp-plus`) and its selector environment variable `PLAYWRIGHT_IMPLEMENTATION` have been removed — the package is unmaintained (npm frozen since October 2025, issues disabled).

Isolation model with stock MCP: each HTTP/SSE client session gets its own isolated browser context natively (`browser.isolated: true` in `config.json`). There is no `--project-isolation` flag and no per-tool-call `projectPath`/`projectDrive` parameters — per-client isolation is handled by the MCP server per HTTP session.

> This container does **not** run in that isolated mode. See [Browser Session Model](#browser-session-model) for the shared persistent-profile model used here.

## Browser Session Model

The container runs **one persistent, visible Chrome instance shared by all MCP clients** — the "B+" model. All connected HTTP client sessions (opencode instances, scripts) reuse the *same* browser context, so cookies, logins and open tabs are visible to every client.

`config/config.json` (shipped as `/defaults/config.json`, force-synced onto the PVC at boot by the runner):

```json
{
    "browser": {
        "isolated": false,
        "userDataDir": "/config/mcp-profile",
        "launchOptions": { "headless": false }
    },
    "sharedBrowserContext": true
}
```

| Mechanism | Effect |
|---|---|
| `isolated: false` + `userDataDir` | Persistent profile on PVC (`/config/mcp-profile`) — logins and cookies survive browser and pod restarts |
| `sharedBrowserContext: true` | All HTTP clients share ONE browser context — concurrent agents see the same tabs |
| `headless: false` + `DISPLAY=:1` (runner) | Chrome renders on the KasmVNC display → visible in the web desktop for manual intervention (2FA, captchas) |

**Why this works without lock contention** (the reason an earlier persistent-profile setup was reverted in commit `30662be`): Chromium's `SingletonLock` allows only ONE browser process per user-data-dir. Contended setups launch a browser per client session against the same profile and fail with *"Browser is already in use"*. Here the MCP server process owns the single browser; clients attach via HTTP, so exactly one Chrome process exists per profile. The desktop Chrome (autostart, manual logins) uses a separate profile (`/config/chrome-profile`).

**Profile lock after unclean kills:** If a pod is killed abruptly, the `SingletonLock` file survives on the PVC and Chrome shows a modal *"profile appears to be in use … on another computer"* dialog that blocks every tool call. The runner removes stale locks on every start. If one appears at runtime: `pkill -9 -f "user-data-dir=/config/mcp-profile" && rm -f /config/mcp-profile/Singleton*`.

**Idle behavior:** `--idle-timeout 3600000` closes the shared browser after 1 h without tool calls; the next call relaunches it from the persistent profile. Sessions do not survive idle-closes implicitly — set `--idle-timeout 0` to keep the browser open indefinitely.

**First call after a browser launch may hang.** Observed under host load (2-core node, load > 90): the first `browser_navigate` after a fresh Chrome launch can exceed the client timeout with zero bytes; the identical retry succeeds immediately. If a first call hangs, retry once before debugging further.

**Trade-off:** with a shared context there is no isolation between concurrent agents — two agents navigating simultaneously fight over the same tabs, and both see each other's session state. For isolated parallel testing use `--isolated` (ephemeral, invisible) instead.

## Configuration

The MCP server configuration is located at `/config/config.json`:

- **Port**: 3002
- **Browser**: Chrome, headed on the KasmVNC display (`headless: false`)
- **Profile**: `/config/mcp-profile` (persistent, shared across all clients)
- **Capabilities**: PDF and vision support
- **Output Directory**: `/config/output`

## Architecture

- **Base Image**: `ghcr.io/linuxserver/baseimage-kasmvnc:debianbookworm`
- **MCP Server**: `@playwright/mcp@0.0.81` (pinned via build ARG)
- **Browser**: Chrome with Playwright

## Process Overview

When the container is running, you should see the following processes:

### Core Services

- **s6-supervise playwright** (root): s6 service supervisor managing the Playwright MCP service
- **playwright-mcp** (abc/user): The Playwright MCP server listening on port 3002
- **Xvnc** (abc/user): KasmVNC server providing the web-based desktop

### Chrome Browser (when active)

When a browser session is initialized through the MCP server, Chrome processes appear:

- **chrome** (abc/user): Main Chrome browser process
  - MCP shared browser: `--user-data-dir=/config/mcp-profile`
  - Desktop Chrome (autostart, manual logins): `--user-data-dir=/config/chrome-profile`
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

> **Note**: Chrome only appears in the process list after the first browser automation call through the MCP server. The shared browser persists across calls and idle-closes after 1 h (see [Browser Session Model](#browser-session-model)).

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
