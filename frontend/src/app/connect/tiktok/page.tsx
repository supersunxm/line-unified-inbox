import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เชื่อมต่อ TikTok กับ OPPO Brand Shop | OPPO Brand Shop",
  description: "เชื่อมต่อบัญชี TikTok ของสาขากับ OPPO Brand Shop เพื่อแสดงข้อมูลโปรไฟล์และสถิติพื้นฐานบนเว็บไซต์ค้นหาสาขา",
  robots: { index: false, follow: false },
};

export default function TikTokConnectPage() {
  const isConfigured = Boolean(process.env.TIKTOK_CLIENT_KEY?.trim());

  return (
    <div className="min-h-screen bg-[var(--app-bg,#0b0d11)] text-[var(--app-text-primary,#f8fafc)] flex flex-col justify-between antialiased selection:bg-[var(--app-accent-soft,rgba(0,186,124,0.15))] selection:text-[var(--app-accent,#00ba7c)]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-accent,#00ba7c)] text-white font-bold text-lg shadow-sm group-hover:scale-105 transition">
              O
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-tight">OPPO Brand Shop</span>
              <span className="text-[11px] text-[var(--app-text-tertiary,#94a3b8)] leading-tight">TikTok Account Connection</span>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/stores"
              className="text-[var(--app-text-secondary,#cbd5e1)] hover:text-[var(--app-accent,#00ba7c)] transition"
            >
              ← สาขาทั้งหมด
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {/* Card Container */}
          <div className="rounded-2xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)] p-6 sm:p-10 shadow-xl">
            {/* TikTok Brand Badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white border border-slate-700 shadow-md">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.37 0 .72.07 1.05.2V9.08a6.37 6.37 0 0 0-1.05-.09A6.34 6.34 0 0 0 3 15.34 6.34 6.34 0 0 0 9.34 21.7a6.34 6.34 0 0 0 6.34-6.36V8.71a8.21 8.21 0 0 0 4.91 1.63v-3.45a4.85 4.85 0 0 1-1-.2z" />
                </svg>
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  TikTok Login Kit v2
                </span>
                <p className="text-xs text-[var(--app-text-tertiary,#94a3b8)] mt-0.5">การเชื่อมต่ออย่างเป็นทางการ (Official OAuth 2.0)</p>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--app-text-primary,#f8fafc)]">
              เชื่อมต่อ TikTok กับ OPPO Brand Shop
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--app-text-secondary,#cbd5e1)]">
              เจ้าของบัญชีหรือผู้ดูแลบัญชี TikTok ของสาขา สามารถเชื่อมต่อบัญชีเข้ากับระบบ lineoppo.click
              เพื่ออนุญาตให้อ่านข้อมูลโปรไฟล์และสถิติพื้นฐานสำหรับการแสดงผลและวิเคราะห์ข้อมูล
            </p>

            {/* Scope / Data Accessed Section */}
            <div className="mt-6 rounded-xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface-subtle,#0d1017)] p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary,#94a3b8)]">
                ข้อมูลที่เว็บไซต์ร้องขอเพื่อเข้าถึง (Read-only)
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--app-text-secondary,#cbd5e1)]">
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                  <span><strong>ข้อมูลโปรไฟล์:</strong> รูปโปรไฟล์ (Avatar), ชื่อที่แสดง (Display Name), ชื่อผู้ใช้ (@username)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                  <span><strong>ผู้ติดตาม:</strong> จำนวนผู้ติดตามบัญชี (Followers)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                  <span><strong>กำลังติดตาม:</strong> จำนวนบัญชีที่ติดตาม (Following)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                  <span><strong>ยอดถูกใจทั้งหมด:</strong> ยอดกดถูกใจรวมของบัญชี (Total Likes)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                  <span><strong>จำนวนวิดีโอ:</strong> จำนวนวิดีโอสาธารณะของบัญชี (Video Count)</span>
                </li>
              </ul>
            </div>

            {/* Strict Boundaries / Non-Posting Disclaimer */}
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200/90">
              <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
                <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>ข้อกำหนดความปลอดภัยและความเป็นส่วนตัว</span>
              </div>
              <ul className="space-y-1 list-disc list-inside text-amber-200/80">
                <li>เว็บไซต์<strong>จะไม่โพสต์ แก้ไข หรือลบคอนเทนต์</strong>ใดๆ ในบัญชี TikTok ของคุณ</li>
                <li>เว็บไซต์<strong>ไม่มีการเข้าถึงข้อความส่วนตัว</strong> (Direct Messages)</li>
                <li>ผู้ใช้สามารถ<strong>ยกเลิกการเชื่อมต่อหรือเพิกถอนสิทธิ์ได้ตลอดเวลา</strong>ผ่านการตั้งค่าบัญชี TikTok</li>
              </ul>
            </div>

            {/* CTA Section */}
            <div className="mt-8 pt-6 border-t border-[var(--app-border,#1e2430)]">
              {isConfigured ? (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <a
                    href="/api/tiktok/authorize"
                    className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl bg-[var(--app-accent,#00ba7c)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 transition"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.37 0 .72.07 1.05.2V9.08a6.37 6.37 0 0 0-1.05-.09A6.34 6.34 0 0 0 3 15.34 6.34 6.34 0 0 0 9.34 21.7a6.34 6.34 0 0 0 6.34-6.36V8.71a8.21 8.21 0 0 0 4.91 1.63v-3.45a4.85 4.85 0 0 1-1-.2z" />
                    </svg>
                    <span>เชื่อมต่อกับ TikTok</span>
                  </a>
                  <Link
                    href="/tiktok-integration"
                    className="w-full sm:w-auto text-center px-4 py-3 text-xs font-medium text-[var(--app-text-secondary,#cbd5e1)] hover:text-white transition"
                  >
                    อ่านรายละเอียดการเชื่อมต่อ →
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-sm font-bold">
                      !
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-300">
                        รอการกำหนดค่าการเชื่อมต่อ (TikTok Sandbox Configuration Required)
                      </h3>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                        ระบบกำลังเตรียมความพร้อมสำหรับการตรวจสอบแอป (TikTok App Review) ในสภาพแวดล้อมปัจจุบันยังไม่ได้กำหนดค่า Client Key สำหรับ TikTok Login Kit
                      </p>
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled
                          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-700/60 px-5 py-2.5 text-xs font-semibold text-slate-400 border border-slate-600/50"
                        >
                          <span>เชื่อมต่อกับ TikTok (ยังไม่เปิดใช้งาน)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Policy & Terms Footer Links */}
            <div className="mt-8 pt-4 border-t border-[var(--app-border,#1e2430)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--app-text-tertiary,#94a3b8)]">
              <Link href="/tiktok-integration" className="hover:text-[var(--app-accent,#00ba7c)] transition">
                เกี่ยวกับ TikTok Integration
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/privacy" className="hover:text-[var(--app-accent,#00ba7c)] transition">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-[var(--app-accent,#00ba7c)] transition">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--app-border,#1e2430)] py-6 text-center text-xs text-[var(--app-text-tertiary,#94a3b8)]">
        <p>© {new Date().getFullYear()} OPPO Brand Shop · lineoppo.click · สงวนลิขสิทธิ์</p>
      </footer>
    </div>
  );
}
