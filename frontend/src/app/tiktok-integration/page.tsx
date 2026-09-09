import type { Metadata } from "next";
import Link from "next/link";
import { PublicBrandIcon } from "@/components/public-brand-icon";

export const metadata: Metadata = {
  title: {
    absolute: "การเชื่อมต่อ TikTok | OPPO Brand Shop",
  },
  description: "รายละเอียดการเชื่อมต่ออย่างเป็นทางการระหว่าง TikTok Login Kit กับระบบ OPPO Brand Shop ข้อมูลที่เข้าถึง วัตถุประสงค์ และขอบเขตความปลอดภัย",
};

export default function TikTokIntegrationPage() {
  return (
    <div className="min-h-screen bg-[var(--app-bg,#0b0d11)] text-[var(--app-text-primary,#f8fafc)] flex flex-col justify-between antialiased selection:bg-[var(--app-accent-soft,rgba(0,186,124,0.15))] selection:text-[var(--app-accent,#00ba7c)]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <PublicBrandIcon />
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-accent,#00ba7c)] text-white font-bold text-lg shadow-sm group-hover:scale-105 transition">
              O
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-tight">OPPO Brand Shop</span>
              <span className="text-[11px] text-[var(--app-text-tertiary,#94a3b8)] leading-tight">TikTok Integration</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-xs">
            <Link
              href="/stores"
              className="text-[var(--app-text-secondary,#cbd5e1)] hover:text-[var(--app-accent,#00ba7c)] transition"
            >
              ค้นหาสาขา
            </Link>
            <Link
              href="/connect/tiktok"
              className="rounded-lg bg-[var(--app-accent,#00ba7c)] px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 transition"
            >
              เชื่อมต่อ TikTok
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* Hero Section */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span>Official Integration Overview</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--app-text-primary,#f8fafc)]">
              การเชื่อมต่อ TikTok กับ OPPO Brand Shop
            </h1>
            <p className="text-base text-[var(--app-text-secondary,#cbd5e1)] leading-relaxed max-w-3xl">
              หน้านี้อธิบายรายละเอียดการเชื่อมต่ออย่างเป็นทางการระหว่าง TikTok และเว็บไซต์ lineoppo.click
              เพื่อความโปร่งใส ความปลอดภัยของข้อมูล และความเข้าใจร่วมกันของผู้ใช้บริการและผู้ดูแลระบบ
            </p>
          </div>

          {/* Section 1: What the Integration Does */}
          <section className="rounded-2xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)] p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--app-text-primary,#f8fafc)]">
                การทำงานของระบบ (What the Integration Does)
              </h2>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200 leading-relaxed font-medium">
              &ldquo;เจ้าของบัญชี TikTok ของ OPPO Brand Shop สามารถเชื่อมต่อบัญชีเพื่อแสดงข้อมูลโปรไฟล์และสถิติพื้นฐานของบัญชีบนแพลตฟอร์ม&rdquo;
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--app-text-secondary,#cbd5e1)]">
              การเชื่อมต่อดำเนินการผ่าน <strong>TikTok Login Kit (Web OAuth 2.0)</strong> อย่างเป็นทางการ
              โดยเจ้าของบัญชีเป็นผู้ให้ความยินยอมด้วยตนเองผ่านหน้าต่างยืนยันสิทธิ์มาตรฐานของ TikTok
            </p>
          </section>

          {/* Section 2: Data Accessed */}
          <section className="rounded-2xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)] p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                2
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--app-text-primary,#f8fafc)]">
                ข้อมูลที่เข้าถึง (Data Accessed)
              </h2>
            </div>
            <p className="text-sm text-[var(--app-text-secondary,#cbd5e1)] mb-4">
              ระบบร้องขอเฉพาะสิทธิ์การอ่านข้อมูลพื้นฐาน (Minimum Read-Only Scopes: <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">user.info.basic</code>, <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">user.info.profile</code>, <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">user.info.stats</code>):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface-subtle,#0d1017)] p-4">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Profile Identity</span>
                <p className="mt-1 text-sm font-medium text-[var(--app-text-primary,#f8fafc)]">รูปโปรไฟล์ (Avatar) & ชื่อที่แสดง (Display Name)</p>
                <p className="mt-0.5 text-xs text-[var(--app-text-tertiary,#94a3b8)]">สำหรับแสดงสัญลักษณ์และชื่อบัญชีทางการ</p>
              </div>

              <div className="rounded-xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface-subtle,#0d1017)] p-4">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Username</span>
                <p className="mt-1 text-sm font-medium text-[var(--app-text-primary,#f8fafc)]">ชื่อผู้ใช้ (@username) & ลิงก์โปรไฟล์</p>
                <p className="mt-0.5 text-xs text-[var(--app-text-tertiary,#94a3b8)]">สำหรับสร้างลิงก์ตรงไปยังบัญชี TikTok ของสาขา</p>
              </div>

              <div className="rounded-xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface-subtle,#0d1017)] p-4">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Audience Metrics</span>
                <p className="mt-1 text-sm font-medium text-[var(--app-text-primary,#f8fafc)]">จำนวนผู้ติดตาม (Follower Count) & กำลังติดตาม (Following Count)</p>
                <p className="mt-0.5 text-xs text-[var(--app-text-tertiary,#94a3b8)]">แสดงความน่าเชื่อถือและการเข้าถึงของสาขา</p>
              </div>

              <div className="rounded-xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface-subtle,#0d1017)] p-4">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Engagement Metrics</span>
                <p className="mt-1 text-sm font-medium text-[var(--app-text-primary,#f8fafc)]">ยอดถูกใจทั้งหมด (Likes Count) & จำนวนวิดีโอ (Video Count)</p>
                <p className="mt-0.5 text-xs text-[var(--app-text-tertiary,#94a3b8)]">แสดงระดับกิจกรรมและการมีส่วนร่วมของสาขา</p>
              </div>
            </div>
          </section>

          {/* Section 3: Purpose */}
          <section className="rounded-2xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)] p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                3
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--app-text-primary,#f8fafc)]">
                วัตถุประสงค์ (Purpose)
              </h2>
            </div>
            <ul className="space-y-3 text-sm text-[var(--app-text-secondary,#cbd5e1)] leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs mt-0.5">✓</span>
                <div>
                  <strong className="text-[var(--app-text-primary,#f8fafc)]">แสดงช่องทางโซเชียลมีเดียที่ถูกต้องของสาขา:</strong>
                  <span className="block text-xs text-[var(--app-text-tertiary,#94a3b8)] mt-0.5">
                    ช่วยให้ลูกค้าที่ค้นหาสาขา OPPO Brand Shop บนเว็บไซต์ค้นหาสาขา (Store Directory) สามารถเข้าถึงช่องทาง TikTok ทางการได้อย่างถูกต้องและปลอดภัย
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs mt-0.5">✓</span>
                <div>
                  <strong className="text-[var(--app-text-primary,#f8fafc)]">วิเคราะห์และติดตามตัวชี้วัดของสาขา:</strong>
                  <span className="block text-xs text-[var(--app-text-tertiary,#94a3b8)] mt-0.5">
                    ให้ข้อมูลเชิงสถิติแก่ทีมงานและผู้จัดการสาขาเพื่อพัฒนาคุณภาพการสื่อสารและการบริการลูกค้า
                  </span>
                </div>
              </li>
            </ul>
          </section>

          {/* Section 4: Strict Boundaries */}
          <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                ✕
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-rose-300">
                ขอบเขตความปลอดภัยและสิ่งที่เราไม่ทำ (Strict Boundaries)
              </h2>
            </div>
            <p className="text-sm text-rose-200/90 mb-4 font-medium">
              เว็บไซต์และระบบของเราไม่มีการร้องขอสิทธิ์หรือดำเนินการในสิ่งต่อไปนี้:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-rose-200/80">
              <div className="rounded-xl border border-rose-500/20 bg-black/20 p-3.5">
                <strong className="block text-rose-300 font-semibold mb-1">✕ ไม่โพสต์คอนเทนต์บน TikTok</strong>
                ระบบไม่มีสิทธิ์ในการเผยแพร่วิดีโอ รูปภาพ หรือข้อความใดๆ ในบัญชีของคุณ
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-black/20 p-3.5">
                <strong className="block text-rose-300 font-semibold mb-1">✕ ไม่แก้ไขหรือลบคอนเทนต์</strong>
                ระบบไม่สามารถแก้ไขข้อมูลบัญชี ลบวิดีโอ หรือเปลี่ยนแปลงข้อมูลใดๆ ได้
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-black/20 p-3.5">
                <strong className="block text-rose-300 font-semibold mb-1">✕ ไม่เข้าถึงข้อความส่วนตัว (DMs)</strong>
                ระบบไม่มีการอ่าน ส่ง หรือเข้าถึงบทสนทนาส่วนตัวใน TikTok
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-black/20 p-3.5">
                <strong className="block text-rose-300 font-semibold mb-1">✕ ไม่เข้าถึงบัญชีโดยไม่ได้รับอนุญาต</strong>
                ระบบเข้าถึงเฉพาะบัญชีที่เจ้าของบัญชียืนยันตัวตนและให้สิทธิ์ผ่าน TikTok Login Kit เท่านั้น
              </div>
            </div>
          </section>

          {/* Section 5: Technical Security & Revocation */}
          <section className="rounded-2xl border border-[var(--app-border,#1e2430)] bg-[var(--app-surface,#12151c)] p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                4
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--app-text-primary,#f8fafc)]">
                มาตรฐานความปลอดภัยและการเพิกถอนสิทธิ์
              </h2>
            </div>
            <div className="space-y-3 text-sm text-[var(--app-text-secondary,#cbd5e1)] leading-relaxed">
              <p>
                <strong>การเข้ารหัสข้อมูล (Encryption at Rest):</strong> Access Token และ Refresh Token จะถูกเข้ารหัสด้วยมาตรฐานความปลอดภัยระดับสูง (AES-256-GCM) ก่อนบันทึกลงในฐานข้อมูล และไม่มีการส่งต่อ token ไปยังเบราว์เซอร์ของผู้ใช้
              </p>
              <p>
                <strong>การเพิกถอนสิทธิ์ (Revocation):</strong> ผู้ใช้สามารถยกเลิกการเชื่อมต่อหรือเพิกถอนสิทธิ์ได้ตลอดเวลาผ่านแอปพลิเคชัน TikTok ในเมนู <em>การตั้งค่าและความเป็นส่วนตัว &gt; ความปลอดภัยและสิทธิ์ &gt; แอปและบริการของบุคคลที่สาม</em> หรือส่งคำขอลบข้อมูลมายัง <a href="mailto:obsthailand@gmail.com" className="text-[var(--app-accent,#00ba7c)] underline">obsthailand@gmail.com</a>
              </p>
            </div>
          </section>

          {/* Action CTAs */}
          <div className="rounded-2xl border border-[var(--app-border,#1e2430)] bg-gradient-to-br from-emerald-950/20 to-[var(--app-surface,#12151c)] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[var(--app-text-primary,#f8fafc)]">
                พร้อมเชื่อมต่อบัญชี TikTok ของสาขาคุณแล้วหรือยัง?
              </h3>
              <p className="text-xs text-[var(--app-text-secondary,#cbd5e1)] mt-1">
                ดำเนินการเชื่อมต่อผ่านหน้าต่างความปลอดภัยของ TikTok Login Kit
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link
                href="/connect/tiktok"
                className="w-full sm:w-auto text-center rounded-xl bg-[var(--app-accent,#00ba7c)] px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition"
              >
                ไปที่หน้าเชื่อมต่อ TikTok
              </Link>
              <Link
                href="/stores"
                className="w-full sm:w-auto text-center rounded-xl border border-[var(--app-border,#1e2430)] px-4 py-2.5 text-xs font-semibold text-[var(--app-text-secondary,#cbd5e1)] hover:bg-white/5 transition"
              >
                ดูสาขาทั้งหมด
              </Link>
            </div>
          </div>

          {/* Legal Links */}
          <div className="pt-4 border-t border-[var(--app-border,#1e2430)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--app-text-tertiary,#94a3b8)]">
            <span>เอกสารและข้อตกลงที่เกี่ยวข้อง:</span>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-[var(--app-accent,#00ba7c)] transition">
                นโยบายความเป็นส่วนตัว (Privacy Policy)
              </Link>
              <Link href="/terms" className="hover:text-[var(--app-accent,#00ba7c)] transition">
                ข้อกำหนดการให้บริการ (Terms of Service)
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--app-border,#1e2430)] py-6 text-center text-xs text-[var(--app-text-tertiary,#94a3b8)]">
        <p>© {new Date().getFullYear()} OPPO Brand Shop Directory · lineoppo.click · สงวนลิขสิทธิ์</p>
      </footer>
    </div>
  );
}
