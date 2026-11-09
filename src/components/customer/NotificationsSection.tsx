import { format } from "date-fns";

import {
  Bell,
  CheckCheck,
  PackageCheck,
} from "lucide-react";

import type { CustomerNotification } from "../../types/customer";

interface Props {
  notifications: CustomerNotification[];
  unreadCount: number;
  onAcknowledge: (item: CustomerNotification) => void;
  onAcknowledgeAll: () => void;
}

export default function NotificationsSection({
  notifications,
  unreadCount,
  onAcknowledge,
  onAcknowledgeAll,
}: Props) {
  return (
    <section
      id="customer-notifications"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <Bell size={18} />

            Notifications

            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                {unreadCount} new
              </span>
            )}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Updates about your laundry orders.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onAcknowledgeAll}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <CheckCheck size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-10 text-center">
          <Bell
            className="mx-auto text-slate-300"
            size={32}
          />

          <p className="mt-3 text-sm text-slate-500">
            No notifications yet.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 px-4 py-4 sm:px-5 ${
                notification.is_read
                  ? "bg-white"
                  : "bg-blue-50/50"
              }`}
            >
              <div
                className={`mt-0.5 rounded-xl p-2 ${
                  notification.notification_type === "pickup_ready"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {notification.notification_type ===
                "pickup_ready" ? (
                  <PackageCheck size={19} />
                ) : (
                  <Bell size={19} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {notification.title}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {notification.message}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {format(
                    new Date(notification.created_at),
                    "MMM dd, yyyy · hh:mm a"
                  )}
                </p>
              </div>

              {!notification.is_read && (
                <button
                  onClick={() => onAcknowledge(notification)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}