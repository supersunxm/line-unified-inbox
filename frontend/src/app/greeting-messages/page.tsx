"use client";

import { AuthorizedWorkspace } from "../authorized-workspace";

export default function GreetingMessagesPage() {
  return (
    <>
      <AuthorizedWorkspace section="greeting-messages" />
      <style jsx global>{`
        /* Greeting target stores should visually follow the Rich Menu target-store block. */
        #greeting-store-targeting {
          border-radius: 0.5rem !important;
          border-color: #e5e7eb !important;
          padding: 1.25rem !important;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03) !important;
          gap: 1rem !important;
        }

        /* Header: same compact title + inline counters used by Rich Menu. */
        #greeting-store-targeting > div:first-child {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.75rem !important;
          padding-bottom: 0.75rem !important;
          border-bottom: 1px solid #f3f4f6 !important;
        }

        #greeting-store-targeting > div:first-child h2 {
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
          color: #111827 !important;
        }

        #greeting-store-targeting > div:first-child > div:first-child > div {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 0 !important;
          margin-top: 0.125rem !important;
          font-size: 0.75rem !important;
          color: #6b7280 !important;
        }

        /* Rich Menu summary shows Ready / Blocked / Selected, not Assigned. */
        #greeting-store-targeting > div:first-child > div:first-child > div > span:first-child {
          display: none !important;
        }

        #greeting-store-targeting > div:first-child > div:first-child > div > span {
          background: transparent !important;
          border-radius: 0 !important;
          padding: 0 !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
        }

        #greeting-store-targeting > div:first-child > div:first-child > div > span:nth-child(2) {
          color: #059669 !important;
        }

        #greeting-store-targeting > div:first-child > div:first-child > div > span:nth-child(3) {
          color: #e11d48 !important;
        }

        #greeting-store-targeting > div:first-child > div:first-child > div > span:nth-child(4) {
          color: #374151 !important;
        }

        #greeting-store-targeting > div:first-child > div:first-child > div > span:nth-child(2)::after,
        #greeting-store-targeting > div:first-child > div:first-child > div > span:nth-child(3)::after {
          content: " · ";
          color: #9ca3af;
          white-space: pre;
        }

        /* Keep only the assignment action in the section header. */
        #greeting-store-targeting > div:first-child > div:last-child > span,
        #greeting-store-targeting > div:first-child > div:last-child > button:not(:last-child) {
          display: none !important;
        }

        #greeting-store-targeting > div:first-child > div:last-child > button:last-child {
          border: 1px solid #06c755 !important;
          border-radius: 0.25rem !important;
          background: rgb(6 199 85 / 0.1) !important;
          color: #06c755 !important;
          padding: 0.375rem 0.875rem !important;
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          box-shadow: none !important;
        }

        #greeting-store-targeting > div:first-child > div:last-child > button:last-child:hover {
          background: rgb(6 199 85 / 0.2) !important;
        }

        /* Remove the nested card look: Rich Menu has one section card and one table border. */
        #greeting-store-targeting > div:nth-child(2) {
          overflow: visible !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        /* Toolbar: search + All/Ready/Blocked on the left, matching Rich Menu. */
        #greeting-store-targeting > div:nth-child(2) > div:first-child {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 0.5rem !important;
          padding: 0 !important;
          margin-bottom: 0.75rem !important;
          border: 0 !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child input[type="search"] {
          width: 15rem !important;
          height: 2rem !important;
          border-color: #d1d5db !important;
          border-radius: 0.25rem !important;
          padding-inline: 0.625rem !important;
          background: #fff !important;
        }

        /* Rich Menu doesn't show a province dropdown in this toolbar. */
        #greeting-store-targeting > div:nth-child(2) > div:first-child select {
          display: none !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child > div:nth-last-child(2) {
          display: inline-flex !important;
          height: 2rem !important;
          overflow: visible !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.25rem !important;
          padding: 0.125rem !important;
          background: #fafafa !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child > div:nth-last-child(2) button {
          height: 1.625rem !important;
          border-radius: 0.25rem !important;
          padding-inline: 0.75rem !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:first-child > div:last-child {
          display: none !important;
        }

        /* Selection controls: exactly the compact Rich Menu command row. */
        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 0.75rem !important;
          min-height: 2rem !important;
          margin-top: -2.75rem !important;
          margin-bottom: 0.75rem !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) > div {
          display: flex !important;
          align-items: center !important;
          gap: 0.75rem !important;
          margin-left: auto !important;
        }

        /* Hide "select filtered ready"; Rich Menu only has Select all ready + Clear. */
        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) button:first-of-type {
          display: none !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) button {
          color: #06c755 !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
        }

        #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) button:last-child {
          color: #6b7280 !important;
          font-weight: 500 !important;
        }

        /* Table shell and typography copied from Rich Menu targeting. */
        #greeting-store-targeting > div:nth-child(2) > div:nth-child(3) {
          max-height: none !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.25rem !important;
        }

        #greeting-store-targeting table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 0.75rem !important;
        }

        #greeting-store-targeting thead {
          position: static !important;
          background: #fafafa !important;
          color: #6b7280 !important;
          font-weight: 600 !important;
        }

        #greeting-store-targeting th,
        #greeting-store-targeting td {
          padding: 0.625rem 0.75rem !important;
          border-color: #f3f4f6 !important;
        }

        /* Make Store ID visually its own first sub-column, like Rich Menu. */
        #greeting-store-targeting th:nth-child(2),
        #greeting-store-targeting td:nth-child(2) {
          min-width: 22rem !important;
        }

        #greeting-store-targeting td:nth-child(2) {
          display: grid !important;
          grid-template-columns: 4.5rem minmax(12rem, 1fr) !important;
          align-items: center !important;
          column-gap: 0.75rem !important;
        }

        #greeting-store-targeting td:nth-child(2) > span {
          grid-column: 1 !important;
          grid-row: 1 !important;
          margin-left: 0 !important;
          color: #6b7280 !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 0.75rem !important;
        }

        #greeting-store-targeting th:nth-child(2) {
          display: grid !important;
          grid-template-columns: 4.5rem minmax(12rem, 1fr) !important;
          column-gap: 0.75rem !important;
        }

        #greeting-store-targeting th:nth-child(2)::before {
          content: "รหัสร้าน";
          grid-column: 1;
          grid-row: 1;
        }

        #greeting-store-targeting tbody tr {
          transition: background-color 120ms ease !important;
        }

        #greeting-store-targeting tbody tr:hover {
          background: #f9fafb !important;
        }

        #greeting-store-targeting tbody tr:has(input[type="checkbox"]:checked) {
          background: rgb(6 199 85 / 0.1) !important;
        }

        #greeting-store-targeting tbody tr:has(input[type="checkbox"]:checked):hover {
          background: rgb(6 199 85 / 0.15) !important;
        }

        #greeting-store-targeting input[type="checkbox"] {
          accent-color: #06c755 !important;
        }

        /* Rich Menu uses text + dot for readiness rather than a filled pill. */
        #greeting-store-targeting td:nth-child(5) > span {
          padding: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          font-weight: 600 !important;
        }

        #greeting-store-targeting td:nth-child(5) > span::before {
          content: "● ";
          font-size: 0.625rem;
        }

        #greeting-store-targeting td:nth-child(5) > span.bg-emerald-100 {
          color: #059669 !important;
        }

        #greeting-store-targeting td:nth-child(5) > span.bg-red-100 {
          color: #e11d48 !important;
        }

        /* Pagination remains for usability because Greeting currently pages server data in groups of 25. */
        #greeting-store-targeting > div:nth-child(2) > div:last-child {
          border-top: 1px solid #e5e7eb !important;
          padding: 0.75rem 0 !important;
          margin-top: 0.25rem !important;
        }

        @media (max-width: 1024px) {
          #greeting-store-targeting > div:nth-child(2) > div:first-child input[type="search"] {
            width: 100% !important;
          }

          #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) {
            margin-top: 0 !important;
            justify-content: flex-start !important;
          }

          #greeting-store-targeting > div:nth-child(2) > div:nth-child(2) > div {
            margin-left: 0 !important;
            flex-wrap: wrap !important;
          }
        }
      `}</style>
    </>
  );
}
