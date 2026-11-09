import { BellRing, Check } from "lucide-react";
import { format } from "date-fns";

import type { CustomerNotification } from "../../types/customer";

interface Props {
  notification: CustomerNotification | null;
  onDismiss: () => void;
}

export default function PickupAlertModal({
  notification,
  onDismiss,
}: Props) {
  if (!notification) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
          <BellRing size={42} />
        </div>

        <h2 className="mt-5 text-2xl font-extrabold text-slate-900">
          Your Laundry Is Ready!
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {notification.message}
        </p>

        <p className="mt-2 text-xs text-slate-400">
          {format(
            new Date(notification.created_at),
            "MMM dd, yyyy · hh:mm a"
          )}
        </p>

        <button
          onClick={onDismiss}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700"
        >
          <Check size={18} />
          I've Seen This — Dismiss Popup
        </button>
      </div>
    </div>
  );
}