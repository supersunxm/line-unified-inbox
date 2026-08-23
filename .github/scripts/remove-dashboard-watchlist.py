from pathlib import Path

p = Path('frontend/src/app/dashboard/executive-dashboard-v2.tsx')
s = p.read_text()

issue_labels = '''const issueLabels: Record<WatchIssue, string> = {\n  reach: "เข้าถึงต่ำ",\n  block: "บล็อกสูง",\n  inactive: "ยังไม่เปิดใช้งาน",\n};\n\n'''
if issue_labels not in s:
    raise SystemExit('issueLabels block not found')
s = s.replace(issue_labels, '', 1)

watchlist_memo = '''  const watchlist = useMemo(() => {\n    return [...(health?.stores ?? [])]\n      .filter((store) => store.issues.length > 0)\n      .sort((a, b) => b.issues.length - a.issues.length || a.followers - b.followers);\n  }, [health]);\n\n'''
if watchlist_memo not in s:
    raise SystemExit('watchlist memo not found')
s = s.replace(watchlist_memo, '', 1)

start_marker = '        <SectionLabel>สาขาที่ต้องติดตาม</SectionLabel>\n'
end_marker = '        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">\n'
start = s.find(start_marker)
if start == -1:
    raise SystemExit('watchlist section start not found')
end = s.find(end_marker, start)
if end == -1:
    raise SystemExit('watchlist section end not found')
s = s[:start] + s[end:]

p.write_text(s)
