export type Implementation = "playwright" | "playwright-plus";

export interface McpCommand {
  implementation: Implementation;
  binary: string;
  config: string;
}

const COMMAND_MAP: Record<Implementation, McpCommand> = {
  playwright: {
    implementation: "playwright",
    binary: "/usr/bin/playwright-mcp",
    config: "/config/config.json",
  },
  "playwright-plus": {
    implementation: "playwright-plus",
    binary: "/usr/bin/mcp-server-playwright",
    config: "/config/config-plus.json",
  },
};

export function normaliseImplementation(raw: string | undefined): Implementation {
  let value = (raw ?? "").trim().toLowerCase();
  if (value === "") {
    value = "playwright";
  }
  return value as Implementation;
}

export function validateImplementation(impl: string): asserts impl is Implementation {
  if (impl !== "playwright" && impl !== "playwright-plus") {
    throw new Error(
      `Invalid PLAYWRIGHT_IMPLEMENTATION: '${impl}'. Valid values: playwright, playwright-plus`
    );
  }
}

export function resolveMcpCommand(raw: string | undefined): McpCommand {
  const impl = normaliseImplementation(raw);
  validateImplementation(impl);
  return COMMAND_MAP[impl];
}
