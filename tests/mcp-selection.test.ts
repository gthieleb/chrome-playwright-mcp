import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normaliseImplementation,
  validateImplementation,
  resolveMcpCommand,
} from "../src/mcp-selector.js";

const projectRoot = resolve(import.meta.dirname, "..");

describe("MCP Selection - ENV normalisation", () => {
  it("defaults undefined to playwright", () => {
    expect(normaliseImplementation(undefined)).toBe("playwright");
  });

  it("defaults empty string to playwright", () => {
    expect(normaliseImplementation("")).toBe("playwright");
  });

  it("defaults whitespace-only to playwright", () => {
    expect(normaliseImplementation("   ")).toBe("playwright");
  });

  it("passes playwright through", () => {
    expect(normaliseImplementation("playwright")).toBe("playwright");
  });

  it("passes playwright-plus through", () => {
    expect(normaliseImplementation("playwright-plus")).toBe("playwright-plus");
  });

  it("lowercases PLAYWRIGHT-PLUS", () => {
    expect(normaliseImplementation("PLAYWRIGHT-PLUS")).toBe("playwright-plus");
  });

  it("lowercases mixed case Playwright-Plus", () => {
    expect(normaliseImplementation("Playwright-Plus")).toBe("playwright-plus");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseImplementation(" playwright-plus ")).toBe("playwright-plus");
  });
});

describe("MCP Selection - validation", () => {
  it("rejects foobar", () => {
    expect(() => validateImplementation("foobar")).toThrow(
      "Invalid PLAYWRIGHT_IMPLEMENTATION"
    );
  });

  it("rejects chrome", () => {
    expect(() => validateImplementation("chrome")).toThrow(
      "Invalid PLAYWRIGHT_IMPLEMENTATION"
    );
  });
});

describe("MCP Selection - command construction", () => {
  it("maps playwright to official binary and config", () => {
    const cmd = resolveMcpCommand("playwright");
    expect(cmd.binary).toBe("/usr/bin/playwright-mcp");
    expect(cmd.config).toBe("/config/config.json");
    expect(cmd.implementation).toBe("playwright");
  });

  it("maps playwright-plus to plus binary and config", () => {
    const cmd = resolveMcpCommand("playwright-plus");
    expect(cmd.binary).toBe("/usr/bin/mcp-server-playwright");
    expect(cmd.config).toBe("/config/config-plus.json");
    expect(cmd.implementation).toBe("playwright-plus");
  });

  it("uses mcp-server-playwright NOT playwright-mcp-plus", () => {
    const cmd = resolveMcpCommand("playwright-plus");
    expect(cmd.binary).not.toBe("/usr/bin/playwright-mcp-plus");
    expect(cmd.binary).toBe("/usr/bin/mcp-server-playwright");
  });

  it("rejects invalid with thrown error", () => {
    expect(() => resolveMcpCommand("bogus")).toThrow(
      "Invalid PLAYWRIGHT_IMPLEMENTATION"
    );
  });

  it("defaults undefined to playwright command", () => {
    const cmd = resolveMcpCommand(undefined);
    expect(cmd.implementation).toBe("playwright");
    expect(cmd.binary).toBe("/usr/bin/playwright-mcp");
  });
});

describe("MCP Selection - config file validation", () => {
  it("config.json is valid JSON with port 3002 and host 127.0.0.1", () => {
    const raw = readFileSync(resolve(projectRoot, "config", "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.server.port).toBe(3002);
    expect(parsed.server.host).toBe("127.0.0.1");
  });

  it("config-plus.json is valid JSON with port 3002 and host 127.0.0.1", () => {
    const raw = readFileSync(resolve(projectRoot, "config", "config-plus.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.server.port).toBe(3002);
    expect(parsed.server.host).toBe("127.0.0.1");
  });

  it("config-plus.json references chrome-profile-plus", () => {
    const raw = readFileSync(resolve(projectRoot, "config", "config-plus.json"), "utf-8");
    expect(raw).toContain("chrome-profile-plus");
    const parsed = JSON.parse(raw);
    expect(parsed.browser.userDataDir).toBe("/config/chrome-profile-plus");
  });

  it("config-plus.json has no projectIsolation", () => {
    const raw = readFileSync(resolve(projectRoot, "config", "config-plus.json"), "utf-8");
    expect(raw).not.toContain("projectIsolation");
  });
});
