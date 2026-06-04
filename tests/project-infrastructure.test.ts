import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

describe("project infrastructure", () => {
  it("both MCP config files exist and are valid JSON", () => {
    for (const filename of ["config.json", "config-plus.json"]) {
      const filePath = resolve(projectRoot, "config", filename);
      expect(existsSync(filePath), `${filename} should exist`).toBe(true);

      const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(parsed.server, `${filename} should have server config`).toBeDefined();
      expect(parsed.server.port, `${filename} server.port should be 3002`).toBe(3002);
      expect(parsed.browser, `${filename} should have browser config`).toBeDefined();
    }
  });

  it("config files use the .json extension", () => {
    const configDir = resolve(projectRoot, "config");
    const entries = ["config.json", "config-plus.json"];

    for (const entry of entries) {
      expect(extname(entry)).toBe(".json");
    }
  });

  it("Dockerfile references both MCP npm packages", () => {
    const dockerfilePath = resolve(projectRoot, "Dockerfile");
    const dockerfile = readFileSync(dockerfilePath, "utf-8");

    expect(dockerfile).toContain("@playwright/mcp");
    expect(dockerfile).toContain("@ai-coding-labs/playwright-mcp-plus");
  });

  it("s6 service run script exists and is non-empty", () => {
    const runScript = resolve(
      projectRoot,
      "s6-services",
      "playwright",
      "run"
    );
    expect(existsSync(runScript), "s6 run script should exist").toBe(true);

    const content = readFileSync(runScript, "utf-8");
    expect(content.length, "run script should not be empty").toBeGreaterThan(0);
    expect(content).toContain("PLAYWRIGHT_IMPLEMENTATION");
  });
});
