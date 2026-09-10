import { Suspense } from "react";
import { AuthorizedSection } from "../authorized-workspace";
import { Store360View } from "./store-360-view";

export default function Store360Page() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Store 360…</main>}>
      <AuthorizedSection section="store-360">
        <Store360View />
      </AuthorizedSection>
    </Suspense>
  );
}
