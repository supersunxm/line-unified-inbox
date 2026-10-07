"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { defaultRouteForUser } from "@/lib/authorization";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../language";

type PageState = "checking" | "ready" | "saving" | "redirecting";

const translations = {
  th: {
    title: "ตั้งรหัสผ่านใหม่",
    subtitle: "บัญชีนี้ถูกรีเซ็ตรหัสผ่าน กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ",
    currentPassword: "รหัสผ่านชั่วคราว",
    newPassword: "รหัสผ่านใหม่",
    confirmPassword: "ยืนยันรหัสผ่านใหม่",
    rulesTitle: "รหัสผ่านใหม่ต้องมี",
    ruleLength: "อย่างน้อย 8 ตัวอักษร",
    ruleLetter: "ตัวอักษรอย่างน้อย 1 ตัว",
    ruleNumber: "ตัวเลขอย่างน้อย 1 ตัว",
    showPassword: "แสดงรหัสผ่าน",
    hidePassword: "ซ่อนรหัสผ่าน",
    mismatch: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน",
    invalidPolicy: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข",
    unable: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
    checking: "กำลังตรวจสอบบัญชี…",
    saving: "กำลังบันทึกรหัสผ่านใหม่…",
    submit: "ตั้งรหัสผ่านใหม่",
  },
  en: {
    title: "Set a new password",
    subtitle: "This account was reset. Set a new password before continuing to the workspace.",
    currentPassword: "Temporary password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    rulesTitle: "Your new password must include",
    ruleLength: "At least 8 characters",
    ruleLetter: "At least 1 letter",
    ruleNumber: "At least 1 number",
    showPassword: "Show password",
    hidePassword: "Hide password",
    mismatch: "The new password and confirmation do not match.",
    invalidPolicy: "The new password must be at least 8 characters and include a letter and a number.",
    unable: "Unable to change password",
    checking: "Checking your account…",
    saving: "Saving your new password…",
    submit: "Set new password",
  },
  zh: {
    title: "设置新密码",
    subtitle: "此账户的密码已被重置。进入工作区前，请先设置新密码。",
    currentPassword: "临时密码",
    newPassword: "新密码",
    confirmPassword: "确认新密码",
    rulesTitle: "新密码必须包含",
    ruleLength: "至少 8 个字符",
    ruleLetter: "至少 1 个字母",
    ruleNumber: "至少 1 个数字",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    mismatch: "新密码与确认密码不一致。",
    invalidPolicy: "新密码至少需要 8 个字符，并同时包含字母和数字。",
    unable: "无法更改密码",
    checking: "正在检查账户…",
    saving: "正在保存新密码…",
    submit: "设置新密码",
  },
};

function passwordMeetsPolicy(password: string) {
  return password.length >= 8 && /\p{L}/u.test(password) && /[0-9]/.test(password);
}

function localizedPageError(reason: unknown, fallback: string) {
  if (reason instanceof ApiError && (/^API request failed \(\d+\)$/.test(reason.message) || reason.message.startsWith("Unable to reach the data service."))) {
    return fallback;
  }
  return reason instanceof Error ? reason.message : fallback;
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.9 10.9 0 0112 4c5.2 0 8.5 4.2 9.5 6-.5.9-1.6 2.5-3.2 3.8M6.2 6.2C4.3 7.5 3.1 9.2 2.5 10c1 1.8 4.3 6 9.5 6 1 0 1.9-.2 2.7-.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showPasswordLabel,
  hidePasswordLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  showPasswordLabel: string;
  hidePasswordLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-11 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-400 dark:text-slate-400 dark:hover:text-white"
        >
          <PasswordVisibilityIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, translations);
  const [state, setState] = useState<PageState>("checking");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const passwordRules = [
    { label: t.ruleLength, met: newPassword.length >= 8 },
    { label: t.ruleLetter, met: /\p{L}/u.test(newPassword) },
    { label: t.ruleNumber, met: /[0-9]/.test(newPassword) },
  ];

  useEffect(() => {
    let cancelled = false;
    void api.me()
      .then((user) => {
        if (cancelled) return;
        if (!user.mustChangePassword) {
          setState("redirecting");
          window.location.replace(defaultRouteForUser(user));
          return;
        }
        setState("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) {
          window.location.replace("/login");
          return;
        }
        setError(localizedPageError(reason, t.unable));
        setState("ready");
      });
    return () => { cancelled = true; };
  }, [t.unable]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      setError(t.mismatch);
      return;
    }
    if (!passwordMeetsPolicy(newPassword)) {
      setError(t.invalidPolicy);
      return;
    }

    setState("saving");
    try {
      await api.changePassword(currentPassword, newPassword);
      const user = await api.me();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setState("redirecting");
      window.location.replace(defaultRouteForUser(user));
    } catch (reason: unknown) {
      setError(localizedPageError(reason, t.unable));
      setState("ready");
    }
  }

  if (state === "checking" || state === "redirecting") {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-100 p-6 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        <LanguageControl className="absolute right-4 top-4" />
        {t.checking}
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <LanguageControl className="absolute right-4 top-4" />
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-950 dark:text-white">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5">
          <PasswordField
            id="temporary-password"
            label={t.currentPassword}
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            showPasswordLabel={t.showPassword}
            hidePasswordLabel={t.hidePassword}
          />
        </div>

        <div className="mt-4">
          <PasswordField
            id="new-password"
            label={t.newPassword}
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            showPasswordLabel={t.showPassword}
            hidePasswordLabel={t.hidePassword}
          />
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60" aria-live="polite">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.rulesTitle}</p>
          <ul className="mt-2 space-y-1.5">
            {passwordRules.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs ${rule.met ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${rule.met ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40" : "border-slate-300 dark:border-slate-700"}`}
                >
                  {rule.met ? "✓" : ""}
                </span>
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <PasswordField
            id="confirm-password"
            label={t.confirmPassword}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            showPasswordLabel={t.showPassword}
            hidePasswordLabel={t.hidePassword}
          />
        </div>

        <button
          disabled={state === "saving"}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          {state === "saving" ? t.saving : t.submit}
        </button>
      </form>
    </main>
  );
}
