export type StoreMasterImportCliOptions = {
  mode: "preview" | "import" | "validate";
  csvPath?: string;
  apply: boolean;
  expectedSha256?: string;
  approvedChangeSetPath?: string;
};

export function parseStoreMasterImportCliArgs(args: readonly string[]): StoreMasterImportCliOptions {
  const values = [...args];
  const requestedMode = values.shift();
  const mode = requestedMode === undefined ? "preview" : requestedMode;
  if (mode !== "preview" && mode !== "import" && mode !== "validate") {
    throw new Error(`Unsupported Store Master command: ${mode}`);
  }

  let apply = false;
  let expectedSha256: string | undefined;
  let approvedChangeSetPath: string | undefined;
  let csvPath: string | undefined;
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.startsWith("--") ? value.slice(0, value.indexOf("=") < 0 ? undefined : value.indexOf("=")) : value;
    if (seen.has(key)) throw new Error(`Duplicate Store Master option: ${key}`);
    seen.add(key);
    if (value === "--apply") apply = true;
    else if (value.startsWith("--expected-sha256=")) expectedSha256 = value.slice("--expected-sha256=".length);
    else if (value.startsWith("--approved-change-set=")) approvedChangeSetPath = value.slice("--approved-change-set=".length);
    else if (value.startsWith("--")) throw new Error(`Unsupported Store Master option: ${value}`);
    else if (csvPath === undefined) csvPath = value;
    else throw new Error("Only one Store Master CSV path may be supplied");
  }

  if (mode === "preview" && apply) throw new Error("The preview command cannot be combined with --apply");
  if (mode === "validate" && (apply || expectedSha256 !== undefined || approvedChangeSetPath !== undefined || csvPath !== undefined)) {
    throw new Error("The validate command does not accept import or approval options");
  }
  if (apply && !/^[a-fA-F0-9]{64}$/u.test(expectedSha256 ?? "")) {
    throw new Error("--apply requires --expected-sha256=<64 hex characters>");
  }
  if (!apply && (expectedSha256 !== undefined || approvedChangeSetPath !== undefined)) {
    throw new Error("Source approval options require --apply");
  }
  if (approvedChangeSetPath !== undefined && approvedChangeSetPath.trim().length === 0) {
    throw new Error("--approved-change-set requires a file path");
  }
  return { mode, csvPath, apply, expectedSha256, approvedChangeSetPath };
}
