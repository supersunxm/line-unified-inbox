import assert from "node:assert/strict";
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

test("v2 never uses the nickname feature's fleet readiness as a has-data source", () => {
  const v2Files = sourceFiles(srcRoot).filter((full) => isV2(relative(srcRoot, full)));
  const offenders = v2Files.filter((full) => /fleet-readiness|lineChatFleetReadiness/.test(readFileSync(full, "utf8"))).map((full) => relative(srcRoot, full));
  assert.deepEqual(offenders, []);
  assert.ok(v2Files.some((full) => readFileSync(full, "utf8").includes("/operations/line-chat-nickname/mirror-status")));
});
