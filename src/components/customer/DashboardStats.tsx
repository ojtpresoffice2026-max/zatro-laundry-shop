import {
  Clock3,
  PackageCheck,
  ShoppingBasket,
  Wallet,
} from "lucide-react";

import { money } from "../../utils/customer";

interface Props {
  totalOrders: number;
  pendingOrders: number;
  readyOrders: number;
  totalPaid: number;
}

export default function DashboardStats({
  totalOrders,
  pendingOrders,
  readyOrders,
  totalPaid,
}: Props) {
  const cards = [
    {
      label: "Total Orders",
      value: totalOrders,
      icon: ShoppingBasket,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Pending Orders",
      value: pendingOrders,
      icon: Clock3,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Ready for Pickup",
      value: readyOrders,
      icon: PackageCheck,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Total Payments",
      value: money(totalPaid),
      icon: Wallet,
      color: "bg-violet-100 text-violet-700",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:block sm:p-5"
          >
            <div
              className={`inline-flex shrink-0 rounded-xl p-3 ${card.color}`}
            >
              <Icon size={21} />
            </div>

            <div className="min-w-0 sm:mt-4">
              <p className="text-xs text-slate-500 sm:text-sm">
                {card.label}
              </p>

              <p className="mt-1 break-words text-lg font-bold text-slate-900 sm:text-2xl">
                {card.value}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}