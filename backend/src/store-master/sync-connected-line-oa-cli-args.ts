export function parseConnectedLineOaCliArgs(args: readonly string[]) {
  let apply = false;
  let approvedChangeSetPath: string | undefined;
  const seen = new Set<string>();
  for (const arg of args) {
    const key = arg.startsWith("--") ? arg.slice(0, arg.indexOf("=") < 0 ? undefined : arg.indexOf("=")) : arg;
    if (seen.has(key)) throw new Error(`Duplicate Store Master reconciliation option: ${key}`);
    seen.add(key);
    if (arg === "--apply") apply = true;
    else if (arg.startsWith("--approved-change-set=")) approvedChangeSetPath = arg.slice("--approved-change-set=".length);
    else throw new Error(`Unsupported Store Master reconciliation option: ${arg}`);
  }
  if (!apply && approvedChangeSetPath !== undefined) {
    throw new Error("--approved-change-set requires --apply");
  }
  if (approvedChangeSetPath !== undefined && approvedChangeSetPath.trim().length === 0) {
    throw new Error("--approved-change-set requires a file path");
  }
  return { apply, approvedChangeSetPath };
}
