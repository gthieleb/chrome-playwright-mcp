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

## Playwright Implementation Selection

The container supports two MCP implementations, selectable via the `PLAYWRIGHT_IMPLEMENTATION` environment variable. Only one implementation runs at a time on port 3002.

| Value | Package | Description |
|---|---|---|
| `playwright` (default) | `@playwright/mcp` | Official Playwright MCP server |
| `playwright-plus` | `@ai-coding-labs/playwright-mcp-plus` | Extended MCP with additional upstream features |

Switching implementations requires a container restart or recreate.

### Docker Run Examples

Default (official):
```bash
docker run -d \
  --name chrome-mcp \
  -p 3000:3000 -p 3001:3001 -p 3002:3002 \
  -v $(pwd)/config:/config \
  ghcr.io/bradsjm/chrome-mcp:latest
```

Playwright Plus:
```bash
docker run -d \
  --name chrome-mcp \
  -e PLAYWRIGHT_IMPLEMENTATION=playwright-plus \
  -p 3000:3000 -p 3001:3001 -p 3002:3002 \
  -v $(pwd)/config:/config \
  ghcr.io/bradsjm/chrome-mcp:latest
```

### Docker Compose

Set in `docker-compose.override.yml`:
```yaml
services:
  chrome-mcp:
    environment:
      - PLAYWRIGHT_IMPLEMENTATION=playwright-plus
```

Each implementation uses its own Chrome profile directory (`/config/chrome-profile` for official, `/config/chrome-profile-plus` for plus) and its own config file (`/config/config.json` or `/config/config-plus.json`).

## Session Management

The Playwright Plus implementation includes a **project isolation** feature that maintains separate, isolated browser profiles for different automation contexts. This enables concurrent, non-interfering browser sessions within a single container.

### How It Works

Project isolation (`--project-isolation`) creates a dedicated browser profile directory per session. Each session gets its own cookies, local storage, and browser state — completely isolated from other sessions.

The feature is configured through three CLI flags passed to the Plus MCP server:

| Flag | Value | Purpose |
|---|---|---|
| `--project-isolation` | *(flag only)* | Enables project-based isolation |
| `--project-isolation-session-strategy` | `custom` | Uses the explicit `projectPath` parameter from tool calls |
| `--project-isolation-session-root-dir` | `/sessions` | Base directory for all session profiles |

Every `browser_*` tool call supports two extra parameters:

- **`projectDrive: "/"`** — The root path for the project (typically `/`).
- **`projectPath: "/sessions/<name>"`** — The session's profile directory. Each unique path creates an independent browser context.

**Session naming convention:** `/sessions/<name>` where `<name>` is a logical session identifier such as `recherche`, `testing`, or `admin`.

The following table compares behaviour with and without project isolation:

| Aspect | Without `projectIsolation` | With `projectIsolation` |
|---|---|---|
| Cookie / storage isolation | Single profile shared by all calls | Each `projectPath` has its own profile |
| Concurrent sessions | Not possible (single browser context) | Yes — parallel calls to different paths work independently |
| Session persistence | Profile directory persists (or not) based on `--user-data-dir` | Each session profile persists independently under `/sessions` |
| Configuration mechanism | `--user-data-dir` (one fixed path) | `projectPath` per call (dynamic, per-session) |
| Cleanup | Manual profile deletion | Manual per-session profile deletion |

### Setup

To enable session management:

1. **Select the Plus implementation** by setting `PLAYWRIGHT_IMPLEMENTATION=playwright-plus`.
2. **Volume-mount `/sessions` for persistence** (recommended — see below).

Session management is a **Playwright Plus-only** feature. The official `@playwright/mcp` does not support `--project-isolation` or the `projectPath`/`projectDrive` parameters.

#### Pre-configured Sessions

The container image includes three pre-created session directories, ready to use:

- `/sessions/recherche`
- `/sessions/testing`
- `/sessions/admin`

Additional sessions are created on demand: any `projectPath` under `/sessions` is automatically initialised on first use. You can also pre-create directories manually:

```bash
docker exec chrome-mcp mkdir -p /sessions/my-custom-session
```

#### Persistence

`/sessions` is part of the container image and is **ephemeral by default**. Session profiles are lost when the container is rebuilt or recreated. To persist sessions across restarts:

**Docker run (bind mount):**
```bash
docker run -d \
  --name chrome-mcp \
  -e PLAYWRIGHT_IMPLEMENTATION=playwright-plus \
  -v $(pwd)/sessions:/sessions \
  ghcr.io/bradsjm/chrome-mcp:latest
```

**Docker Compose (named volume):**
```yaml
services:
  chrome-mcp:
    environment:
      - PLAYWRIGHT_IMPLEMENTATION=playwright-plus
    volumes:
      - sessions_data:/sessions

volumes:
  sessions_data:
```

#### Session Cleanup

There is **no automatic session cleanup**. Old or unused session profiles accumulate in `/sessions` and must be removed manually:

```bash
docker exec chrome-mcp rm -rf /sessions/unused-session
```

### Differences Between Implementations

| Capability | Official MCP (`@playwright/mcp`) | Playwright Plus (`@ai-coding-labs/playwright-mcp-plus`) |
|---|---|---|
| `--isolated` (in-memory context) | ✅ Yes | ✅ Yes |
| `--user-data-dir` (fixed profile) | ✅ Yes | ✅ Yes |
| `--project-isolation` | ❌ Not available | ✅ Yes |
| `projectPath` / `projectDrive` per tool call | ❌ Not available | ✅ Yes |
| Multiple concurrent isolated sessions | ❌ Single profile only | ✅ Yes, one per `projectPath` |
| Custom session root directory | ❌ Not available | ✅ Yes (`--project-isolation-session-root-dir`) |

For session management — multiple concurrent, persistent, isolated browser profiles — **Playwright Plus is required**.

### Challenges and Limitations

1. **Project-based, not client-based isolation.** `projectIsolation` isolates by `projectPath`, not by MCP client identity. Two different MCP clients (e.g. Freelancer A and Freelancer B) calling the same `projectPath` will share the same profile.

2. **Every tool call must include `projectPath`.** If a `browser_*` tool is called without a `projectPath`, it falls back to the default context without isolation. This is easy to forget and can lead to unintentional state sharing.

3. **No automatic session cleanup.** Profiles accumulate indefinitely. Manual deletion (`docker exec ... rm -rf /sessions/old-session`) is required.

4. **Persistence requires a volume mount.** Without an explicit `-v` or named volume, session data is lost on container rebuild.

5. **`projectIsolation` is a CLI flag, not a JSON config option.** It must be set via `--project-isolation` on the command line. It cannot be enabled or configured in `config-plus.json`.

6. **MCP protocol direction.** The MCP 2026-07-28 release candidate moves towards a **stateless** protocol, removing `Mcp-Session-Id`. This is tracked in:
   - **SEP-2567** — Sessionless MCP
   - **SEP-2575** — Stateless MCP

   These proposals shift session management from the protocol layer to the server side. The current `projectIsolation` setup is a practical solution today, but it is not a long-term protocol-level answer.

7. **Docker MCP Gateway and LiteLLM MCP Proxy** solve **routing** (which backend handles a request), not **session assignment** (which session profile to use). Multi-client isolation within a single container requires a custom session orchestration layer beyond what these gateways provide.

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
