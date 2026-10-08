import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { initialWorkspaceAuth } from "../src/app/workspace-auth-bootstrap.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageCode = read("../src/app/page.tsx");
const loginCode = read("../src/app/login/page.tsx");
const gateCode = read("../src/app/authorized-workspace.tsx");
const shellSkeletonCode = read("../src/components/shell/shell-skeleton.tsx");
const trafficCode = read("../src/app/dashboard/message-traffic/message-traffic-view.tsx");
const pickerCode = read("../src/components/date-range/unified-period-picker.tsx");
// The executive dashboard was replaced by the monthly dashboard (8 Oct 2026), which uses the UI kit skeleton.
const dashboardCode = read("../src/app/dashboard/monthly-dashboard.tsx");
const sectionSkeletonCode = read("../src/components/ui/section-card-skeleton.tsx");

const checkSetupStatus = pageCode.match(/const checkSetupStatus = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[\]\);/)?.[0] ?? "";

test("/login keeps the full setup-status then /auth/me path", () => {
  // The first-admin screen renders the workspace without a user...
  assert.match(loginCode, /return <ApplicationWorkspace initialSection="dashboard" \/>;/);
  assert.doesNotMatch(loginCode, /initialAuthUser/);
  // ...which starts unchecked and schedules the setup check...
  assert.deepEqual(initialWorkspaceAuth(undefined), { authUser: null, authChecked: false, runSetupCheck: true });
  assert.deepEqual(initialWorkspaceAuth(null), { authUser: null, authChecked: false, runSetupCheck: true });
  assert.match(pageCode, /if \(!initialAuth\.runSetupCheck\) return undefined;\s*const timer = window\.setTimeout\(\(\) => void checkSetupStatus\(\), 0\);/);
  // ...which still calls setup-status first and /auth/me only when an administrator exists.
  assert.match(checkSetupStatus, /const status = await api\.setupStatus\(\{ signal: controller\.signal \}\);[\s\S]*?if \(!status\.firstAdminRequired\) \{[\s\S]*?const user = await api\.me\(\{ signal: controller\.signal \}\);/);
});

test("the gated workspace starts signed in and makes neither call", () => {
  const user = { id: "u1", email: "a@example.com", displayName: "A", role: "ADMIN" as const };
  const bootstrap = initialWorkspaceAuth(user);
  assert.equal(bootstrap.authUser, user);
  assert.equal(bootstrap.authChecked, true);
  assert.equal(bootstrap.runSetupCheck, false);
  // page.tsx seeds its state from the bootstrap; the only setupStatus/me calls are inside checkSetupStatus.
  assert.match(pageCode, /const \[initialAuth\] = useState\(\(\) => initialWorkspaceAuth\(initialAuthUser\)\);/);
  assert.match(pageCode, /const \[authUser, setAuthUser\] = useState<WorkspaceAuthUser \| null>\(initialAuth\.authUser\);/);
  assert.match(pageCode, /const \[authChecked, setAuthChecked\] = useState\(initialAuth\.authChecked\);/);
  assert.equal(pageCode.match(/api\.setupStatus\(/g)?.length, 1);
  assert.equal(pageCode.match(/api\.me\(/g)?.length, checkSetupStatus.match(/api\.me\(/g)?.length);
  // The gate hands its resolved user to the workspace.
  assert.match(gateCode, /const user = useAuthorizedUser\(\);\s*return <ApplicationWorkspace initialSection=\{section\} initialAuthUser=\{user\} \/>;/);
  assert.match(gateCode, /<AuthorizedSection section=\{section\}>\s*<GatedApplicationWorkspace section=\{section\} \/>/);
});

test("the gate defers its skeleton: none on a cache hit, a bare frame first, then at least 400ms", () => {
  assert.match(gateCode, /const showSkeleton = useDeferredLoading\(!allowed && !error\);/);
  assert.match(gateCode, /if \(!allowed \|\| showSkeleton\) \{\s*return \(\s*<ShellSkeleton placeholders=\{showSkeleton\}>\s*\{showSkeleton && <WorkspaceSkeleton label=\{t\.checking\} \/>\}/);
  assert.match(shellSkeletonCode, /export function ShellSkeleton\(\{ placeholders = true, children \}/);
  assert.equal(shellSkeletonCode.match(/\{placeholders && \(/g)?.length, 2);
});

test("Message Traffic loads behind skeletons with its real KPI labels and section titles", () => {
  assert.doesNotMatch(trafficCode, /LoadingState/);
  assert.match(trafficCode, /<KpiStripSkeleton columns=\{5\} labels=\{kpiLabels\} label=\{label\} \/>/);
  assert.match(trafficCode, /kpiLabels=\{\[text\.inbound, text\.conversations, text\.perConversation, text\.peakHour, text\.busiestDay\]\}/);
  assert.match(trafficCode, /hourlyTitle=\{text\.hourly\}\s*weekdayTitle=\{text\.weekday\}\s*rankingTitle=\{text\.ranking\}/);
  assert.match(trafficCode, /if \(!authChecked\) return <ShellSkeleton>[\s\S]*?\{trafficSkeleton\}/);
  assert.match(trafficCode, /\{loading && !data \? trafficSkeleton : data && \(/);
  // The loaded strip keeps the same five labels in the same order.
  assert.match(trafficCode, /label: text\.inbound[\s\S]*?label: text\.conversations[\s\S]*?label: text\.perConversation[\s\S]*?label: text\.peakHour[\s\S]*?label: text\.busiestDay/);
});

test("the dashboard placeholder pulses only when motion is allowed", () => {
  assert.match(dashboardCode, /<SectionCardSkeleton title=\{t\("sectionStores"\)\} lines=\{10\} \/>/);
  assert.doesNotMatch(dashboardCode, /animate-pulse/);
  assert.doesNotMatch(sectionSkeletonCode, /(^|[\s"])animate-pulse/);
});

test("the pre-auth filter-bar placeholder has the date picker's geometry (42px preset group, 38px trigger)", () => {
  assert.doesNotMatch(trafficCode, /h-9 w-64/);
  assert.match(trafficCode, /<FilterBarSkeleton \/>\{trafficSkeleton\}/);
  // Each box-model class string must be the picker's own, so the placeholder cannot drift from it.
  for (const name of ["PICKER_WRAPPER_CLASS", "PICKER_PRESET_GROUP_CLASS", "PICKER_PRESET_BOX_CLASS", "PICKER_TRIGGER_BOX_CLASS"]) {
    const value = trafficCode.match(new RegExp(`const ${name} = "([^"]+)";`))?.[1];
    assert.ok(value, name);
    assert.ok(pickerCode.includes(value), `${name} must appear verbatim in unified-period-picker.tsx`);
  }
  // One line-height block inside each box: 16 (text-xs) + 16 (py-2) = 32 + p-1 8 + border 2 = 42; 20 (text-sm) + 16 + 2 = 38.
  assert.match(trafficCode, /className=\{PICKER_PRESET_BOX_CLASS\}><Skeleton className="h-\[1lh\] w-6" \/>/);
  assert.match(trafficCode, /className=\{PICKER_TRIGGER_BOX_CLASS\}><Skeleton className="h-\[1lh\] w-44" \/>/);
  // The real bar still uses the picker with its default quick ranges, i.e. the 42px group is present.
  assert.match(trafficCode, /<FilterBar>\s*<div className="flex flex-wrap items-center justify-between gap-3">\s*<DateRangePicker disabled=\{loading\}/);
  assert.doesNotMatch(trafficCode, /showOutsideQuickRanges=\{false\}/);
});
