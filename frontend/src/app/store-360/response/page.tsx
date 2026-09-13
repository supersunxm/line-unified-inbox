import { Suspense } from "react";
import { ResponseDrilldownView } from "./response-view";

export default function Store360ResponsePage() {
  return (
    <Suspense fallback={<main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Response Analysis…</main>}>
      <ResponseDrilldownView />
    </Suspense>
  );
}
