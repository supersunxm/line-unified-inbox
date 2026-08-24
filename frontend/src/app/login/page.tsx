import Link from "next/link";
import { ApplicationWorkspace } from "../page";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen">
      <ApplicationWorkspace initialSection="dashboard" />
      <Link
        href="/register"
        className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
      >
        Create BM / PC account
      </Link>
    </div>
  );
}
