"use client";

/** Notifications page — paginated list, unread highlighting, mark-all. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { Button, Card, EmptyState, PageLoader, SectionHeader } from "@/components/platform/ui-bits";

type Notification = {
  id: string;
  category: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (targetPage: number) => {
    const data = await apiFetch<{ notifications: Notification[]; unread: number; pages: number }>(
      "/notifications",
      { query: { page: targetPage, pageSize: 20 } },
    ).catch(() => null);
    if (data) {
      setNotifications(data.notifications);
      setUnread(data.unread);
      setPages(data.pages);
      setPage(targetPage);
    } else {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function markAll() {
    await apiFetch("/notifications/mark-all-read", { method: "POST" }).catch(() => undefined);
    void load(page);
  }

  async function open(notification: Notification) {
    if (!notification.readAt) {
      apiFetch("/notifications/mark-read", { method: "POST", body: { ids: [notification.id] } }).catch(() => undefined);
    }
    if (notification.link) {
      // All notification links are internal app routes.
      router.push(notification.link);
    } else {
      void load(page);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You are all caught up."}
        action={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAll}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {notifications === null ? (
        <PageLoader />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="Updates about your enquiries, cases and payments will appear here." />
      ) : (
        <Card className="divide-y divide-brand-50">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => void open(notification)}
              className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-50/50 ${
                notification.readAt ? "" : "bg-brand-50/40"
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-brand-100" : "bg-brand-600"}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-strong">{notification.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{notification.body}</span>
                <span className="mt-1 block text-xs text-ink-muted">{formatRelative(notification.createdAt)}</span>
              </span>
            </button>
          ))}
        </Card>
      )}

      {pages > 1 && (
        <nav className="mt-5 flex justify-center gap-3" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
            Previous
          </Button>
          <span className="self-center text-sm text-ink-muted">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => void load(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
