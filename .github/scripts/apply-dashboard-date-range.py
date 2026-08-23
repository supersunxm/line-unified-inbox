from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch target: {label}")
    return text.replace(old, new, 1)

# Backend analytics: exact custom range + reliable follower snapshots.
p = Path("backend/src/dashboard-analytics.service.ts")
s = p.read_text()
s = replace_once(
    s,
    'import { toUtcDateForDb } from "./follower-insights/date-utils";',
    'import { formatDbDateToIso, getOffsetBangkokDateString, toUtcDateForDb } from "./follower-insights/date-utils";',
    "analytics imports",
)
s = replace_once(
    s,
    '''function getBangkokMidnightUtc(date: Date = new Date()): Date {\n  const bangkokIso = toBangkokDateString(date);\n  const [y, m, d] = bangkokIso.split("-").map(Number);\n  // 00:00:00 Bangkok time (UTC+7) is 17:00:00 UTC previous day\n  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));\n}\n''',
    '''function getBangkokMidnightUtc(date: Date = new Date()): Date {\n  const bangkokIso = toBangkokDateString(date);\n  const [y, m, d] = bangkokIso.split("-").map(Number);\n  // 00:00:00 Bangkok time (UTC+7) is 17:00:00 UTC previous day\n  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));\n}\n\nfunction getBangkokMidnightUtcFromIso(isoDate: string): Date {\n  const [y, m, d] = isoDate.split("-").map(Number);\n  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));\n}\n\nfunction pickReliableFollowerDate(\n  snapshots: Array<{ lineOaId: string; snapshotDate: Date; followers: number | null }>,\n  requestedIsoDate: string,\n): string {\n  const eligible = snapshots.filter((snapshot) => formatDbDateToIso(snapshot.snapshotDate) <= requestedIsoDate && snapshot.followers !== null);\n  if (eligible.length === 0) return requestedIsoDate;\n  const coverage = new Map<string, Set<string>>();\n  for (const snapshot of eligible) {\n    const iso = formatDbDateToIso(snapshot.snapshotDate);\n    const accounts = coverage.get(iso) ?? new Set<string>();\n    accounts.add(snapshot.lineOaId);\n    coverage.set(iso, accounts);\n  }\n  const maxCoverage = Math.max(...[...coverage.values()].map((accounts) => accounts.size));\n  return [...coverage.entries()]\n    .filter(([, accounts]) => accounts.size === maxCoverage)\n    .map(([iso]) => iso)\n    .sort()\n    .at(-1) ?? requestedIsoDate;\n}\n''',
    "analytics date helpers",
)
s = replace_once(
    s,
    '''  async getAnalytics(\n    period: AnalyticsPeriod = "today",\n    userRole: UserRolePermission = "HEAD_OFFICE",\n    allowedStoreIds?: string[],\n  ) {\n    const startDate = this.getPeriodStartDate(period);\n    const now = new Date();\n''',
    '''  async getAnalytics(\n    period: AnalyticsPeriod = "today",\n    userRole: UserRolePermission = "HEAD_OFFICE",\n    allowedStoreIds?: string[],\n    customRange?: { from: string; to: string },\n  ) {\n    const startDate = customRange ? getBangkokMidnightUtcFromIso(customRange.from) : this.getPeriodStartDate(period);\n    const now = new Date();\n    const rangeEndExclusive = customRange\n      ? getBangkokMidnightUtcFromIso(getOffsetBangkokDateString(customRange.to, 1))\n      : undefined;\n''',
    "analytics signature",
)
s = replace_once(
    s,
    '''        storeId: { in: activeStoreIds },\n        createdAt: { gte: startDate },\n''',
    '''        storeId: { in: activeStoreIds },\n        createdAt: rangeEndExclusive ? { gte: startDate, lt: rangeEndExclusive } : { gte: startDate },\n''',
    "conversation custom filter",
)
s = replace_once(
    s,
    '''    const { targetIsoDate, baselineIsoDate } = getPeriodDates(period, now);\n    const targetUtcDate = toUtcDateForDb(targetIsoDate);\n    const baselineUtcDate = toUtcDateForDb(baselineIsoDate);\n\n    const periodSnapshots = this.prisma?.lineOaFollowerSnapshot && accountIds.length > 0\n      ? await this.prisma.lineOaFollowerSnapshot.findMany({\n          where: {\n            lineOaId: { in: accountIds },\n            snapshotDate: { in: [targetUtcDate, baselineUtcDate] },\n            status: "ready",\n          },\n          select: {\n            lineOaId: true,\n            snapshotDate: true,\n            status: true,\n            followers: true,\n            targetedReaches: true,\n            blocks: true,\n          },\n        })\n      : [];\n''',
    '''    const presetFollowerDates = getPeriodDates(period, now);\n    const requestedTargetIsoDate = customRange?.to ?? presetFollowerDates.targetIsoDate;\n    const requestedBaselineIsoDate = customRange\n      ? getOffsetBangkokDateString(customRange.from, -1)\n      : presetFollowerDates.baselineIsoDate;\n    const followerLookupStart = toUtcDateForDb(getOffsetBangkokDateString(requestedBaselineIsoDate, -14));\n    const requestedTargetUtcDate = toUtcDateForDb(requestedTargetIsoDate);\n\n    const followerSnapshotWindow = this.prisma?.lineOaFollowerSnapshot && accountIds.length > 0\n      ? await this.prisma.lineOaFollowerSnapshot.findMany({\n          where: {\n            lineOaId: { in: accountIds },\n            snapshotDate: { gte: followerLookupStart, lte: requestedTargetUtcDate },\n            status: "ready",\n          },\n          select: {\n            lineOaId: true,\n            snapshotDate: true,\n            status: true,\n            followers: true,\n            targetedReaches: true,\n            blocks: true,\n          },\n          orderBy: { snapshotDate: "asc" },\n        })\n      : [];\n\n    const targetIsoDate = pickReliableFollowerDate(followerSnapshotWindow, requestedTargetIsoDate);\n    const baselineIsoDate = pickReliableFollowerDate(followerSnapshotWindow, requestedBaselineIsoDate);\n    const periodSnapshots = followerSnapshotWindow;\n''',
    "follower reliable range",
)
p.write_text(s)

# Main dashboard: reuse the existing dual-month picker and pass exact dateFrom/dateTo to both APIs.
p = Path("frontend/src/app/dashboard/executive-dashboard-v2.tsx")
s = p.read_text()
s = replace_once(
    s,
    '''import { api } from "@/lib/api";\nimport type { DashboardAnalyticsResponse } from "@/types/api";\n''',
    '''import type { DashboardAnalyticsResponse } from "@/types/api";\nimport { DateRangePicker } from "@/app/follower-insights/date-range-picker";\nimport { getBangkokIsoDate, rangeForPreset, shiftIsoDate, type DashboardDateRange } from "./dashboard-date-range";\n''',
    "dashboard imports",
)
s = replace_once(
    s,
    '''export function ExecutiveDashboardV2({\n  getStoreDisplayName,\n  onOpenStore,\n  lastUpdatedAt,\n}: ExecutiveDashboardV2Props) {\n  const [period, setPeriod] = useState<Period>("7d");\n''',
    '''export function ExecutiveDashboardV2({\n  language,\n  getStoreDisplayName,\n  onOpenStore,\n  lastUpdatedAt,\n}: ExecutiveDashboardV2Props) {\n  const [period, setPeriod] = useState<Period>("7d");\n  const [dateRange, setDateRange] = useState<DashboardDateRange>(() => rangeForPreset("7d"));\n  const [customRangeActive, setCustomRangeActive] = useState(false);\n''',
    "dashboard state",
)
s = replace_once(
    s,
    '''  const load = useCallback(async (nextPeriod: Period) => {\n    setLoading(true);\n    try {\n      const [analyticsData, healthResponse] = await Promise.all([\n        api.dashboardAnalytics(nextPeriod),\n        fetch(`/api-backend/dashboard/executive-store-health?period=${encodeURIComponent(nextPeriod)}`, {\n          credentials: "include",\n          cache: "no-store",\n        }),\n      ]);\n      if (!healthResponse.ok) throw new Error(`Executive store health request failed (${healthResponse.status})`);\n      const healthData = (await healthResponse.json()) as ExecutiveStoreHealth;\n      setAnalytics(analyticsData);\n''',
    '''  const load = useCallback(async (nextPeriod: Period, nextRange: DashboardDateRange) => {\n    setLoading(true);\n    try {\n      const params = new URLSearchParams({\n        period: nextPeriod,\n        dateFrom: nextRange.dateFrom,\n        dateTo: nextRange.dateTo,\n      });\n      const [analyticsResponse, healthResponse] = await Promise.all([\n        fetch(`/api-backend/dashboard/analytics?${params.toString()}`, { credentials: "include", cache: "no-store" }),\n        fetch(`/api-backend/dashboard/executive-store-health?${params.toString()}`, { credentials: "include", cache: "no-store" }),\n      ]);\n      if (!analyticsResponse.ok) throw new Error(`Dashboard analytics request failed (${analyticsResponse.status})`);\n      if (!healthResponse.ok) throw new Error(`Executive store health request failed (${healthResponse.status})`);\n      const analyticsData = (await analyticsResponse.json()) as DashboardAnalyticsResponse;\n      const healthData = (await healthResponse.json()) as ExecutiveStoreHealth;\n      setAnalytics(analyticsData);\n''',
    "dashboard load",
)
s = replace_once(
    s,
    '''  useEffect(() => {\n    const initialLoad = window.setTimeout(() => void load(period), 0);\n    const interval = window.setInterval(() => void load(period), 60_000);\n    return () => {\n      window.clearTimeout(initialLoad);\n      window.clearInterval(interval);\n    };\n  }, [load, period]);\n''',
    '''  useEffect(() => {\n    const initialLoad = window.setTimeout(() => void load(period, dateRange), 0);\n    const interval = window.setInterval(() => void load(period, dateRange), 60_000);\n    return () => {\n      window.clearTimeout(initialLoad);\n      window.clearInterval(interval);\n    };\n  }, [load, period, dateRange]);\n\n  const applyPreset = useCallback((nextPeriod: Period) => {\n    setPeriod(nextPeriod);\n    setDateRange(rangeForPreset(nextPeriod));\n    setCustomRangeActive(false);\n  }, []);\n\n  const applyCustomRange = useCallback((dateFrom: string, dateTo: string) => {\n    setDateRange({ dateFrom, dateTo });\n    setCustomRangeActive(true);\n  }, []);\n\n  const applyQuickDays = useCallback((days: number) => {\n    const today = getBangkokIsoDate();\n    const nextRange = { dateFrom: shiftIsoDate(today, -(days - 1)), dateTo: today };\n    setDateRange(nextRange);\n    if (days === 7) {\n      setPeriod("7d");\n      setCustomRangeActive(false);\n    } else if (days === 30) {\n      setPeriod("30d");\n      setCustomRangeActive(false);\n    } else {\n      setPeriod("30d");\n      setCustomRangeActive(true);\n    }\n  }, []);\n''',
    "dashboard effect",
)
s = s.replace('onClick={() => void load(period)}', 'onClick={() => void load(period, dateRange)}')
s = replace_once(
    s,
    '''                  onClick={() => setPeriod(item)}\n                  className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition ${period === item ? "bg-[var(--dash-accent)] font-semibold text-white" : "text-[var(--dash-text-secondary)] hover:bg-[var(--dash-accent-soft)]"}`}\n''',
    '''                  onClick={() => applyPreset(item)}\n                  className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition ${period === item && !customRangeActive ? "bg-[var(--dash-accent)] font-semibold text-white" : "text-[var(--dash-text-secondary)] hover:bg-[var(--dash-accent-soft)]"}`}\n''',
    "preset buttons",
)
s = replace_once(
    s,
    '''            </div>\n          </div>\n        </header>\n''',
    '''            </div>\n            <DateRangePicker\n              dateFrom={dateRange.dateFrom}\n              dateTo={dateRange.dateTo}\n              language={language}\n              onApply={applyCustomRange}\n              onQuickRange={applyQuickDays}\n            />\n          </div>\n        </header>\n''',
    "date picker placement",
)
# Avoid unreadable labels when a custom range contains many days.
s = replace_once(
    s,
    '''          {points.map((point) => (\n            <g key={point.item.date}>\n''',
    '''          {points.map((point, index) => (\n            <g key={point.item.date}>\n''',
    "trend point index",
)
s = replace_once(
    s,
    '''              <text x={point.x} y={height - 3} textAnchor="middle" fontSize="10" fill="#A1A1A6">\n                {formatDateLabel(point.item.date)}\n              </text>\n''',
    '''              {(index % Math.max(1, Math.ceil(points.length / 7)) === 0 || index === points.length - 1) && (\n                <text x={point.x} y={height - 3} textAnchor="middle" fontSize="10" fill="#A1A1A6">\n                  {formatDateLabel(point.item.date)}\n                </text>\n              )}\n''',
    "trend label density",
)
p.write_text(s)
