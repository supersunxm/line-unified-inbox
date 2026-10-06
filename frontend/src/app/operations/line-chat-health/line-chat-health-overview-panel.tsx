"use client";

import { Badge, Button, Card, CardContent } from "@/components/ui";
import type { buildLineChatOverview } from "./line-chat-health-overview";

type Overview = ReturnType<typeof buildLineChatOverview>;
export function LineChatHealthOverviewPanel({
  overview,
  onMapping,
  onSession,
}: {
  overview: Overview;
  onMapping: () => void;
  onSession: (key?: string) => void;
}) {
  return (
    <>
      <section aria-labelledby="system-status-title" className="space-y-3">
        <h2 id="system-status-title" className="text-lg font-semibold">
          System Status
        </h2>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {overview.cards.map((card) => (
            <Card noPadding key={card.title} className="min-w-0">
              <CardContent className="space-y-3 p-4">
                <h3 className="text-sm font-medium text-[var(--app-text-secondary)]">
                  {card.title}
                </h3>
                <p
                  className={`text-lg font-semibold ${card.health.tone === "success" ? "text-[var(--app-success)]" : card.health.tone === "warning" ? "text-[var(--app-warning)]" : card.health.tone === "danger" ? "text-[var(--app-danger)]" : "text-[var(--app-text-secondary)]"}`}
                  title={`${card.health.reason} ${card.health.recommendedAction}`}
                >
                  {card.value}
                </p>
                <div className="space-y-1 text-xs leading-relaxed text-[var(--app-text-secondary)]">
                  {card.supporting.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="attention-title" className="space-y-3">
        <h2 id="attention-title" className="text-lg font-semibold">
          Attention Needed
        </h2>
        {overview.attention.length ? (
          <Card noPadding>
            <CardContent className="space-y-0 divide-y divide-[var(--app-border)] px-4">
              {overview.attention.map((item) => (
                <div
                  key={`${item.target}-${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{item.title}</h3>
                      <Badge variant={item.health.tone} dot>
                        {item.health.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--app-text-secondary)]">
                      {item.health.reason} {item.health.recommendedAction}
                    </p>
                  </div>
                  {item.target === "mapping" ? (
                    <Button size="sm" variant="outline" onClick={onMapping}>
                      Review mapping
                    </Button>
                  ) : item.target === "session" && item.sessionKey ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSession(item.sessionKey)}
                    >
                      Review session
                    </Button>
                  ) : item.target === "store" ? (
                    <a
                      href="#store-readiness"
                      className="text-xs font-medium text-[var(--app-accent)]"
                    >
                      Review store
                    </a>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <div
            role="status"
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-sm text-[var(--app-text-secondary)]"
          >
            {overview.emptyAttentionText}
          </div>
        )}
      </section>
    </>
  );
}
