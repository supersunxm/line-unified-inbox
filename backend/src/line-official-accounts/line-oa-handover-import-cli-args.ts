export type LineOaHandoverCliOptions =
  | { command: "preview"; csvPath: string; webhookHost: string; updateLines: Set<number>; allowClosedStoreCodes: Set<string> }
  | {
      command: "apply";
      csvPath: string;
      webhookHost: string;
      updateLines: Set<number>;
      allowClosedStoreCodes: Set<string>;
      expectedSha256: string;
      expectedPlanSha256: string;
      expectedExistingKeysetSha256: string;
    }
  | {
      command: "activate";
      csvPath: string;
      webhookHost: string;
      expectedSha256: string;
      expectedCount: number;
      selection: { storeCodes: Set<string> } | { allImported: true };
    };

const SHA256 = /^[a-f0-9]{64}$/u;
const HOST = /^[a-z0-9.-]+$/u;

function list(value: string) {
  const items = value.split(",").map((item) => item.trim());
  if (items.length === 0 || items.some((item) => item.length === 0)) throw new Error("List options must be non-empty comma-separated values");
  if (new Set(items).size !== items.length) throw new Error("List options must not repeat a value");
  return items;
}

function sha(name: string, value: string | undefined) {
  if (!value || !SHA256.test(value)) throw new Error(`${name} requires 64 lowercase hex characters`);
  return value;
}

export function parseLineOaHandoverCliArgs(args: readonly string[]): LineOaHandoverCliOptions {
  const [command, ...rest] = args;
  if (command !== "preview" && command !== "apply" && command !== "activate") {
    throw new Error("Usage: line-oa-handover-import.cli.js <preview|apply|activate> --csv=<path|-> --webhook-host=<host> [options]");
  }
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of rest) {
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const separator = arg.indexOf("=");
    const name = separator < 0 ? arg : arg.slice(0, separator);
    if (values.has(name) || flags.has(name)) throw new Error(`Duplicate option: ${name}`);
    if (separator < 0) flags.add(name);
    else values.set(name, arg.slice(separator + 1));
  }

  const allowed: Record<typeof command, { values: string[]; flags: string[] }> = {
    preview: { values: ["--csv", "--webhook-host", "--update-line", "--allow-closed-store"], flags: [] },
    apply: {
      values: ["--csv", "--webhook-host", "--update-line", "--allow-closed-store", "--expected-sha256", "--expected-plan-sha256", "--expected-existing-keyset-sha256"],
      flags: [],
    },
    activate: { values: ["--csv", "--webhook-host", "--expected-sha256", "--expected-count", "--store-codes"], flags: ["--all-imported"] },
  };
  for (const name of values.keys()) if (!allowed[command].values.includes(name)) throw new Error(`Unsupported option for ${command}: ${name}`);
  for (const name of flags) if (!allowed[command].flags.includes(name)) throw new Error(`Unsupported option for ${command}: ${name}`);

  const csvPath = values.get("--csv")?.trim();
  if (!csvPath) throw new Error("--csv=<path|-> is required");
  const webhookHost = values.get("--webhook-host")?.trim().toLowerCase();
  if (!webhookHost || !HOST.test(webhookHost)) throw new Error("--webhook-host=<host> is required");

  if (command === "activate") {
    const expectedCount = Number(values.get("--expected-count"));
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 1) throw new Error("--expected-count must be a positive integer");
    const storeCodes = values.get("--store-codes");
    const allImported = flags.has("--all-imported");
    if (Boolean(storeCodes) === allImported) throw new Error("Choose exactly one of --store-codes=<ids> or --all-imported");
    return {
      command,
      csvPath,
      webhookHost,
      expectedSha256: sha("--expected-sha256", values.get("--expected-sha256")),
      expectedCount,
      selection: storeCodes ? { storeCodes: new Set(list(storeCodes)) } : { allImported: true },
    };
  }

  const updateLines = new Set(values.has("--update-line") ? list(values.get("--update-line") ?? "").map((value) => {
    const line = Number(value);
    if (!Number.isSafeInteger(line) || line < 2) throw new Error("--update-line values must be CSV line numbers (2 or greater)");
    return line;
  }) : []);
  const allowClosedStoreCodes = new Set(values.has("--allow-closed-store") ? list(values.get("--allow-closed-store") ?? "") : []);
  if (command === "preview") return { command, csvPath, webhookHost, updateLines, allowClosedStoreCodes };
  return {
    command,
    csvPath,
    webhookHost,
    updateLines,
    allowClosedStoreCodes,
    expectedSha256: sha("--expected-sha256", values.get("--expected-sha256")),
    expectedPlanSha256: sha("--expected-plan-sha256", values.get("--expected-plan-sha256")),
    expectedExistingKeysetSha256: sha("--expected-existing-keyset-sha256", values.get("--expected-existing-keyset-sha256")),
  };
}
