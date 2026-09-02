import fs from 'node:fs';

const file = 'frontend/src/app/dashboard/executive-dashboard-v2.tsx';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
`type StoreHealthRow = {
  storeId: string;
  storeName: string;
  partner: string;
  followers: number;
  start: number;
  growth: number;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
  issues: WatchIssue[];
};

type ExecutiveStoreHealth = {
  stores: StoreHealthRow[];
  followerTrend: Array<{ date: string; followers: number }>;
  connectedStoreCount: number;
  totalStoreCount: number;
};`,
`type StoreHealthRow = {
  storeId: string | null;
  storeMasterId: string;
  storeCode: string | null;
  storeName: string;
  partner: string;
  tier: string | null;
  kpiPlan: string | null;
  area: string | null;
  bm: string | null;
  followers: number;
  start: number;
  growth: number;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
  issues: WatchIssue[];
  peerRank: number | null;
  peerSize: number;
  peerAverageFollowers: number | null;
  needsAttention: boolean;
  isConnected: boolean;
};

type ExecutiveStoreHealth = {
  stores: StoreHealthRow[];
  followerTrend: Array<{ date: string; followers: number }>;
  connectedStoreCount: number;
  totalStoreCount: number;
  scopeStoreCount: number;
  filterOptions: {
    tiers: string[];
    kpiPlans: string[];
    areas: string[];
    bms: string[];
  };
};`,
'types');

replaceOnce(
`  const [fetchError, setFetchError] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);`,
`  const [fetchError, setFetchError] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [tierFilter, setTierFilter] = useState("");
  const [kpiPlanFilter, setKpiPlanFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [bmFilter, setBmFilter] = useState("");`,
'filter state');

replaceOnce(
`      const [analyticsResponse, healthResponse] = await Promise.all([
        fetch(\`/api-backend/dashboard/analytics?\${params.toString()}\`, { credentials: "include", cache: "no-store" }),
        fetch(\`/api-backend/dashboard/executive-store-health?\${params.toString()}\`, { credentials: "include", cache: "no-store" }),
      ]);`,
`      const healthParams = new URLSearchParams(params);
      if (tierFilter) healthParams.set("tier", tierFilter);
      if (kpiPlanFilter) healthParams.set("kpiPlan", kpiPlanFilter);
      if (areaFilter) healthParams.set("area", areaFilter);
      if (bmFilter) healthParams.set("bm", bmFilter);
      const [analyticsResponse, healthResponse] = await Promise.all([
        fetch(\`/api-backend/dashboard/analytics?\${params.toString()}\`, { credentials: "include", cache: "no-store" }),
        fetch(\`/api-backend/dashboard/executive-store-health?\${healthParams.toString()}\`, { credentials: "include", cache: "no-store" }),
      ]);`,
'health query filters');

replaceOnce(
`  }, []);

  useEffect(() => {`,
`  }, [areaFilter, bmFilter, kpiPlanFilter, tierFilter]);

  useEffect(() => {`,
'load dependencies');

replaceOnce(
`  const top10 = analytics.storeFollowersRanking?.top10 ?? [...health.stores].sort((a, b) => b.followers - a.followers).slice(0, 10);
  const bottom10 = analytics.storeFollowersRanking?.bottom10
    ? [...analytics.storeFollowersRanking.bottom10].sort((a, b) => a.followers - b.followers)
    : [...health.stores].filter((store) => store.followers > 0).sort((a, b) => a.followers - b.followers).slice(0, 10);
  const updatedAt = lastFetchAt ?? lastUpdatedAt;
  const replyRate = messagesTotal > 0 ? Math.round((replied / messagesTotal) * 100) : 0;`,
`  const peerRanking = [...health.stores]
    .sort((a, b) => (a.kpiPlan ?? "").localeCompare(b.kpiPlan ?? "") || (a.peerRank ?? Number.MAX_SAFE_INTEGER) - (b.peerRank ?? Number.MAX_SAFE_INTEGER) || b.followers - a.followers)
    .slice(0, 10);
  const needsAttention = [...health.stores]
    .filter((store) => store.needsAttention)
    .sort((a, b) => b.issues.length - a.issues.length || (b.peerRank ?? 0) - (a.peerRank ?? 0) || a.followers - b.followers)
    .slice(0, 10);
  const updatedAt = lastFetchAt ?? lastUpdatedAt;
  const replyRate = messagesTotal > 0 ? Math.round((replied / messagesTotal) * 100) : 0;
  const hasStoreFilters = Boolean(tierFilter || kpiPlanFilter || areaFilter || bmFilter);
  const filteredFollowers = health.stores.reduce((sum, store) => sum + store.followers, 0);
  const filteredGrowth = health.stores.reduce((sum, store) => sum + store.growth, 0);
  const displayedFollowers = hasStoreFilters ? filteredFollowers : follower.totalFriends;
  const displayedNet = hasStoreFilters ? filteredGrowth : follower.netToday;
  const clearStoreFilters = () => {
    setTierFilter("");
    setKpiPlanFilter("");
    setAreaFilter("");
    setBmFilter("");
  };`,
'peer ranking derivations');

replaceOnce(
`        </header>

        {fetchError && (`,
`        </header>

        <Card className="mb-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-[var(--dash-text)]">ตัวกรองเปรียบเทียบสาขา</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--dash-text-tertiary)]">ใช้ StoreMaster เป็นข้อมูลหลัก · แสดง {health.totalStoreCount.toLocaleString()} จาก {health.scopeStoreCount.toLocaleString()} สาขา</div>
            </div>
            {hasStoreFilters && <button type="button" onClick={clearStoreFilters} className="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs font-semibold text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]">ล้างตัวกรอง</button>}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Tier", value: tierFilter, setter: setTierFilter, options: health.filterOptions.tiers },
              { label: "KPI Plan", value: kpiPlanFilter, setter: setKpiPlanFilter, options: health.filterOptions.kpiPlans },
              { label: "Area", value: areaFilter, setter: setAreaFilter, options: health.filterOptions.areas },
              { label: "BM", value: bmFilter, setter: setBmFilter, options: health.filterOptions.bms },
            ].map((filter) => (
              <label key={filter.label} className="text-[11px] font-semibold text-[var(--dash-text-secondary)]">
                <span className="mb-1 block">{filter.label}</span>
                <select value={filter.value} onChange={(event) => filter.setter(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 text-sm font-medium text-[var(--dash-text)] outline-none focus:border-[var(--dash-accent)]">
                  <option value="">ทั้งหมด</option>
                  {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
        </Card>

        {fetchError && (`,
'filter bar');

replaceOnce(
`                <div className="text-[44px] font-bold leading-none tracking-[-0.03em]">{follower.totalFriends.toLocaleString()}</div>
                <div className="mt-2 text-[13px] text-[var(--dash-text-secondary)]">{health.totalStoreCount.toLocaleString()} สาขา · เทียบตามช่วงเวลาที่เลือก</div>`,
`                <div className="text-[44px] font-bold leading-none tracking-[-0.03em]">{displayedFollowers.toLocaleString()}</div>
                <div className="mt-2 text-[13px] text-[var(--dash-text-secondary)]">{hasStoreFilters ? \`${health.totalStoreCount.toLocaleString()} จาก ${health.scopeStoreCount.toLocaleString()} สาขา · ตามตัวกรอง\` : \`${health.scopeStoreCount.toLocaleString()} สาขา · เทียบตามช่วงเวลาที่เลือก\`}</div>`,
'hero followers');

replaceOnce(
`              <div className={\`rounded-[10px] px-3 py-2 text-sm font-bold \${follower.netToday >= 0 ? "bg-[var(--dash-green-soft)] text-[#1E8E3E]" : "bg-[var(--dash-red-soft)] text-[#C62828]"}\`}>
                {follower.netToday >= 0 ? "▲" : "▼"} {follower.netToday >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(follower.netToday).toLocaleString()} คน
              </div>`,
`              <div className={\`rounded-[10px] px-3 py-2 text-sm font-bold \${displayedNet >= 0 ? "bg-[var(--dash-green-soft)] text-[#1E8E3E]" : "bg-[var(--dash-red-soft)] text-[#C62828]"}\`}>
                {displayedNet >= 0 ? "▲" : "▼"} {displayedNet >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(displayedNet).toLocaleString()} คน
              </div>`,
'hero net');

replaceOnce(
`            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3">
                <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">ผู้ติดตามใหม่</div>
                <div className="mt-1 text-[19px] font-bold text-[var(--dash-green)]">+{Math.max(0, follower.addedToday).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3">
                <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">บล็อกเพิ่ม</div>
                <div className="mt-1 text-[19px] font-bold text-[var(--dash-red)]">−{Math.max(0, follower.blockedToday).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3">
                <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">เพิ่มขึ้นสุทธิ</div>
                <div className={\`mt-1 text-[19px] font-bold \${follower.netToday >= 0 ? "text-[var(--dash-green)]" : "text-[var(--dash-red)]"}\`}>{follower.netToday >= 0 ? "+" : ""}{follower.netToday.toLocaleString()}</div>
              </div>
            </div>`,
`            {hasStoreFilters ? (
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3"><div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">ร้านในผลลัพธ์</div><div className="mt-1 text-[19px] font-bold text-[var(--dash-text)]">{health.totalStoreCount.toLocaleString()}</div></div>
                <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3"><div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">ผู้ติดตามปัจจุบัน</div><div className="mt-1 text-[19px] font-bold text-[var(--dash-text)]">{filteredFollowers.toLocaleString()}</div></div>
                <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3"><div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">เปลี่ยนแปลงสุทธิ</div><div className={\`mt-1 text-[19px] font-bold \${filteredGrowth >= 0 ? "text-[var(--dash-green)]" : "text-[var(--dash-red)]"}\`}>{filteredGrowth >= 0 ? "+" : ""}{filteredGrowth.toLocaleString()}</div></div>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3"><div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">ผู้ติดตามใหม่</div><div className="mt-1 text-[19px] font-bold text-[var(--dash-green)]">+{Math.max(0, follower.addedToday).toLocaleString()}</div></div>
                <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3"><div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">บล็อกเพิ่ม</div><div className="mt-1 text-[19px] font-bold text-[var(--dash-red)]">−{Math.max(0, follower.blockedToday).toLocaleString()}</div></div>
                <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3"><div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">เพิ่มขึ้นสุทธิ</div><div className={\`mt-1 text-[19px] font-bold \${follower.netToday >= 0 ? "text-[var(--dash-green)]" : "text-[var(--dash-red)]"}\`}>{follower.netToday >= 0 ? "+" : ""}{follower.netToday.toLocaleString()}</div></div>
              </div>
            )}`,
'hero cards');

replaceOnce(
`            {topGrowth.length > 0 ? topGrowth.map((store) => (
              <button key={store.storeId} type="button" onClick={() => onOpenStore(store.storeId)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--dash-border)] py-2 text-left text-[12.5px] last:border-b-0 hover:text-[var(--dash-accent)]">`,
`            {topGrowth.length > 0 ? topGrowth.map((store) => (
              <button key={store.storeMasterId} type="button" disabled={!store.storeId} onClick={() => store.storeId && onOpenStore(store.storeId)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--dash-border)] py-2 text-left text-[12.5px] last:border-b-0 hover:text-[var(--dash-accent)] disabled:cursor-default">`,
'top growth nullable store');

const detailStart = `        <SectionLabel>รายละเอียดระดับสาขา</SectionLabel>`;
const detailEnd = `        <SectionLabel>ข้อมูลเสริม</SectionLabel>`;
const startIndex = source.indexOf(detailStart);
const endIndex = source.indexOf(detailEnd);
if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) throw new Error('Detail section anchors not found');
const issueLabel = `{ reach: "Reach ต่ำ", block: "Block สูง", inactive: "ยังไม่พร้อม" } as Record<WatchIssue, string>`;
const replacement = `        <SectionLabel>เปรียบเทียบตาม KPI Plan</SectionLabel>
        <Card className="p-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--dash-text)]">Same KPI Plan Ranking</h2>
              <div className="mt-1 text-xs text-[var(--dash-text-secondary)]">อันดับคำนวณเทียบเฉพาะร้านที่อยู่ใน KPI Plan เดียวกัน โดย StoreMaster เป็น source of truth</div>
            </div>
            <span className="text-xs text-[var(--dash-text-tertiary)]">{health.totalStoreCount.toLocaleString()} ร้านในผลลัพธ์</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <div className="mb-2 text-xs font-bold text-[var(--dash-text-secondary)]">อันดับในกลุ่มเดียวกัน</div>
              <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                <thead><tr className="border-b border-[var(--dash-border)] text-[10.5px] uppercase text-[var(--dash-text-tertiary)]"><th className="px-2 py-2 text-left">ร้านค้า</th><th className="px-2 py-2 text-left">KPI Plan</th><th className="px-2 py-2 text-right">อันดับ</th><th className="px-2 py-2 text-right">ผู้ติดตาม</th></tr></thead>
                <tbody>{peerRanking.map((store) => (
                  <tr key={store.storeMasterId} className="border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-accent-soft)]">
                    <td className="px-2 py-2.5"><button type="button" disabled={!store.storeId} onClick={() => store.storeId && onOpenStore(store.storeId)} className="text-left font-medium text-[var(--dash-text)] hover:text-[var(--dash-accent)] disabled:cursor-default">{getStoreDisplayName(store.storeName)}</button><div className="text-[10px] text-[var(--dash-text-tertiary)]">{store.tier ?? "—"} · {store.area ?? "—"}</div></td>
                    <td className="px-2 py-2.5 text-[var(--dash-text-secondary)]">{store.kpiPlan ?? "—"}</td>
                    <td className="px-2 py-2.5 text-right font-bold tabular-nums text-[var(--dash-accent)]">{store.peerRank ? \`#${store.peerRank}/${store.peerSize}\` : "—"}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{store.followers.toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
              {peerRanking.length === 0 && <div className="py-6 text-center text-xs text-[var(--dash-text-tertiary)]">ไม่พบร้านตามตัวกรอง</div>}
            </div>
            <div className="overflow-x-auto">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-[var(--dash-text-secondary)]">Needs Attention</span><span className="text-[10.5px] text-[var(--dash-text-tertiary)]">เกณฑ์เดิม: Reach / Block / Inactive</span></div>
              <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                <thead><tr className="border-b border-[var(--dash-border)] text-[10.5px] uppercase text-[var(--dash-text-tertiary)]"><th className="px-2 py-2 text-left">ร้านค้า</th><th className="px-2 py-2 text-left">เหตุผล</th><th className="px-2 py-2 text-right">Peer Rank</th></tr></thead>
                <tbody>{needsAttention.map((store) => (
                  <tr key={store.storeMasterId} className="border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-red-soft)]">
                    <td className="px-2 py-2.5"><button type="button" disabled={!store.storeId} onClick={() => store.storeId && onOpenStore(store.storeId)} className="text-left font-medium text-[var(--dash-text)] hover:text-[var(--dash-accent)] disabled:cursor-default">{getStoreDisplayName(store.storeName)}</button><div className="text-[10px] text-[var(--dash-text-tertiary)]">{store.kpiPlan ?? "—"} · BM {store.bm ?? "—"}</div></td>
                    <td className="px-2 py-2.5"><div className="flex flex-wrap gap-1">{store.issues.map((issue) => <span key={issue} className="rounded-full bg-[var(--dash-red-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dash-red)]">{(${issueLabel})[issue]}</span>)}</div></td>
                    <td className="px-2 py-2.5 text-right font-bold tabular-nums text-[var(--dash-text)]">{store.peerRank ? \`#${store.peerRank}/${store.peerSize}\` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
              {needsAttention.length === 0 && <div className="py-6 text-center text-xs text-[var(--dash-text-tertiary)]">ไม่มีร้านที่เข้าเกณฑ์ Needs Attention</div>}
            </div>
          </div>
        </Card>

`;
source = source.slice(0, startIndex) + replacement + source.slice(endIndex);

fs.writeFileSync(file, source);
for (const helper of [
  'scripts/.apply-dashboard-peer-ui.mjs',
  '.github/workflows/.apply-dashboard-peer-ui.yml',
]) {
  if (fs.existsSync(helper)) fs.rmSync(helper);
}
