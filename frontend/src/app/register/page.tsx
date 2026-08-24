"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { registrationApi, type RegistrationRole, type RegistrationStore } from "@/lib/registration-api";
import { ThemeControl } from "../theme";

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
            <input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" />
          </label>

          <label className="block text-sm">
            Confirm password
            <input type="password" required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700" />
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
