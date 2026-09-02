"use client";

import { LanguageControl, pickLanguageText, useAppLanguage, type AppLanguage } from "../language";

export type PolicyBullet = {
  label?: string;
  text: string;
};

export type PolicyCard = {
  title: string;
  text: string;
};

export type PolicySection = {
  title: string;
  paragraphs?: string[];
  bullets?: PolicyBullet[];
  cards?: PolicyCard[];
};

export type PolicyContent = {
  productName: string;
  organization: string;
  internalLabel: string;
  documentLabel: string;
  officialPolicyLabel: string;
  effectiveLabel: string;
  effectiveDate: string;
  productLabel: string;
  overviewTitle: string;
  overviewText: string;
  sections: PolicySection[];
  contact?: {
    applicationLabel: string;
    departmentLabel: string;
    department: string;
    emailLabel: string;
    email: string;
    domainLabel: string;
    domain: string;
  };
  rightsText: string;
};

function renderBullet(bullet: PolicyBullet, index: number) {
  return (
    <li key={`${bullet.label ?? "bullet"}-${index}`}>
      {bullet.label ? <strong>{bullet.label}: </strong> : null}
      {bullet.text}
    </li>
  );
}

export function PolicyDocument({ content }: { content: Record<AppLanguage, PolicyContent> }) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, content);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#12151c]/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white shadow-xs dark:bg-emerald-500">O</span>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.productName}</span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">· {t.internalLabel}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:inline-flex">{t.documentLabel}</span>
            <LanguageControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-10">
          <div className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">{t.officialPolicyLabel}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.effectiveLabel}: {t.effectiveDate}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">{t.documentLabel}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.productLabel}: <strong className="font-semibold text-slate-800 dark:text-slate-200">{t.productName}</strong></p>
          </div>

          <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">{t.overviewTitle}</h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200/90">{t.overviewText}</p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t.sections.map((section, sectionIndex) => (
              <section key={section.title} className={`space-y-3 ${sectionIndex > 0 ? "border-t border-slate-100 pt-6 dark:border-slate-800/80" : ""}`}>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{section.title}</h2>
                {section.paragraphs?.map((paragraph, index) => <p key={`${section.title}-p-${index}`}>{paragraph}</p>)}
                {section.bullets?.length ? (
                  <ul className="list-inside list-disc space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">{section.bullets.map(renderBullet)}</ul>
                ) : null}
                {section.cards?.length ? (
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2">
                    {section.cards.map((card) => (
                      <div key={card.title} className="space-y-1">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{card.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{card.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}

            {t.contact ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div><dt className="text-slate-500 dark:text-slate-400">{t.contact.applicationLabel}</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{t.productName}</dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">{t.contact.departmentLabel}</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{t.contact.department}</dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">{t.contact.emailLabel}</dt><dd><a href={`mailto:${t.contact.email}`} className="font-semibold text-emerald-700 underline dark:text-emerald-400">{t.contact.email}</a></dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">{t.contact.domainLabel}</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{t.contact.domain}</dd></div>
                </dl>
              </div>
            ) : null}
          </div>
        </article>

        <footer className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} {t.organization}. {t.rightsText}</p>
        </footer>
      </main>
    </div>
  );
}
