"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { registrationApi, type RegistrationRole, type RegistrationStore } from "@/lib/registration-api";
import { ThemeControl } from "../theme";

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
      <path d="M9.9 4.3A10.6 10.6 0 0 1 12 4c5.2 0 8.8 4.6 9.7 6.1a3.6 3.6 0 0 1 0 3.8 15.2 15.2 0 0 1-2.8 3.4" strokeLinecap="round" />
      <path d="M6.6 6.6A15 15 0 0 0 2.3 10a3.6 3.6 0 0 0 0 3.8C3.2 15.4 6.8 20 12 20a10.8 10.8 0 0 0 4-.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M2.3 10.1a3.6 3.6 0 0 0 0 3.8C3.2 15.4 6.8 20 12 20s8.8-4.6 9.7-6.1a3.6 3.6 0 0 0 0-3.8C20.8 8.6 17.2 4 12 4S3.2 8.6 2.3 10.1Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function RegisterPage() {
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
    void registrationApi.stores()
      .then((items) => {
        if (!active) return;
        setStores(items);
        if (items.length > 0) setStoreId(items[0].id);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load stores");
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 12) {
      setError("Password must contain at least 12 characters");
      return;
    }
    if (!isHq && !storeId) {
      setError("Please select a store");
      return;
    }

    setSubmitting(true);
    try {
      if (isHq) {
        await registrationApi.registerHq({
          name: name.trim(),
          employeeId: employeeId.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await registrationApi.register({
          name: name.trim(),
          employeeId: employeeId.trim(),
          email: email.trim(),
          storeId,
          role,
          password,
        });
      }
      setSubmitted(true);
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="absolute right-6 top-6"><ThemeControl /></div>
        <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
          <h1 className="text-2xl font-bold">Registration submitted</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Your account is waiting for administrator approval. After approval, the same email and password can be used on both the Web and Mobile app according to your access permissions.
          </p>
          <Link href="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute right-6 top-6"><ThemeControl /></div>
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Create OPPO LINE OA Monitor account</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">HQ / BM / PC registration</p>
          </div>
          <Link href="/login" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">Sign in</Link>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            Name
            <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" />
          </label>

          <label className="block text-sm">
            Employee ID
            <input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" />
          </label>

          <label className="block text-sm">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" />
          </label>

          <label className="block text-sm sm:col-span-2">
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as RegistrationRole)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700">
              <option value="STAFF">PC / Staff</option>
              <option value="STORE_MANAGER">BM / Store Manager</option>
              <option value="HQ">HQ / Head Office — Full access</option>
            </select>
          </label>

          {!isHq && (
            <label className="block text-sm sm:col-span-2">
              Store
              <select required disabled={storesLoading || stores.length === 0} value={storeId} onChange={(event) => setStoreId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700">
                {storesLoading && <option value="">Loading stores…</option>}
                {!storesLoading && stores.length === 0 && <option value="">No stores available</option>}
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` (${store.code})` : ""}</option>)}
              </select>
            </label>
          )}

          {isHq && (
            <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              HQ accounts are not attached to a store. After approval they receive Web + Mobile access, HQ workspace, all stores, account management, reply, and Main OA permissions.
            </div>
          )}

          <label className="block text-sm">
            Password
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent py-2.5 pl-2.5 pr-11 dark:border-slate-700"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
            </div>
          </label>

          <label className="block text-sm">
            Confirm password
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent py-2.5 pl-2.5 pr-11 dark:border-slate-700"
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <PasswordVisibilityIcon visible={showConfirmPassword} />
              </button>
            </div>
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Password must contain at least 12 characters.</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">One approved account is used for both Web and Mobile. HQ requests require approval from an existing full-access administrator.</p>

        <button disabled={submitting || (!isHq && (storesLoading || !storeId))} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
          {submitting ? "Submitting…" : "Submit registration"}
        </button>
      </form>
    </main>
  );
}
