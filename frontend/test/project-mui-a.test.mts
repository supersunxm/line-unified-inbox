import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const provider = readFileSync(new URL("../src/mui/project-mui-a-provider.tsx", import.meta.url), "utf8");
const boundary = readFileSync(new URL("../src/mui/project-mui-a-boundary.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const overflow = readFileSync(new URL("../src/components/chats/store-chats-overflow-menu.tsx", import.meta.url), "utf8");

test("Project MUI A pins the MUI and Emotion foundation", () => {
  assert.equal(packageJson.dependencies["@mui/material"], "9.4.0");
  assert.equal(packageJson.dependencies["@mui/material-nextjs"], "9.4.0");
  assert.equal(packageJson.dependencies["@emotion/react"], "11.14.0");
  assert.equal(packageJson.dependencies["@emotion/styled"], "11.14.1");
  assert.equal(packageJson.dependencies["@emotion/cache"], "11.14.0");
});

test("Project MUI A uses the Next.js App Router cache and Tailwind-compatible MUI layer", () => {
  assert.match(layout, /AppRouterCacheProvider/);
  assert.match(layout, /options=\{\{ enableCssLayer: true \}\}/);
  assert.match(layout, /<ProjectMuiAProvider>/);
  assert.match(globals, /^@layer theme, base, mui, components, utilities;\n@import "tailwindcss";/);
  assert.doesNotMatch(provider, /CssBaseline/);
});

test("Project MUI A keeps Big Project A protected", () => {
  assert.match(boundary, /"backend\/src\/line-chat"/);
  assert.match(boundary, /"AI_PROGRESS\.md"/);
  assert.match(boundary, /"DECISIONS\.md"/);
  assert.match(boundary, /"historical backfill behavior"/);
  assert.match(boundary, /"realtime message subscription"/);
  assert.match(boundary, /"BM reply status transitions"/);
});

test("Store Chats pilot uses MUI only in presentation controls", () => {
  assert.match(page, /import MuiButton from "@mui\/material\/Button"/);
  assert.match(page, /import MuiPaper from "@mui\/material\/Paper"/);
  assert.match(page, /<MuiButton[\s\S]*data-bulk-mark-all-replied-button/);
  assert.match(page, /<MuiButton[\s\S]*data-chat-filter-button/);
  assert.match(page, /<MuiPaper[\s\S]*className="app-filter-panel/);
  assert.match(overflow, /import IconButton from "@mui\/material\/IconButton"/);
  assert.match(overflow, /import Menu from "@mui\/material\/Menu"/);
  assert.match(overflow, /import MenuItem from "@mui\/material\/MenuItem"/);
  assert.match(overflow, /resetPaneSizes\(\)/);
});
