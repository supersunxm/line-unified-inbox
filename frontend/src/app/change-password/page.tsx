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
    requirements: "อย่างน้อย 8 ตัวอักษร และต้องมีตัวอักษรกับตัวเลขอย่างน้อยอย่างละ 1 ตัว",
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
    requirements: "At least 8 characters with at least one letter and one number.",
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
    requirements: "至少 8 个字符，并至少包含 1 个字母和 1 个数字。",
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

export default function ChangePasswordPage() {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, translations);
  const [state, setState] = useState<PageState>("checking");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

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
        setError(reason instanceof Error ? reason.message : t.unable);
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
      setError(reason instanceof Error ? reason.message : t.unable);
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

        <label className="mt-5 block text-sm text-slate-700 dark:text-slate-200">
          {t.currentPassword}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <label className="mt-4 block text-sm text-slate-700 dark:text-slate-200">
          {t.newPassword}
          <input
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <label className="mt-4 block text-sm text-slate-700 dark:text-slate-200">
          {t.confirmPassword}
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.requirements}</p>

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
