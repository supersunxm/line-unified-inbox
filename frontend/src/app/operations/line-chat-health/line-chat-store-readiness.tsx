"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type { LineChatOperationsHealth } from "@/lib/api";
import {
  buildStoreRows,
  DEFAULT_STORE_CONTROLS,
  filterStoreRows,
  STORE_FILTERS,
  storeFilterCounts,
} from "./line-chat-store-readiness-model";
import { LineChatStoreDetails } from "./line-chat-store-details";

export function LineChatStoreReadiness({
  report,
  onSession,
  onMapping,
}: {
  report: LineChatOperationsHealth;
  onSession: (key: string) => void;
  onMapping: () => void;
}) {
  const [controls, setControls] = useState(DEFAULT_STORE_CONTROLS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => buildStoreRows(report), [report]);
  const counts = storeFilterCounts(rows);
  const visible = filterStoreRows(rows, controls);
  const selected = rows.find(
    (row) => row.store.lineOfficialAccountId === selectedId,
  );
  const cell = "!px-2 lg:!px-3 align-top break-words";
  return (
    <Card id="store-readiness" noPadding className="min-w-0 shadow-none">
      <CardContent className="space-y-4 p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="store-readiness-title" className="text-lg font-semibold">
              Store Readiness
            </h2>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
              Connection readiness, setup needs, and mapping coverage by store.
            </p>
          </div>
          <p className="text-xs text-[var(--app-text-tertiary)]">
            Pilot eligible:{" "}
            {report.fleetReadiness.summary.currentlyPilotEligible}{" "}
            {report.fleetReadiness.summary.currentlyPilotEligible === 1
              ? "store"
              : "stores"}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter stores by status"
        >
          {STORE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={controls.status === filter.value ? "secondary" : "ghost"}
              aria-pressed={controls.status === filter.value}
              onClick={() =>
                setControls((current) => ({ ...current, status: filter.value }))
              }
            >
              {filter.label}{" "}
              <span className="ml-1 text-[var(--app-text-tertiary)]">
                {counts[filter.value]}
              </span>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="min-w-0 flex-1 basis-56">
            <span className="sr-only">Search store name or store code</span>
            <input
              type="search"
              value={controls.search}
              onChange={(event) =>
                setControls((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search store name / store code"
              className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[var(--app-accent)]/30"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={controls.actionableOnly}
              onChange={(event) =>
                setControls((current) => ({
                  ...current,
                  actionableOnly: event.target.checked,
                }))
              }
              className="accent-[var(--app-accent)]"
            />
            Actionable only
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={controls.pilotOnly}
              onChange={(event) =>
                setControls((current) => ({
                  ...current,
                  pilotOnly: event.target.checked,
                }))
              }
              className="accent-[var(--app-accent)]"
            />
            Pilot only
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--app-text-tertiary)]">
          <p aria-live="polite">
            Showing {visible.length} of {rows.length} stores · Filter counts
            cover all stores
          </p>
          <p className="hidden lg:block">
            Audit:{" "}
            {new Date(report.fleetReadiness.generatedAt).toLocaleString()}
          </p>
        </div>
        <TableContainer className="min-w-0 shadow-none">
          <Table
            aria-labelledby="store-readiness-title"
            className="w-full table-fixed"
          >
            <colgroup>
              <col className="w-[20%] lg:w-[21%]" />
              <col className="w-[20%] lg:w-[18%]" />
              <col className="w-[24%] lg:w-[27%]" />
              <col className="w-[18%] lg:w-[20%]" />
              <col className="w-[18%] lg:w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className={cell}>Store</TableHead>
                <TableHead className={cell}>Status</TableHead>
                <TableHead className={cell}>Issue / Next action</TableHead>
                <TableHead className={cell}>Mapping coverage</TableHead>
                <TableHead className={cell}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.store.lineOfficialAccountId}>
                  <TableCell className={cell}>
                    <p className="font-medium leading-relaxed">
                      {row.store.storeName}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--app-text-tertiary)]">
                      {row.store.storeCode || "No store code"}
                    </p>
                  </TableCell>
                  <TableCell className={cell}>
                    <Badge
                      variant={row.health.tone}
                      size="sm"
                      dot
                      className="max-w-full leading-relaxed"
                      title={row.health.reason}
                    >
                      {row.health.label}
                    </Badge>
                  </TableCell>
                  <TableCell className={cell}>
                    <p className="leading-relaxed text-[var(--app-text-secondary)]">
                      {row.health.reason}
                    </p>
                    {row.actionable && (
                      <p className="mt-1 hidden leading-relaxed text-[11px] text-[var(--app-text-tertiary)] lg:block">
                        {row.health.recommendedAction}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className={cell}>
                    <div className="flex flex-wrap justify-between gap-1 font-tabular">
                      <span>
                        {row.store.mappedConversations} /{" "}
                        {row.store.totalConversations}
                      </span>
                      <span className="text-[var(--app-text-secondary)]">
                        {row.coverage.percent !== null
                          ? `${row.coverage.percent}%`
                          : "—"}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Mapping coverage for ${row.store.storeName}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        row.coverage.percent === null
                          ? undefined
                          : row.coverage.progress
                      }
                      aria-valuetext={
                        row.coverage.percent === null
                          ? "Coverage unavailable"
                          : `${row.coverage.percent}% mapped`
                      }
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"
                    >
                      <div
                        className={`h-full rounded-full ${row.coverage.percent === null ? "bg-[var(--app-neutral)]" : row.coverage.progress === 100 ? "bg-[var(--app-success)]" : "bg-[var(--app-warning)]"}`}
                        style={{ width: `${row.coverage.progress}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className={cell}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-w-full !px-2 text-[11px] [&>span]:whitespace-normal [&>span]:overflow-visible [&>span]:text-clip"
                      aria-label={`${row.action}: ${row.store.storeName}`}
                      onClick={() =>
                        setSelectedId(row.store.lineOfficialAccountId)
                      }
                    >
                      {row.action}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!visible.length && (
                <TableRow>
                  <TableCell colSpan={5} className="space-y-2 py-8 text-center">
                    <p>
                      {rows.length
                        ? "No stores match these filters."
                        : "No stores reported in the current audit."}
                    </p>
                    {rows.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setControls(DEFAULT_STORE_CONTROLS)}
                      >
                        Clear filters
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {selected && (
          <LineChatStoreDetails
            key={selected.store.lineOfficialAccountId}
            row={selected}
            auditGeneratedAt={report.fleetReadiness.generatedAt}
            onClose={() => setSelectedId(null)}
            onSession={onSession}
            onMapping={onMapping}
          />
        )}
      </CardContent>
    </Card>
  );
}
