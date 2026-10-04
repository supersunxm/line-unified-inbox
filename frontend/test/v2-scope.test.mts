import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(frontendRoot, "src");
const V2_DIRS = ["app/v2", "lib/v2", "components/v2"];
const isV2 = (path: string) => V2_DIRS.some((dir) => path === dir || path.startsWith(`${dir}/`));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

test("v2 is isolated: nothing outside app/v2, lib/v2 and components/v2 imports v2 code", () => {
  const offenders = sourceFiles(srcRoot)
    .map((full) => relative(srcRoot, full))
    .filter((path) => !isV2(path))
    .filter((path) => /from\s+["'](?:@\/(?:lib|components)\/v2\/|\.{1,2}\/[^"']*\/v2\/)/.test(readFileSync(join(srcRoot, path), "utf8")));
  assert.deepEqual(offenders, []);
});

test("the only v2 entry point outside v2 is one link in the existing sidebar footer", () => {
  const sidebar = readFileSync(join(srcRoot, "components/shell/app-sidebar.tsx"), "utf8");
  assert.equal(sidebar.match(/href="\/v2"/g)?.length, 1);
  assert.match(sidebar, /<Link href="\/v2" data-v2-entry-link [^>]*>\{collapsed \? "v2" : "ลองเวอร์ชันใหม่ \(v2\)"\}<\/Link>/);
});

// While the v2 branch is open, check its whole diff against main. This needs origin/main
// locally (CI's shallow checkout does not have it), and it is scoped to this branch so it
// never blocks later, unrelated work once v2 is merged.
const V2_BRANCH = "claude/v2-shell-response-today";
const ALLOWED_OUTSIDE_V2 = new Set([
  "CLAUDE.md",
  "docs/v2-data-sources.md",
  "frontend/src/components/shell/app-sidebar.tsx",
]);

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: frontendRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

test("on the v2 branch, no file outside v2 changed except the sidebar link and CLAUDE.md", (t) => {
  const branch = process.env.GITHUB_HEAD_REF || git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== V2_BRANCH) return t.skip(`not on ${V2_BRANCH}`);
  const base = git(["merge-base", "HEAD", "origin/main"]);
  if (!base) return t.skip("origin/main is not available (shallow checkout)");
  const changed = (git(["diff", "--name-only", base, "HEAD"]) ?? "").split("\n").filter(Boolean);
  const outside = changed.filter((path) => {
    const inFrontendSrc = path.startsWith("frontend/src/") && isV2(path.slice("frontend/src/".length));
    const v2Test = /^frontend\/test\/v2-[\w-]+\.test\.mts$/.test(path);
    return !inFrontendSrc && !v2Test && !ALLOWED_OUTSIDE_V2.has(path);
  });
  assert.deepEqual(outside, []);
  // The sidebar change is exactly one added line, the v2 link.
  const sidebarDiff = git(["diff", "--unified=0", base, "HEAD", "--", ":/frontend/src/components/shell/app-sidebar.tsx"]) ?? "";
  const changedLines = sidebarDiff.split("\n").filter((line) => /^[+-](?![+-])/.test(line));
  assert.equal(changedLines.length, 1);
  assert.match(changedLines[0], /^\+\s*<Link href="\/v2" data-v2-entry-link/);
});
