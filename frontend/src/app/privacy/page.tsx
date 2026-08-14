import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | OPPO Retail TikTok Monitor",
  description:
    "Privacy Policy for OPPO Retail TikTok Monitor, outlining data collection, usage, storage, and user rights for authorized TikTok store accounts.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
      {/* Header Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#12151c]/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-xs text-white shadow-xs dark:bg-emerald-500">
              O
            </span>
            <div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                OPPO Retail TikTok Monitor
              </span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                {" "}
                · Internal Retail Operations
              </span>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Privacy Policy
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-10">
          {/* Document Title Header */}
          <div className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                OFFICIAL POLICY
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Effective: August 14, 2026
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Product:{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-200">
                OPPO Retail TikTok Monitor
              </strong>
            </p>
          </div>

          {/* Developer Review Summary Callout */}
          <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
              Overview &amp; Purpose Statement
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200/90">
              <strong>OPPO Retail TikTok Monitor</strong> is an internal enterprise retail operations
              dashboard used to monitor authorized TikTok store accounts. This Privacy Policy describes
              how we collect, use, store, and manage data obtained from connected TikTok accounts and
              how account operators can exercise control over their data.
            </p>
          </div>

          {/* Document Body */}
          <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                1. Information We Collect
              </h2>
              <p>
                When an authorized retail store account is connected to the Service, we collect only
                the data necessary to provide store monitoring, analytics, and operational dashboard
                functionality:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>TikTok account identifiers:</strong> Open ID, union ID, or internal platform
                  account identifiers.
                </li>
                <li>
                  <strong>TikTok profile information:</strong> Account username, display name, profile
                  avatar URL, and account bio/description.
                </li>
                <li>
                  <strong>Account metrics:</strong> Follower count, following count, total likes, and
                  video count.
                </li>
                <li>
                  <strong>Public video metadata &amp; performance metrics:</strong> Video title,
                  publish timestamp, video duration, video views, video likes, comments count, and
                  shares count.
                </li>
                <li>
                  <strong>Authorization &amp; technical data:</strong> Access tokens, refresh tokens,
                  scope grants, expiration timestamps, and API response metadata required to maintain
                  authenticated TikTok OAuth connections.
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                2. How We Collect Information
              </h2>
              <p>
                Information is collected strictly through authorized, official integration channels:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>TikTok Login Kit &amp; OAuth Flow:</strong> Information is collected only
                  after the TikTok account owner or authorized operator explicitly grants permissions
                  through the standard TikTok OAuth authorization dialogue.
                </li>
                <li>
                  <strong>Authorized TikTok APIs:</strong> Operational metrics and video statistics are
                  retrieved programmatically via official TikTok Developer APIs using the granted OAuth
                  tokens.
                </li>
                <li>
                  We do not collect information without explicit prior permission from the authorized
                  account operator.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                3. How We Use Information
              </h2>
              <p>
                Data collected through TikTok integrations is used exclusively for internal retail
                operations management:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Internal retail operations monitoring:</strong> Displaying centralized
                  store status, active channels, and health overviews for authorized retail operations
                  teams.
                </li>
                <li>
                  <strong>Store-level performance analysis:</strong> Tracking follower growth, reach,
                  and engagement rates across individual retail store branches.
                </li>
                <li>
                  <strong>Content activity monitoring:</strong> Evaluating store posting frequency,
                  video interaction levels, and popular store content.
                </li>
                <li>
                  <strong>Historical analytics &amp; reporting:</strong> Generating internal aggregate
                  reports and operational summaries for retail management review.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                4. Data Sharing
              </h2>
              <p>
                We do not monetize, sell, or share TikTok data with outside parties:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Data is not sold:</strong> We never sell, rent, lease, or commercially
                  distribute account or operational data to any third party.
                </li>
                <li>
                  <strong>No advertiser sharing:</strong> Data is not shared with third-party
                  advertisers, ad networks, or data brokers.
                </li>
                <li>
                  <strong>Authorized disclosures only:</strong> Data may only be disclosed where
                  strictly required for service operation, legal compliance, or authorized internal use
                  by designated personnel.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                5. Data Storage and Security
              </h2>
              <p>
                We implement reasonable technical and organizational security measures to safeguard all
                collected data:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Secure Token Storage:</strong> TikTok access tokens and refresh tokens are
                  stored securely on backend server infrastructure and are accessible only by authorized
                  backend services.
                </li>
                <li>
                  <strong>Token Protection:</strong> OAuth tokens and secret credentials are never exposed to frontend users, client-side web bundles, or public endpoints.
                </li>
                <li>
                  <strong>Access Controls:</strong> Access to backend data stores is restricted to
                  authenticated system administrators and operational backend routines.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                6. Data Retention
              </h2>
              <p>
                We retain information only for as long as reasonably necessary to fulfill operational
                and reporting purposes:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  Operational metrics and snapshots are retained during the active period of store
                  monitoring.
                </li>
                <li>
                  When an account is disconnected or the data is no longer required for business
                  reporting, associated tokens and data are deleted or anonymized.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                7. Account Disconnection and Data Deletion
              </h2>
              <p>
                Authorized account owners and operators retain full control over their account
                connections:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Account Disconnection:</strong> Authorized TikTok accounts can be
                  disconnected from the Service at any time via the dashboard management interface or
                  by revoking access in TikTok account permissions settings.
                </li>
                <li>
                  <strong>Data Deletion Requests:</strong> Account owners or authorized operators may
                  request the deletion of associated TikTok store data and cached metrics.
                </li>
                <li>
                  Privacy and data deletion requests can be submitted directly by emailing{" "}
                  <a
                    href="mailto:obsthailand@gmail.com"
                    className="font-medium text-emerald-700 underline dark:text-emerald-400"
                  >
                    obsthailand@gmail.com
                  </a>
                  . Requests are processed in a timely manner upon verification of account ownership.
                </li>
              </ul>
            </section>

            {/* Section 8 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                8. Third-Party Services
              </h2>
              <p>
                The Service integrates with TikTok through official TikTok APIs. Please note that
                TikTok&apos;s own collection, handling, and processing of personal information is
                governed by TikTok&apos;s Privacy Policy and terms of service. Users are encouraged to
                review TikTok&apos;s privacy policies to understand their data practices on the
                underlying platform.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                9. User Rights and Requests
              </h2>
              <p>
                Authorized operators and store representatives may submit requests concerning their
                connected store data, including:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>Requesting access to the data stored in connection with their store account.</li>
                <li>Requesting correction or updating of inaccurate account mapping details.</li>
                <li>Requesting deletion of stored metrics and authorization tokens.</li>
                <li>
                  General privacy questions or concerns regarding the Service can be directed to{" "}
                  <strong className="text-slate-800 dark:text-slate-200">obsthailand@gmail.com</strong>.
                </li>
              </ul>
            </section>

            {/* Section 10 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                10. Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time to reflect operational, technical,
                or regulatory updates. Any changes will be posted directly on this page with an updated
                effective date. Continued use of the Service after changes are published constitutes
                acknowledgment of the updated Privacy Policy.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                11. Contact Information
              </h2>
              <p>
                For any privacy questions, access requests, or data deletion inquiries, please reach
                out to the operations engineering team:
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Application</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      OPPO Retail TikTok Monitor
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Department</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      OPPO Retail Operations &amp; Engineering
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      obsthailand@gmail.com
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Website</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      https://lineoppo.click
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </article>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} OPPO Retail Operations. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
