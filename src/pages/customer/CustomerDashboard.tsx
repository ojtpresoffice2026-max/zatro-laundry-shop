import { PackageCheck } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { useCustomerData } from "../../contexts/CustomerDataContext";

import DashboardStats from "../../components/customer/DashboardStats";

export default function CustomerDashboard() {
  const { profile } = useAuth();

  const {
    orders,
    pendingOrders,
    readyOrders,
    totalPaid,
    loading,
  } = useCustomerData();

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#142B4A] via-[#1D426C] to-blue-700 px-5 py-6 text-white shadow-md sm:px-7 sm:py-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100 sm:text-sm">
              Customer Dashboard
            </p>

            <h2 className="mt-2 break-words text-xl font-bold sm:text-2xl lg:text-3xl">
              Welcome back, {profile?.full_name || "Customer"}!
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Track your laundry orders, review payments, and stay
              updated on pickup notifications.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-blue-50 sm:mt-0 sm:self-center">
            <PackageCheck size={16} />
            <span>{readyOrders} ready for pickup</span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">
          Loading your dashboard...
        </div>
      ) : (
        <DashboardStats
          totalOrders={orders.length}
          pendingOrders={pendingOrders}
          readyOrders={readyOrders}
          totalPaid={totalPaid}
        />
      )}
    </div>
  );
}