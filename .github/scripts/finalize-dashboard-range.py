from pathlib import Path

p = Path("backend/src/dashboard-analytics.service.ts")
s = p.read_text()
old = '''          where: {\n            lineOaId: { in: accountIds },\n            status: "ready",\n            followers: { not: null },\n          },\n          orderBy: { snapshotDate: "desc" },'''
new = '''          where: {\n            lineOaId: { in: accountIds },\n            status: "ready",\n            followers: { not: null },\n            snapshotDate: { lte: toUtcDateForDb(targetIsoDate) },\n          },\n          orderBy: { snapshotDate: "desc" },'''
if old not in s:
    raise SystemExit("latest follower snapshot query target missing")
s = s.replace(old, new, 1)
p.write_text(s)

p = Path("frontend/src/app/dashboard/executive-dashboard-v2.tsx")
s = p.read_text()
s = s.replace("ความเร็วในการตอบกลับวันนี้", "ความเร็วในการตอบกลับในช่วงที่เลือก", 1)
s = s.replace("ยังไม่มีข้อความที่ตอบกลับในวันนี้", "ยังไม่มีข้อความที่ตอบกลับในช่วงที่เลือก", 1)
p.write_text(s)
