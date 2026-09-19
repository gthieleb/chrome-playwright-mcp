#!/usr/bin/env node
/**
 * chrome-session-tools: small MCP server (streamable HTTP) exposing
 * persistent tab/bookmark helpers for the chrome-mcp container.
 *
 * Tools:
 *   tabs_list()                -> current open tabs [{title,url,index}]
 *   tabs_save(name)            -> save current tabs to /config/sessions/<name>.json
 *   tabs_restore(name)         -> open saved tabs (in order)
 *   bookmarks_list()           -> read Chrome Bookmarks file (read-only)
 *
 * Data sources:
 *   - Chrome DevTools HTTP endpoint (http://127.0.0.1:9222/json/list, /json/new)
 *   - /config/mcp-profile/Default/Bookmarks (JSON file on PVC)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.SESSION_TOOLS_PORT || '3003', 10);
const CDP = 'http://127.0.0.1:9222';
const SESSIONS_DIR = '/config/sessions';
const PROFILE_DIR = process.env.MCP_PROFILE_DIR || '/config/mcp-profile';
const BOOKMARKS_PATH = path.join(PROFILE_DIR, 'Default', 'Bookmarks');

async function cdpJson(endpoint, method = 'GET') {
  const res = await fetch(`${CDP}${method === 'GET' ? '' : '/'}${method ? method : ''}`, {
    method,
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}

async function cdpList() {
  const res = await fetch(`${CDP}/json/list`).catch(() => null);
  if (!res || !res.ok) return [];
  const tabs = await res.json();
  return tabs.filter((t) => t.type === 'page');
}

function sessionsFile(name) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
    throw new Error('invalid session name (allowed: a-z A-Z 0-9 _ -, max 64)');
  }
  return path.join(SESSIONS_DIR, `${name}.json`);
}

async function readBookmarks() {
  try {
    const raw = await fs.promises.readFile(BOOKMARKS_PATH, 'utf8');
    const data = JSON.parse(raw);
    const out = [];
    const walk = (node, folder) => {
      if (!node) return;
      if (node.type === 'url') {
        out.push({ title: node.name, url: node.url, folder });
      }
      for (const child of node.children || []) walk(child, node.name || folder);
    };
    for (const root of Object.values(data.roots || {})) walk(root, '');
    return out;
  } catch {
    return [];
  }
}

// --- minimal MCP (streamable HTTP, stateless mode) -------------------------
const TOOLS = [
  {
    name: 'tabs_list',
    description: 'List currently open Chrome tabs (title, url, index).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'tabs_save',
    description: 'Save all open tabs under a named session (persisted on volume).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'session name' } },
      required: ['name'],
    },
  },
  {
    name: 'tabs_restore',
    description: 'Restore a previously saved tab session.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'bookmarks_list',
    description: 'List Chrome bookmarks (title, url, folder). Read-only.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

function ok(content) {
  return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: content }] }, id: null };
}

async function callTool(name, args) {
  switch (name) {
    case 'tabs_list': {
      const tabs = await cdpList();
      return ok(JSON.stringify(tabs.map((t, i) => ({ index: i, title: t.title, url: t.url })), null, 1));
    }
    case 'tabs_save': {
      const tabs = await cdpList();
      if (!tabs.length) return ok('no open tabs found (is chrome running with CDP?)');
      await fs.promises.mkdir(SESSIONS_DIR, { recursive: true });
      const file = sessionsFile(args.name);
      const payload = { savedAt: new Date().toISOString(), tabs: tabs.map((t) => ({ title: t.title, url: t.url })) };
      await fs.promises.writeFile(file, JSON.stringify(payload, null, 2));
      return ok(`saved ${tabs.length} tabs to ${file}`);
    }
    case 'tabs_restore': {
      const file = sessionsFile(args.name);
      let payload;
      try {
        payload = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      } catch {
        return ok(`session '${args.name}' not found at ${file}`);
      }
      const opened = [];
      for (const t of payload.tabs || []) {
        const res = await fetch(`${CDP}/json/new?${encodeURIComponent(t.url)}`, { method: 'PUT' }).catch(() => null);
        if (res && res.ok) opened.push(t.url);
      }
      return ok(`restored ${opened.length}/${(payload.tabs || []).length} tabs from ${file}`);
    }
    case 'bookmarks_list': {
      const bms = await readBookmarks();
      return ok(JSON.stringify(bms, null, 1));
    }
    default:
      return ok(`unknown tool: ${name}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/mcp')) {
    res.writeHead(404).end('not found');
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  let msg;
  try {
    msg = JSON.parse(body);
  } catch {
    res.writeHead(400).end('bad json');
    return;
  }
  if (msg.method === 'initialize') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'chrome-session-tools', version: '0.1.0' },
        },
      })
    );
    return;
  }
  if (msg.method === 'tools/list') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } }));
    return;
  }
  if (msg.method === 'tools/call') {
    try {
      const result = await callTool(msg.params.name, msg.params.arguments || {});
      result.id = msg.id;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(e) } }));
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, result: {} }));
});

fs.mkdirSync(SESSIONS_DIR, { recursive: true });
try {
  // ensure the unprivileged chrome user can write session files
  if (process.getuid && process.getuid() === 0) {
    fs.chownSync(SESSIONS_DIR, 1000, 1000);
  }
} catch {}
server.listen(PORT, '0.0.0.0', () => console.log(`session-tools listening on :${PORT}`));