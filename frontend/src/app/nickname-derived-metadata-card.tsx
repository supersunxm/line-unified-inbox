import type { ApiNicknameDerivedMetadata } from "@/types/api";

type Language = "th" | "en" | "zh";

const copy: Record<Language, { title: string; empty: string; observed: string; product: string; customerType: string; payment: string; finance: string; service: string; source: string; period: string; eventDate: string }> = {
  th: {
    title: "ข้อมูลจากชื่อเล่น (Nickname-derived)", empty: "ยังไม่มีข้อมูลที่แมปจากชื่อเล่น", observed: "สังเกตชื่อเล่นเมื่อ",
    product: "สินค้า", customerType: "ประเภทลูกค้า", payment: "การชำระ", finance: "สินเชื่อ", service: "บริการ",
    source: "แหล่งที่มา", period: "ช่วงเวลา", eventDate: "วันที่",
  },
  en: {
    title: "Nickname-derived", empty: "No mapped nickname metadata", observed: "Nickname observed",
    product: "Product", customerType: "Customer type", payment: "Payment", finance: "Finance provider",
    service: "Service", source: "Source", period: "Period", eventDate: "Event date",
  },
  zh: {
    title: "昵称解析信息", empty: "没有已映射的昵称信息", observed: "昵称观测时间",
    product: "产品", customerType: "客户类型", payment: "付款方式", finance: "金融机构",
    service: "服务", source: "来源", period: "期间", eventDate: "日期",
  },
};

function readableValue(value: string, language: Language): string {
  if (language === "th") {
    if (value === "ONLINE") return "ออนไลน์";
    if (value === "CASH") return "เงินสด";
    if (value === "INSTALLMENT") return "ผ่อน";
    if (value === "SG_FINANCE") return "SG Finance";
    if (value === "UFUND") return "Ufund";
    if (value === "FILM_INSTALLATION") return "ติดฟิล์ม";
  }
  if (value === "ONLINE") return "Online";
  if (value === "CASH") return "Cash";
  if (value === "INSTALLMENT") return "Installment";
  if (value === "SG_FINANCE") return "SG Finance";
  if (value === "UFUND") return "Ufund";
  if (value === "FILM_INSTALLATION") return "Film installation";
  return value;
}

function formatDate(year: number, month: number, day: number, language: Language): string {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function formatPeriod(year: number, month: number, language: Language): string {
  return new Intl.DateTimeFormat(language, { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

export function NicknameDerivedMetadataCard({ metadata, language }: { metadata: ApiNicknameDerivedMetadata | null; language: Language }) {
  const labels = copy[language];
  const fields = metadata ? [
    metadata.product ? [labels.product, metadata.product.name] as const : null,
    metadata.customerType ? [labels.customerType, readableValue(metadata.customerType, language)] as const : null,
    metadata.paymentMethod ? [labels.payment, readableValue(metadata.paymentMethod, language)] as const : null,
    metadata.financeProvider ? [labels.finance, readableValue(metadata.financeProvider, language)] as const : null,
    metadata.service ? [labels.service, readableValue(metadata.service, language)] as const : null,
    metadata.source ? [labels.source, metadata.source] as const : null,
    metadata.period ? [labels.period, formatPeriod(metadata.period.year, metadata.period.month, language)] as const : null,
    metadata.eventDate ? [labels.eventDate, formatDate(Number(metadata.eventDate.slice(0, 4)), Number(metadata.eventDate.slice(5, 7)), Number(metadata.eventDate.slice(8, 10)), language)] as const : null,
  ].filter((field): field is readonly [string, string] => field !== null) : [];

  return (
    <section data-nickname-derived-metadata className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 shadow-[var(--app-shadow-card)]">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">{labels.title}</h3>
      {fields.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--app-text-tertiary)]">{labels.empty}</p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-2.5">
          {fields.map(([label, value]) => (
            <div key={label} data-nickname-derived-field={label}>
              <dt className="text-xs text-[var(--app-text-tertiary)]">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--app-text-primary)]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {metadata && <p className="mt-3 text-[10px] text-[var(--app-text-tertiary)]">{labels.observed}: {new Date(metadata.observedAt).toLocaleString(language)}</p>}
    </section>
  );
}
