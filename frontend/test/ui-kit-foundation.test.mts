import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("PageHeader keeps its props and uses the redesigned type scale", () => {
  const source = read("../src/components/shell/page-header.tsx");
  for (const prop of ["tag?: React.ReactNode;", "title: React.ReactNode;", "description?: React.ReactNode;", "actions?: React.ReactNode;", "actionSlot?: React.ReactNode;", "className?: string;"]) {
    assert.ok(source.includes(prop), `PageHeader must keep ${prop}`);
  }
  assert.doesNotMatch(source, /\bmeta\b/);
  assert.match(source, /<h1 className="text-xl sm:text-2xl font-semibold leading-\[1\.3\] tracking-tight text-\[var\(--app-text-primary\)\]">/);
  assert.match(source, /<p className="mt-1 text-\[13px\] text-\[var\(--app-text-secondary\)\] leading-relaxed">/);
  assert.match(source, /<header className=\{`mb-4 /);
  assert.doesNotMatch(source, /select-none/);
  // The eyebrow keeps its existing styling.
  assert.match(source, /<div className="mb-1 text-xs font-semibold uppercase tracking-\[0\.04em\] text-\[var\(--app-text-tertiary\)\]">/);
});
