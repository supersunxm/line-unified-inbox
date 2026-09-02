"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { registrationApi, type RegistrationRole, type RegistrationStore } from "@/lib/registration-api";
import { ThemeControl } from "../theme";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../language";

const registerTranslations = {
  th: {
    loadStoresFailed: "ไม่สามารถโหลดรายชื่อร้านค้าได้",
    passwordMismatch: "รหัสผ่านไม่ตรงกัน",
    passwordTooShort: "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร",
    selectStoreError: "กรุณาเลือกร้านค้า",
    registrationFailed: "ลงทะเบียนไม่สำเร็จ",
    submittedTitle: "ส่งคำขอลงทะเบียนแล้ว",
    submittedDescription: "บัญชีของคุณกำลังรอผู้ดูแลระบบอนุมัติ หลังอนุมัติแล้วสามารถใช้อีเมลและรหัสผ่านเดียวกันได้ทั้ง Web และ Mobile ตามสิทธิ์ที่ได้รับ",
    backToSignIn: "กลับไปเข้าสู่ระบบ",
    createTitle: "สร้างบัญชี OPPO LINE OA Monitor",
    registrationType: "ลงทะเบียน HQ / BM / PC",
    signIn: "เข้าสู่ระบบ",
    name: "ชื่อ",
    employeeId: "รหัสพนักงาน",
    email: "อีเมล",
    role: "บทบาท",
    staffRole: "PC / พนักงานร้าน",
    managerRole: "BM / ผู้จัดการร้าน",
    hqRole: "HQ / สำนักงานใหญ่ — สิทธิ์เต็ม",
    store: "ร้านค้า",
    loadingStores: "กำลังโหลดร้านค้า…",
    noStores: "ไม่มีร้านค้าให้เลือก",
    hqNotice: "บัญชี HQ จะไม่ผูกกับร้านค้า หลังได้รับอนุมัติจะสามารถใช้ Web + Mobile, HQ workspace, ดูทุกร้าน, จัดการบัญชี, ตอบข้อความ และใช้งาน Main OA ตามสิทธิ์ที่กำหนด",
    password: "รหัสผ่าน",
    hidePassword: "ซ่อนรหัสผ่าน",
    showPassword: "แสดงรหัสผ่าน",
    requirements: "ข้อกำหนดรหัสผ่าน",
    min12: "อย่างน้อย 12 ตัวอักษร",
    uppercase: "มีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)",
    lowercase: "มีตัวพิมพ์เล็กอย่างน้อย 1 ตัว (a-z)",
    number: "มีตัวเลขอย่างน้อย 1 ตัว (0-9)",
    special: "มีอักขระพิเศษอย่างน้อย 1 ตัว (@#$%^&*...)",
    confirmPassword: "ยืนยันรหัสผ่าน",
    hideConfirm: "ซ่อนรหัสผ่านยืนยัน",
    showConfirm: "แสดงรหัสผ่านยืนยัน",
    accountNote: "บัญชีที่อนุมัติแล้ว 1 บัญชีใช้ได้ทั้ง Web และ Mobile ส่วนคำขอ HQ ต้องได้รับอนุมัติจากผู้ดูแลระบบที่มีสิทธิ์เต็ม",
    submitting: "กำลังส่งคำขอ…",
    submit: "ส่งคำขอลงทะเบียน",
  },
  en: {
    loadStoresFailed: "Unable to load stores",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must contain at least 12 characters",
    selectStoreError: "Please select a store",
    registrationFailed: "Registration failed",
    submittedTitle: "Registration submitted",
    submittedDescription: "Your account is waiting for administrator approval. After approval, the same email and password can be used on both Web and Mobile according to your access permissions.",
    backToSignIn: "Back to sign in",
    createTitle: "Create OPPO LINE OA Monitor account",
    registrationType: "HQ / BM / PC registration",
    signIn: "Sign in",
    name: "Name",
    employeeId: "Employee ID",
    email: "Email",
    role: "Role",
    staffRole: "PC / Staff",
    managerRole: "BM / Store Manager",
    hqRole: "HQ / Head Office — Full access",
    store: "Store",
    loadingStores: "Loading stores…",
    noStores: "No stores available",
    hqNotice: "HQ accounts are not attached to a store. After approval they receive Web + Mobile access, HQ workspace, all stores, account management, reply, and Main OA permissions.",
    password: "Password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    requirements: "Password requirements",
    min12: "At least 12 characters",
    uppercase: "At least 1 uppercase letter (A-Z)",
    lowercase: "At least 1 lowercase letter (a-z)",
    number: "At least 1 number (0-9)",
    special: "At least 1 special character (@#$%^&*...)",
    confirmPassword: "Confirm password",
    hideConfirm: "Hide confirm password",
    showConfirm: "Show confirm password",
    accountNote: "One approved account is used for both Web and Mobile. HQ requests require approval from an existing full-access administrator.",
    submitting: "Submitting…",
    submit: "Submit registration",
  },
  zh: {
    loadStoresFailed: "无法加载门店列表",
    passwordMismatch: "两次输入的密码不一致",
    passwordTooShort: "密码至少需要 12 个字符",
    selectStoreError: "请选择门店",
    registrationFailed: "注册失败",
    submittedTitle: "注册申请已提交",
    submittedDescription: "您的账户正在等待管理员审批。审批通过后，可根据授权范围在 Web 和 Mobile 端使用相同的邮箱和密码登录。",
    backToSignIn: "返回登录",
    createTitle: "创建 OPPO LINE OA Monitor 账户",
    registrationType: "HQ / BM / PC 注册",
    signIn: "登录",
    name: "姓名",
    employeeId: "员工编号",
    email: "邮箱",
    role: "角色",
    staffRole: "PC / 门店员工",
    managerRole: "BM / 门店经理",
    hqRole: "HQ / 总部 — 完整权限",
    store: "门店",
    loadingStores: "正在加载门店…",
    noStores: "暂无可选门店",
    hqNotice: "HQ 账户不绑定门店。审批通过后，可根据授权使用 Web + Mobile、HQ 工作区、全部门店、账户管理、消息回复及 Main OA 功能。",
    password: "密码",
    hidePassword: "隐藏密码",
    showPassword: "显示密码",
    requirements: "密码要求",
    min12: "至少 12 个字符",
    uppercase: "至少 1 个大写字母 (A-Z)",
    lowercase: "至少 1 个小写字母 (a-z)",
    number: "至少 1 个数字 (0-9)",
    special: "至少 1 个特殊字符 (@#$%^&*...)",
    confirmPassword: "确认密码",
    hideConfirm: "隐藏确认密码",
    showConfirm: "显示确认密码",
    accountNote: "一个获批账户可同时用于 Web 和 Mobile。HQ 申请需由现有的完整权限管理员审批。",
    submitting: "正在提交…",
    submit: "提交注册申请",
  },
};

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M3 3l18 18" strokeLinecap="round" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" /><path d="M9.9 4.3A10.6 10.6 0 0 1 12 4c5.2 0 8.8 4.6 9.7 6.1a3.6 3.6 0 0 1 0 3.8 15.2 15.2 0 0 1-2.8 3.4" strokeLinecap="round" /><path d="M6.6 6.6A15 15 0 0 0 2.3 10a3.6 3.6 0 0 0 0 3.8C3.2 15.4 6.8 20 12 20a10.8 10.8 0 0 0 4-.8" strokeLinecap="round" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M2.3 10.1a3.6 3.6 0 0 0 0 3.8C3.2 15.4 6.8 20 12 20s8.8-4.6 9.7-6.1a3.6 3.6 0 0 0 0-3.8C20.8 8.6 17.2 4 12 4S3.2 8.6 2.3 10.1Z" /><circle cx="12" cy="12" r="3" /></svg>
  );
}

export default function RegisterPage() {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, registerTranslations);
  const [stores, setStores] = useState<RegistrationStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState("");
  const [role, setRole] = useState<RegistrationRole>("STAFF");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isHq = role === "HQ";

  useEffect(() => {
    let active = true;
    void registrationApi.stores().then((items) => {
      if (!active) return;
      setStores(items);
      if (items.length > 0) setStoreId(items[0].id);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : t.loadStoresFailed);
    }).finally(() => {
      if (active) setStoresLoading(false);
    });
    return () => { active = false; };
  }, [t.loadStoresFailed]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError(t.passwordMismatch); return; }
    if (password.length < 12) { setError(t.passwordTooShort); return; }
    if (!isHq && !storeId) { setError(t.selectStoreError); return; }
    setSubmitting(true);
    try {
      if (isHq) {
        await registrationApi.registerHq({ name: name.trim(), employeeId: employeeId.trim(), email: email.trim(), password });
      } else {
        await registrationApi.register({ name: name.trim(), employeeId: employeeId.trim(), email: email.trim(), storeId, role, password });
      }
      setSubmitted(true);
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.registrationFailed);
    } finally { setSubmitting(false); }
  }

  if (submitted) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="absolute right-6 top-6 flex items-center gap-2"><LanguageControl /><ThemeControl /></div>
        <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
          <h1 className="text-2xl font-bold">{t.submittedTitle}</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t.submittedDescription}</p>
          <Link href="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">{t.backToSignIn}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute right-6 top-6 flex items-center gap-2"><LanguageControl /><ThemeControl /></div>
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-2xl font-bold">{t.createTitle}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.registrationType}</p></div>
          <Link href="/login" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">{t.signIn}</Link>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">{t.name}<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" /></label>
          <label className="block text-sm">{t.employeeId}<input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" /></label>
          <label className="block text-sm">{t.email}<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" /></label>
          <label className="block text-sm sm:col-span-2">{t.role}<select value={role} onChange={(event) => setRole(event.target.value as RegistrationRole)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700"><option value="STAFF">{t.staffRole}</option><option value="STORE_MANAGER">{t.managerRole}</option><option value="HQ">{t.hqRole}</option></select></label>
          {!isHq && <label className="block text-sm sm:col-span-2">{t.store}<select required disabled={storesLoading || stores.length === 0} value={storeId} onChange={(event) => setStoreId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700">{storesLoading && <option value="">{t.loadingStores}</option>}{!storesLoading && stores.length === 0 && <option value="">{t.noStores}</option>}{stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` (${store.code})` : ""}</option>)}</select></label>}
          {isHq && <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{t.hqNotice}</div>}
          <label className="block text-sm">{t.password}<div className="relative mt-1"><input type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" aria-describedby="registration-password-requirements" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-transparent py-2.5 pl-2.5 pr-11 dark:border-slate-700" /><button type="button" aria-label={showPassword ? t.hidePassword : t.showPassword} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:text-slate-100"><PasswordVisibilityIcon visible={showPassword} /></button></div><div id="registration-password-requirements" className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><p className="font-medium text-slate-600 dark:text-slate-300">{t.requirements}</p><ul className="mt-1 space-y-0.5" aria-label={t.requirements}><li>✓ {t.min12}</li><li>✓ {t.uppercase}</li><li>✓ {t.lowercase}</li><li>✓ {t.number}</li><li>✓ {t.special}</li></ul></div></label>
          <label className="block text-sm">{t.confirmPassword}<div className="relative mt-1"><input type={showConfirmPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-transparent py-2.5 pl-2.5 pr-11 dark:border-slate-700" /><button type="button" aria-label={showConfirmPassword ? t.hideConfirm : t.showConfirm} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:text-slate-100"><PasswordVisibilityIcon visible={showConfirmPassword} /></button></div></label>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.accountNote}</p>
        <button disabled={submitting || (!isHq && (storesLoading || !storeId))} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{submitting ? t.submitting : t.submit}</button>
      </form>
    </main>
  );
}
