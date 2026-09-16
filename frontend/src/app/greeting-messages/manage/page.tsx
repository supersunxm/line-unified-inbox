"use client";

import { AuthorizedWorkspace } from "../../authorized-workspace";
import { GreetingManagementView } from "../greeting-management-view";

export default function GreetingManagementPage() {
  return (
    <>
      {/* Reuse the canonical application shell so this page keeps the same sidebar/top navigation as the rest of the app. */}
      <div className="greeting-manage-shell-source">
        <AuthorizedWorkspace section="greeting-messages" />
      </div>

      {/* Management content overlays only the workspace content area; the canonical app navigation remains visible. */}
      <div className="greeting-manage-overlay">
        <GreetingManagementView />
      </div>

      <style jsx global>{`
        .greeting-manage-overlay {
          position: fixed;
          inset: 3.75rem 0 0 var(--app-sidebar-width, 16rem);
          z-index: 20;
          overflow: auto;
          background: var(--app-bg, #f7f9fb);
        }

        /* GreetingManagementView originally shipped with a temporary standalone sidebar.
           Hide only that local sidebar now that the canonical app shell is restored. */
        .greeting-manage-overlay aside:first-of-type {
          display: none !important;
        }

        .greeting-manage-overlay main {
          width: 100% !important;
          min-width: 0 !important;
          padding-top: 1.25rem !important;
        }

        .greeting-manage-overlay > div,
        .greeting-manage-overlay > div > div {
          min-height: 100% !important;
        }

        @media (max-width: 767px) {
          .greeting-manage-overlay {
            inset: 3.75rem 0 0 0;
          }
        }
      `}</style>
    </>
  );
}
