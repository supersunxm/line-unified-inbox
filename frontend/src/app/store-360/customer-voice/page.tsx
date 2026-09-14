import { Suspense } from "react";
import { CustomerVoiceDrilldownView } from "./customer-voice-view";

export default function Store360CustomerVoicePage() {
  return (
    <Suspense fallback={<main className="store360-workspace flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Customer Voice…</main>}>
      <CustomerVoiceDrilldownView />
    </Suspense>
  );
}
