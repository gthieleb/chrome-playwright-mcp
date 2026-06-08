import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

const readTextFile = (...segments: string[]) =>
  readFileSync(resolve(projectRoot, ...segments), "utf-8");

const runScript = readTextFile("s6-services", "playwright", "run");
const plusConfigRaw = readTextFile("config", "config-plus.json");

function extractCaseBlock(script: string, branchName: string) {
  const match = script.match(
    new RegExp(String.raw`\b${branchName}\)\n([\s\S]*?)\n\s*;;`)
  );

  expect(match, `${branchName} branch should exist`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("session management config", () => {
  it("config-plus.json omits browser.userDataDir for projectIsolation", () => {
    const parsed = JSON.parse(plusConfigRaw);

    expect(parsed.browser).not.toHaveProperty("userDataDir");
  });

  it("config-plus.json does not declare projectIsolation", () => {
    expect(plusConfigRaw).not.toContain("projectIsolation");
  });
});

describe("session management runtime wiring", () => {
  const plusBranch = extractCaseBlock(runScript, "playwright-plus");
  const officialBranch = extractCaseBlock(runScript, "playwright");

  it("plus branch enables project isolation", () => {
    expect(plusBranch).toContain("--project-isolation");
  });

  it("plus branch uses the custom session strategy", () => {
    expect(plusBranch).toContain("--project-isolation-session-strategy=custom");
  });

  it("plus branch routes sessions into /sessions", () => {
    expect(plusBranch).toContain("--project-isolation-session-root-dir /sessions");
  });

  it("runtime directory setup includes /sessions in mkdir/chown/chmod", () => {
    expect(runScript).toContain(
      "mkdir -p /config/chrome-profile /config/chrome-profile-plus /config/output /sessions"
    );
    expect(runScript).toContain(
      "chown -R abc:abc /config/chrome-profile /config/chrome-profile-plus /config/output /sessions"
    );
    expect(runScript).toContain(
      "chmod -R u+rwX /config/chrome-profile /config/chrome-profile-plus /config/output /sessions"
    );
  });

  it("official branch stays free of project-isolation flags", () => {
    expect(officialBranch).not.toContain("project-isolation");
    expect(officialBranch).not.toContain("projectIsolation");
  });
});
