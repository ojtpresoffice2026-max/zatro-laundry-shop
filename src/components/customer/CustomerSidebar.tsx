import { NavLink } from "react-router-dom";

import {
  Bell,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBasket,
  Wallet,
} from "lucide-react";

interface Props {
  fullName: string;
  unreadCount: number;
  loggingOut: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}

const links = [
  {
    label: "Dashboard",
    to: "/customer/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Laundry Orders",
    to: "/customer/orders",
    icon: ShoppingBasket,
  },
  {
    label: "Notifications",
    to: "/customer/notifications",
    icon: Bell,
  },
  {
    label: "My Payments",
    to: "/customer/payments",
    icon: Wallet,
  },
];

export default function CustomerSidebar({
  fullName,
  unreadCount,
  loggingOut,
  onLogout,
  onNavigate,
}: Props) {
  return (
    <div className="flex h-full flex-col bg-[#142B4A] text-white">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="rounded-xl bg-white/10 p-2.5">
          <Package size={24} />
        </div>

        <div>
          <h1 className="text-xl font-extrabold tracking-wider">
            ZATRO
          </h1>
          <p className="text-xs text-blue-200">
            Customer Portal
          </p>
        </div>
      </div>

      <div className="px-4 py-5">
        <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
          Menu
        </p>

        <nav className="space-y-1.5">
          {links.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-[#142B4A]"
                    : "text-blue-50 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={18} />

              <span className="flex-1">{label}</span>

              {to.endsWith("notifications") &&
                unreadCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-200 font-bold text-[#142B4A]">
            {fullName?.charAt(0).toUpperCase() || "C"}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {fullName || "Customer"}
            </p>
            <p className="text-xs text-blue-200">
              Customer Account
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 hover:text-white disabled:opacity-50"
        >
          <LogOut size={18} />
          {loggingOut ? "Signing Out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}