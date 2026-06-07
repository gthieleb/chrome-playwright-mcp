# Session Workflow — Named Browser Sessions with Playwright Plus

## Overview

Playwright Plus introduces **project-isolation** — the ability to run multiple independent browser sessions with separate profiles, cookies, localStorage, and extensions. Each session lives in its own directory under `/sessions/` and is referenced by the `projectPath` tool parameter.

This workflow describes how agents should discover, create, and use these named sessions.

---

## Workflow

### Step 1: List Existing Sessions

Check which sessions already exist by listing the `/sessions/` directory:

```bash
ls /sessions/
```

Pre-configured sessions (`recherche`, `testing`, `admin`) are always available. Users may have created additional ones.

### Step 2: Ask the User

Present the available sessions to the user and ask which to use:

> "I found these existing sessions: [recherche, testing, admin, ...]. Would you like to use one of these or create a new session?"

### Step 3: Using an Existing Session

If the user picks an existing session, set `projectDrive: "/"` and `projectPath: "/sessions/<session-name>"` on **every** browser tool call.

Example: To use the `testing` session, pass `projectDrive: "/"` and `projectPath: "/sessions/testing"`.

### Step 4: Creating a New Session

If the user wants a new session:

1. **Get explicit user approval** — never create a session directory without confirmation.
2. Create the directory: `mkdir -p /sessions/<session-name>`
3. Use `projectDrive: "/"` and `projectPath: "/sessions/<session-name>"` on every subsequent browser tool call.

> ⚠️ **Approval Required**: Never create a session without the user saying yes. Sessions persist and accumulate; creating them unilaterally wastes disk space and clutters the workspace.

---

## Parameter Convention

Every `browser_*` tool call **MUST** include these two parameters when using sessions:

| Parameter      | Value                        | Description                                            |
|----------------|------------------------------|--------------------------------------------------------|
| `projectDrive` | `"/"`                        | Drive letter (always root `/` on Linux)                |
| `projectPath`  | `"/sessions/<session-name>"` | Path to the session's isolated browser profile folder  |

### Why This Matters

Without `projectPath`, the browser tool call falls back to the **default context** — no isolation is applied. Consecutive calls without `projectPath` share the same default profile, meaning cookies, logins, and state leak between unrelated tasks.

Always include `projectPath` to ensure each session is properly isolated.

---

## Important Warnings

### 1. Never Create Sessions Without Approval

Creating a session directory (`mkdir -p /sessions/<name>`) modifies the filesystem. Always ask the user first. A good session name is short, descriptive, and uses lowercase letters with hyphens (e.g., `github-login`, `api-testing`, `research-paper`).

### 2. Always Include projectPath

Forgetting `projectPath` means the call uses the default (shared) context. This breaks isolation. If you are working inside a named session, every `browser_*` tool call must include `projectDrive: "/"` and `projectPath: "/sessions/<session-name>"`.

### 3. Session Persistence

Sessions persist across container restarts **only if** the `/sessions` directory is mounted as a Docker volume. Check with the user if persistence is required.

### 4. Pre-configured Sessions

These sessions ship pre-configured and are always available:

| Session     | Purpose                                      |
|-------------|----------------------------------------------|
| `recherche` | General research and information gathering    |
| `testing`   | Automated test runs and QA workflows          |
| `admin`     | Administrative tasks and configuration        |

---

## Complete Example

### Listing and Choosing a Session

**Agent:**
```
$ ls /sessions/
recherche  testing  admin
```

**Agent to user:**
> "I see these existing sessions: **recherche**, **testing**, **admin**. Which would you like to use? Or should I create a new one?"

**User:**
> "Use testing."

### Using the Session

Once the user has chosen, every browser call includes the session parameters:

```
# Step 1: Navigate — projectPath: "/sessions/testing", projectDrive: "/"
browser_navigate(url="https://example.com", projectDrive="/", projectPath="/sessions/testing")

# Step 2: Snapshot — projectPath: "/sessions/testing", projectDrive: "/"
browser_snapshot(projectDrive="/", projectPath="/sessions/testing")

# Step 3: Click — projectPath: "/sessions/testing", projectDrive: "/"
browser_click(target="#login-button", projectDrive="/", projectPath="/sessions/testing")
```

### Creating a New Session

**Agent to user:**
> "I found sessions: recherche, testing, admin. Or I can create a new one. What would you like?"

**User:**
> "Create a new session called github-work."

**Agent (after approval):**
```
$ mkdir -p /sessions/github-work
```

Then all subsequent browser calls use:
```
browser_navigate(url="https://github.com", projectDrive="/", projectPath="/sessions/github-work")
```

---

## Summary Checklist

- [ ] List `/sessions/` to discover existing sessions
- [ ] Ask the user which session to use (or create new with approval)
- [ ] Never create a session without explicit user approval
- [ ] Always pass `projectDrive: "/"` and `projectPath: "/sessions/<name>"` on every `browser_*` call
- [ ] Without `projectPath`, isolation is lost — state leaks between tasks
