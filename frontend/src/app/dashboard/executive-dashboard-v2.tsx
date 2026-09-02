"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ExecutiveDashboardV2 as ExecutiveDashboardBase } from "./executive-dashboard-base";
import { ExecutiveStorePeerPanel } from "./executive-store-peer-panel";

export { calcBucketPercent } from "./executive-dashboard-base";

type Language = "th" | "en" | "zh";

interface ExecutiveDashboardV2Props {
  language: Language;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  lastUpdatedAt: Date | null;
}

function StorePeerPanelPortal({
  rootRef,
  getStoreDisplayName,
  onOpenStore,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
}) {
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let node: HTMLDivElement | null = null;

    const attach = () => {
      if (node?.isConnected) return;
      const header = root.querySelector("header");
      if (!header?.parentElement) return;
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
        rootRef={rootRef}
        getStoreDisplayName={getStoreDisplayName}
        onOpenStore={onOpenStore}
      />
    </div>
  );
}
