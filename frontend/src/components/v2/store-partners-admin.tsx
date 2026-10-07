"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { PageHeader } from "@/components/shell/page-header";
import { SearchInput, SectionCard, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from "@/components/ui";
import { useAuthUserSnapshot } from "@/lib/auth-user-store";
import { sortPartnerNames, UNMATCHED_PARTNER, type StorePartnerRow } from "@/lib/v2/partners";
import { fetchStorePartners, useV2Month } from "./v2-month-data";
import { SourceNotice } from "./v2-ui";
import { v2Text } from "@/lib/v2/v2-translations";

type Change = { id: string; storeId: string; previousPartner: string | null; partnerName: string | null; source: string; actorName: string; reason: string | null; changedAt: string };

const dateTime = (value: string, language: "th" | "en" | "zh") => new Date(value).toLocaleString(`${languageLocale(language)}-u-ca-gregory`, { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

async function savePartner(storeId: string, partner: string | null, reason: string): Promise<void> {
  const response = await fetch(`/api-backend/v2/store-partners/${encodeURIComponent(storeId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner, reason: reason || undefined }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message ?? `บันทึกไม่สำเร็จ (${response.status})`);
  }
}

async function fetchChanges(): Promise<Change[]> {
  const response = await fetch("/api-backend/v2/store-partners/changes?limit=50", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดประวัติไม่สำเร็จ (${response.status})`);
  return ((await response.json()) as { changes: Change[] }).changes;
}

/** "Partner ของสาขา": Store ID → partner, editable by ADMIN; every change records actor and time. */
export function StorePartnersAdmin() {
  const { language } = useAppLanguage();
  const t = useMemo(() => v2Text(language), [language]);
  const { user } = useAuthUserSnapshot();
  const monthData = useV2Month();
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<StorePartnerRow[] | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnset, setOnlyUnset] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, history] = await Promise.all([fetchStorePartners(), isAdmin ? fetchChanges() : Promise.resolve([])]);
      setRows(list);
      setChanges(history);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("unableToLoadData"));
    }
  }, [isAdmin, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const partners = useMemo(() => sortPartnerNames((rows ?? []).map((row) => row.partner).filter((value): value is string => Boolean(value))), [rows]);
  const unsetCount = (rows ?? []).filter((row) => !row.partner).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    return (rows ?? []).filter((row) => (!onlyUnset || !row.partner) && (!query || `${row.storeId ?? ""} ${row.storeName} ${row.partner ?? ""}`.toLocaleLowerCase("th").includes(query)));
  }, [onlyUnset, rows, search]);

  const save = async (row: StorePartnerRow) => {
    if (!row.storeId) return;
    const value = (drafts[row.storeUuid] ?? row.partner ?? "").trim();
    setSaving(row.storeUuid);
    setMessage(null);
    try {
      await savePartner(row.storeId, value || null, "");
      setDrafts((previous) => { const next = { ...previous }; delete next[row.storeUuid]; return next; });
      setMessage(t("savedPartner", { store: row.storeName, partner: value || t("noPartnerRank") }));
      await load();
      monthData.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t("unableToSave"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader title={t("partnerMappingTitle")} description={t("partnerMappingDescription")} />
      <div className="space-y-4">
        {error && <SourceNotice>{error}</SourceNotice>}
        {!isAdmin && <SourceNotice>{t("readOnlyAdmin")}</SourceNotice>}
        {message && <p role="status" className="text-sm text-[var(--app-text-secondary)]">{message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--app-text-secondary)]">
            <input type="checkbox" data-v2-partner-unset-filter checked={onlyUnset} onChange={(event) => setOnlyUnset(event.target.checked)} />
            {t("onlyUnsetPartners", { count: unsetCount })}
          </label>
          <div className="ml-auto w-80"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder={t("partnerAdminSearch")} /></div>
        </div>
        <datalist id="v2-partner-names">{partners.map((name) => <option key={name} value={name} />)}</datalist>
        <SectionCard title={t("storePartnerHeading")} meta={rows ? t("partnerAdminCount", { visible: visible.length, total: rows.length, partners: partners.length }) : t("loadingEllipsis")} bodyPadding="none">
          <div className="overflow-x-auto">
            <Table data-v2-partner-admin>
              <TableHeader>
                <tr>
                  <TableHead scope="col">{t("storeId")}</TableHead>
                  <TableHead scope="col">{t("storeName")}</TableHead>
                  <TableHead scope="col">{t("partnerFilter")}</TableHead>
                  <TableHead scope="col">{t("lastEdited")}</TableHead>
                  {isAdmin && <TableHead scope="col"><span className="sr-only">{t("save")}</span></TableHead>}
                </tr>
              </TableHeader>
              <TableBody>
                {!rows ? null : visible.length === 0 ? (
                  <TableEmptyState colSpan={isAdmin ? 5 : 4} message={t("noStoresForFilter")} />
                ) : visible.map((row) => {
                  const draft = drafts[row.storeUuid];
                  const dirty = draft !== undefined && draft.trim() !== (row.partner ?? "");
                  return (
                    <TableRow key={row.storeUuid} data-v2-partner-row={row.storeId ?? row.storeUuid}>
                      <TableCell numeric>{row.storeId ?? <span title={t("storeNoIdTitle")} className="text-[var(--app-text-secondary)]">{t("noStoreId")}</span>}</TableCell>
                      <th scope="row" className="px-4 py-3 text-left text-xs font-medium">{row.storeName}</th>
                      <TableCell>
                        {isAdmin && row.storeId ? (
                          <input
                            aria-label={t("partnerEditLabel", { store: row.storeName })}
                            list="v2-partner-names"
                            value={draft ?? row.partner ?? ""}
                            placeholder={UNMATCHED_PARTNER}
                            onChange={(event) => setDrafts((previous) => ({ ...previous, [row.storeUuid]: event.target.value }))}
                            className="h-8 w-48 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-[var(--app-text-primary)]"
                          />
                        ) : (
                          <span className={row.partner ? "" : "text-[var(--app-text-secondary)]"}>{row.partner ?? UNMATCHED_PARTNER}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[var(--app-text-secondary)]">{row.updatedAt ? `${row.updatedByName ?? "—"} · ${dateTime(row.updatedAt, language)}` : "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {/* Shown only for an unsaved change, so the table is not a column of disabled buttons. */}
                          {row.storeId && dirty && (
                            <button type="button" aria-busy={saving === row.storeUuid} onClick={() => { if (saving !== row.storeUuid) void save(row); }} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1 text-xs font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] dark:text-[var(--app-success)]">
                              {saving === row.storeUuid ? t("saving") : t("save")}
                            </button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        {isAdmin && (
          <SectionCard title={t("editHistory")} meta={t("latestChanges")} bodyPadding="none">
            <div className="overflow-x-auto">
              <Table data-v2-partner-changes>
                <TableHeader>
                  <tr>
                    <TableHead scope="col">{t("time")}</TableHead>
                    <TableHead scope="col">{t("storeId")}</TableHead>
                    <TableHead scope="col">{t("previousToNew")}</TableHead>
                    <TableHead scope="col">{t("changedBy")}</TableHead>
                    <TableHead scope="col">{t("source")}</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {changes.length === 0 ? <TableEmptyState colSpan={5} message={t("noChanges")} /> : changes.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell>{dateTime(change.changedAt, language)}</TableCell>
                      <TableCell numeric>{change.storeId}</TableCell>
                      <TableCell>{change.previousPartner ?? UNMATCHED_PARTNER} → {change.partnerName ?? UNMATCHED_PARTNER}</TableCell>
                      <TableCell>{change.actorName}</TableCell>
                      <TableCell className="text-[var(--app-text-secondary)]">{change.source === "SEED" ? t("seededFromStoreName") : t("administrator")}{change.reason ? ` · ${change.reason}` : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
