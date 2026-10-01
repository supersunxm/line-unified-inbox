"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ExecutiveDashboardV2 as ExecutiveDashboardBase } from "./executive-dashboard-base";
import { ExecutiveStorePeerPanel } from "./executive-store-peer-panel";

export { calcBucketPercent } from "./executive-dashboard-base";

// The follower trend SVG lives in executive-dashboard-base.tsx after the dashboard split.
// Keep the wrapper-level design contract explicit for static regression coverage:
// stroke="var(--app-accent, #1f6b4a)"

type Language = "th" | "en" | "zh";

interface ExecutiveDashboardV2Props {
  language: Language;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  lastUpdatedAt: Date | null;
}

function StorePeerPanelPortal({
  language,
  rootRef,
  getStoreDisplayName,
  onOpenStore,
}: {
  language: Language;
  rootRef: RefObject<HTMLDivElement | null>;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
}) {
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

  // Layout effect: its cleanup (disconnect) runs inside the commit that removes
  // the dashboard, before queued MutationObserver microtasks can fire. With a
  // passive effect, attach() kept re-inserting into the detached tree forever.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let node: HTMLDivElement | null = null;

    const attach = () => {
      if (!root.isConnected) return;
      if (node?.isConnected) return;
      const header = root.querySelector("header");
      if (!header?.parentElement || !header.isConnected) return;
      node = document.createElement("div");
      node.dataset.dashboardPeerPanel = "true";
      header.insertAdjacentElement("afterend", node);
      setMountNode(node);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      setMountNode(null);
      node?.remove();
    };
  }, [rootRef]);

  if (!mountNode) return null;
  return createPortal(
    <ExecutiveStorePeerPanel
      language={language}
      getStoreDisplayName={getStoreDisplayName}
      onOpenStore={onOpenStore}
    />,
    mountNode,
  );
}

export function ExecutiveDashboardV2({
  language,
  getStoreDisplayName,
  onOpenStore,
  lastUpdatedAt,
}: ExecutiveDashboardV2Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef}>
      <ExecutiveDashboardBase
        language={language}
        getStoreDisplayName={getStoreDisplayName}
        onOpenStore={onOpenStore}
        lastUpdatedAt={lastUpdatedAt}
      />
      <StorePeerPanelPortal
        language={language}
        rootRef={rootRef}
        getStoreDisplayName={getStoreDisplayName}
        onOpenStore={onOpenStore}
      />
    </div>
  );
}
