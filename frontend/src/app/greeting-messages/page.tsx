"use client";

import { AuthorizedWorkspace } from "../authorized-workspace";

export default function GreetingMessagesPage() {
  return (
    <>
      <AuthorizedWorkspace section="greeting-messages" />
      <style jsx global>{`
        /* Keep Greeting Messages store targeting visually aligned with Rich Menu. */
        #greeting-store-targeting {
          border-radius: 0.5rem !important;
          border-color: #e5e7eb !important;
          padding: 1.25rem !important;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03) !important;
        }

        #greeting-store-targeting > div:first-child {
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #f3f4f6;
        }

        #greeting-store-targeting > div:first-child h2 {
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          color: #111827;
        }

        /* The table toolbar is the primary targeting control, like Rich Menu. */
        #greeting-store-targeting > div:first-child > div:last-child {
          display: none !important;
        }

        #greeting-store-targeting > div:nth-child(2) {
          border-radius: 0.375rem !important;
          box-shadow: none !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child {
          display: flex !important;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0 !important;
          margin-bottom: 0.75rem;
          border: 0 !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child input[type="search"] {
          width: 15rem;
          height: 2rem !important;
          border-color: #d1d5db !important;
          border-radius: 0.25rem !important;
          padding-inline: 0.625rem !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child select {
          height: 2rem !important;
          border-color: #d1d5db !important;
          border-radius: 0.25rem !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child > div:nth-last-child(2) {
          height: 2rem !important;
          padding: 0.125rem !important;
          border-color: #e5e7eb !important;
          background: #fafafa !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child > div:nth-last-child(2) button {
          border-radius: 0.25rem !important;
          font-weight: 600 !important;
        }

        /* Selection actions become the same compact right-side command row as Rich Menu. */
        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) {
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          margin-bottom: 0.75rem;
          justify-content: flex-end !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) > div {
          margin-left: auto;
        }

        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) button {
          color: #06c755 !important;
          font-weight: 600 !important;
        }

        #greeting-store-targeting table {
          border-collapse: collapse !important;
        }

        #greeting-store-targeting thead {
          background: #fafafa !important;
          color: #6b7280 !important;
        }

        #greeting-store-targeting th,
        #greeting-store-targeting td {
          padding: 0.625rem 0.75rem !important;
        }

        #greeting-store-targeting tbody tr {
          transition: background-color 120ms ease;
        }

        #greeting-store-targeting tbody tr:has(input[type="checkbox"]:checked) {
          background: rgb(6 199 85 / 0.1) !important;
        }

        #greeting-store-targeting tbody tr:has(input[type="checkbox"]:checked):hover {
          background: rgb(6 199 85 / 0.15) !important;
        }

        #greeting-store-targeting input[type="checkbox"] {
          accent-color: #06c755;
        }

        /* Make the bulk action feel like the Rich Menu publish action. */
        #greeting-store-targeting button.bg-\[\#06c755\] {
          border: 1px solid #06c755 !important;
          background: rgb(6 199 85 / 0.1) !important;
          color: #06c755 !important;
          font-weight: 700 !important;
          box-shadow: none !important;
        }

        #greeting-store-targeting button.bg-\[\#06c755\]:hover {
          background: rgb(6 199 85 / 0.2) !important;
        }

        @media (max-width: 1024px) {
          #greeting-store-targeting > div:nth-child(2) > div:first-child input[type="search"] {
            width: 100%;
          }

          #greeting-store-targeting > div:nth-child(2) > div:first-child,
          #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) {
            align-items: stretch !important;
          }
        }
      `}</style>
    </>
  );
}
