import { format } from "date-fns";
import { ShoppingBasket } from "lucide-react";

import type { CustomerOrder } from "../../types/customer";

import {
  money,
  statusClasses,
  statusLabel,
} from "../../utils/customer";

interface Props {
  orders: CustomerOrder[];
  loading: boolean;
}

export default function OrdersSection({
  orders,
  loading,
}: Props) {
  return (
    <section
      id="customer-orders"
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5 sm:py-5">
        <div>
          <h3 className="font-bold text-slate-900">
            My Laundry Orders
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Orders registered under your account.
          </p>
        </div>

        <span className="text-sm text-slate-500">
          {orders.length} order(s)
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">
          Loading your orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center">
          <ShoppingBasket
            className="mx-auto text-slate-300"
            size={38}
          />

          <p className="mt-3 font-semibold text-slate-700">
            No orders yet
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Your laundry orders will appear here when the admin
            creates them.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW */}
          <div className="divide-y divide-slate-100 md:hidden">
            {orders.map((order) => (
              <article
                key={order.id}
                className="space-y-3 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">
                      Order Number
                    </p>

                    <p className="mt-1 break-all text-sm font-bold text-slate-800">
                      {order.order_number}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${statusClasses(order.status)}`}
                  >
                    {statusLabel(order.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">
                      Date &amp; Time
                    </p>

                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {format(
                        new Date(order.created_at),
                        "MMM dd, yyyy"
                      )}
                    </p>

                    <p className="text-xs text-slate-400">
                      {format(
                        new Date(order.created_at),
                        "hh:mm:ss a"
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      Order Amount
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {money(order.total_amount)}
                    </p>
                  </div>

                  {order.status === "completed" &&
                    order.completed_at && (
                      <div className="col-span-2 rounded-lg bg-blue-50 px-3 py-2">
                        <p className="text-xs font-medium text-blue-700">
                          Pickup Date &amp; Time
                        </p>

                        <p className="mt-1 text-xs font-semibold text-blue-900">
                          {format(
                            new Date(order.completed_at),
                            "MMM dd, yyyy · hh:mm:ss a"
                          )}
                        </p>
                      </div>
                    )}
                </div>
              </article>
            ))}
          </div>

          {/* DESKTOP VIEW */}
          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Order Number</th>
                  <th className="px-5 py-4">Date &amp; Time</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                      {order.order_number}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="text-sm text-slate-700">
                        {format(
                          new Date(order.created_at),
                          "MMM dd, yyyy"
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {format(
                          new Date(order.created_at),
                          "hh:mm:ss a"
                        )}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                      {money(order.total_amount)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses(order.status)}`}
                        >
                          {statusLabel(order.status)}
                        </span>

                        {order.status === "completed" &&
                          order.completed_at && (
                            <span className="text-xs text-slate-500">
                              Picked up:{" "}
                              {format(
                                new Date(order.completed_at),
                                "MMM dd, yyyy · hh:mm a"
                              )}
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}