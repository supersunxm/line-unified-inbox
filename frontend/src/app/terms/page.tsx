import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | OPPO Retail TikTok Monitor",
  description:
    "Terms of Service for OPPO Retail TikTok Monitor, an internal enterprise retail operations dashboard used to monitor authorized TikTok store accounts.",
};

export default function TermsOfServicePage() {
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
            Terms of Service
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
              Terms of Service
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
              dashboard developed for authorized OPPO retail operations personnel and store managers.
              The application provides centralized visibility and operational metrics monitoring across
              authorized official TikTok retail store accounts.
            </p>
          </div>

          {/* Document Body */}
          <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                1. Purpose of Service
              </h2>
              <p>
                The <strong>OPPO Retail TikTok Monitor</strong> (&quot;the Service&quot;) is an internal
                operational management and analytics tool developed exclusively for OPPO retail
                operations teams, regional supervisors, and authorized store administrators.
              </p>
              <p>
                The primary purpose of the Service is to enable authorized personnel to monitor
                operational performance metrics, track follower growth trends, analyze engagement
                insights, and oversee customer inquiry response workflows across connected official
                retail store TikTok accounts in a unified operational interface.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                2. Authorized Use
              </h2>
              <p>
                Access to the Service is strictly restricted to authorized enterprise personnel who have
                been provisioned with authenticated company accounts and verified role-based access
                permissions.
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  Users may use the Service only for legitimate internal retail store operations,
                  business reporting, and official store performance monitoring.
                </li>
                <li>
                  Sharing credentials, providing third-party access, automated bulk scraping, or
                  attempting to circumvent security controls is strictly prohibited.
                </li>
                <li>
                  Any unauthorized access or misuse of the Service will result in immediate revocation
                  of privileges and may be subject to enterprise disciplinary and legal measures.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                3. TikTok Account Authorization
              </h2>
              <p>
                The Service integrates with TikTok through official TikTok Developer APIs and standard
                OAuth 2.0 authorization protocols.
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Explicit Consent:</strong> Only authorized store account administrators may
                  connect official TikTok store accounts to the Service by completing the official
                  TikTok OAuth authorization flow.
                </li>
                <li>
                  <strong>Scoped Access:</strong> The Service requests only the minimal API permissions
                  necessary to retrieve operational metrics (such as account profile information,
                  follower analytics, and interaction volume statistics).
                </li>
                <li>
                  <strong>Revocation:</strong> Store administrators can disconnect their accounts or
                  revoke API authorization at any time via TikTok account settings or within the Service
                  management console.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                4. Data Usage
              </h2>
              <p>
                We are committed to handling all operational data securely, transparently, and in
                strict compliance with platform developer policies and data privacy regulations:
              </p>
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2">
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Internal Operations Only
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Data accessed through the TikTok API is used solely for internal operational
                    dashboards and retail performance analytics.
                  </p>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    No Sale or Third-Party Transfer
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    We do not sell, rent, monetize, or transfer TikTok user or store data to external
                    third-party advertisers or data brokers.
                  </p>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Encryption in Transit &amp; at Rest
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    All network communication is enforced via TLS 1.3/HTTPS. OAuth tokens and sensitive
                    secrets are encrypted at rest with industry-standard cryptographic algorithms.
                  </p>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Data Retention &amp; Deletion
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Data is retained only as long as necessary for active retail monitoring. Upon account
                    disconnection, associated tokens and cached metrics are purged in accordance with data
                    retention policies.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                5. User Responsibilities
              </h2>
              <p>Users granted access to the Service agree to:</p>
              <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                <li>Maintain the confidentiality and security of their authentication credentials.</li>
                <li>
                  Promptly report any suspected security breaches or unauthorized activity to the IT
                  security team.
                </li>
                <li>
                  Adhere to all applicable company policies, local privacy laws, and TikTok&apos;s Terms of
                  Service and Developer Policies.
                </li>
                <li>
                  Use data viewed within the dashboard solely for authorized company business purposes.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                6. Service Availability
              </h2>
              <p>
                We strive to maintain high availability and reliability for the Service. However, the
                Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
                Operational availability may occasionally be affected by scheduled maintenance, network
                upgrades, or external third-party API service interruptions.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                7. Limitation of Liability
              </h2>
              <p>
                To the fullest extent permitted by applicable law, OPPO, its affiliates, developers, and
                service providers shall not be liable for any indirect, incidental, consequential,
                special, or punitive damages resulting from the use of, or inability to use, the
                Service or any data provided through external platform APIs.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                8. Changes to These Terms
              </h2>
              <p>
                We reserve the right to modify or update these Terms of Service as necessary to reflect
                changes in operational practices, technical capabilities, platform policies, or legal
                requirements. Any updates will be published on this page with a revised &quot;Last
                Updated&quot; timestamp.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                9. Contact
              </h2>
              <p>
                For questions regarding these Terms of Service, developer integration inquiries, or
                technical support, please contact the operations engineering team:
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
                    <dt className="text-slate-500 dark:text-slate-400">Support Email</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      obsthailand@gmail.com
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Domain</dt>
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
