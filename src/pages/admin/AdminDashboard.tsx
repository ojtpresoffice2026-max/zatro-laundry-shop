
import { useEffect, useState } from "react";

import {
  ShoppingBasket,
  Clock,
  WashingMachine,
  CheckCircle2,
  PhilippinePeso,
  ArrowUpRight,
  RefreshCw,
  Package,
  AlertCircle,
  Users as UsersIcon,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { format } from "date-fns";

// Dashboard statistics
interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalCustomers: number;
}

// Recent order information
interface RecentOrder {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name: string;
}

// Initial statistics
const initialStats: DashboardStats = {
  totalOrders: 0,
  pendingOrders: 0,
  activeOrders: 0,
  completedOrders: 0,
  totalRevenue: 0,
  totalCustomers: 0,
};

// Order status styles
const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  washing: "bg-cyan-100 text-cyan-700",
  drying: "bg-indigo-100 text-indigo-700",
  folding: "bg-purple-100 text-purple-700",
  ready_for_pickup: "bg-emerald-100 text-emerald-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  on_hold: "bg-orange-100 text-orange-700",
};

// Currency formatter
function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

// Status formatter
function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Main dashboard
export default function AdminDashboard() {
  const [stats, setStats] = useState(initialStats);

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  // Load dashboard information
  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [
        totalResult,
        pendingResult,
        activeResult,
        completedResult,
        customerResult,
        paymentsResult,
        ordersResult,
      ] = await Promise.all([
        // Total orders
        supabase
          .from("laundry_orders")
          .select("id", { count: "exact", head: true }),

        // Pending orders
        supabase
          .from("laundry_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        // Active orders
        supabase
          .from("laundry_orders")
          .select("id", { count: "exact", head: true })
          .in("status", [
            "confirmed",
            "washing",
            "drying",
            "folding",
          ]),

        // Completed orders
        supabase
          .from("laundry_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),

        // Registered customers
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer"),

        // Verified payments
        supabase
          .from("payments")
          .select("amount")
          .eq("payment_status", "verified"),

        // Latest orders
        supabase
          .from("laundry_orders")
          .select(
            "id, order_number, customer_id, status, total_amount, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      // Check database errors
      const results = [
        totalResult,
        pendingResult,
        activeResult,
        completedResult,
        customerResult,
        paymentsResult,
        ordersResult,
      ];

      const failedResult = results.find(
        (result) => result.error
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      // Calculate verified revenue
      const payments = paymentsResult.data ?? [];

      const revenue = payments.reduce(
        (sum, payment) =>
          sum + Number(payment.amount),
        0
      );

      // Update dashboard statistics
      setStats({
        totalOrders: totalResult.count ?? 0,
        pendingOrders: pendingResult.count ?? 0,
        activeOrders: activeResult.count ?? 0,
        completedOrders: completedResult.count ?? 0,
        totalRevenue: revenue,
        totalCustomers: customerResult.count ?? 0,
      });

      // Retrieve recent orders
      const orders = ordersResult.data ?? [];

      // Get unique customer IDs
      const customerIds = [
        ...new Set(
          orders.map((order) => order.customer_id)
        ),
      ];

      let customerMap: Record<string, string> = {};

      // Retrieve customer names
      if (customerIds.length > 0) {
        const {
          data: customers,
          error: customerError,
        } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds);

        if (customerError) {
          throw customerError;
        }

        customerMap = Object.fromEntries(
          (customers ?? []).map((customer) => [
            customer.id,
            customer.full_name,
          ])
        );
      }

      // Attach customer names to orders
      setRecentOrders(
        orders.map((order) => ({
          ...order,
          customer_name:
            customerMap[order.customer_id] ??
            "Unknown Customer",
        }))
      );
    } catch (err) {
      console.error(
        "Dashboard loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial dashboard loading
  useEffect(() => {
    void loadDashboard();
  }, []);

  // Statistics cards
  const cards = [
    {
      title: "Total Orders",
      value: stats.totalOrders,
      icon: ShoppingBasket,
      color: "bg-blue-100 text-blue-600",
      description: "All recorded orders",
    },
    {
      title: "Pending Orders",
      value: stats.pendingOrders,
      icon: Clock,
      color: "bg-amber-100 text-amber-600",
      description: "Awaiting processing",
    },
    {
      title: "Active Laundry",
      value: stats.activeOrders,
      icon: WashingMachine,
      color: "bg-cyan-100 text-cyan-600",
      description: "Currently processing",
    },
    {
      title: "Completed Orders",
      value: stats.completedOrders,
      icon: CheckCircle2,
      color: "bg-green-100 text-green-600",
      description: "Successfully completed",
    },
  ];

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw
            className="animate-spin mx-auto text-blue-600"
            size={32}
          />

          <p className="text-sm text-slate-500 mt-3">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Page heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Overview
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Monitor your laundry shop's performance and operations.
          </p>
        </div>

        <button
          onClick={() => void loadDashboard(true)}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 transition"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">

          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-semibold text-sm">
              Unable to load dashboard data
            </p>

            <p className="text-sm mt-1">
              {error}
            </p>

            <button
              onClick={() => void loadDashboard(true)}
              className="text-sm font-semibold underline mt-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
            >

              <div className="flex items-center justify-between">

                <div className={`p-3 rounded-xl ${card.color}`}>
                  <Icon size={22} />
                </div>

                <ArrowUpRight
                  size={18}
                  className="text-slate-300"
                />

              </div>

              <p className="text-sm text-slate-500 mt-5">
                {card.title}
              </p>

              <h3 className="text-3xl font-bold text-slate-900 mt-1">
                {card.value.toLocaleString("en-PH")}
              </h3>

              <p className="text-xs text-slate-400 mt-2">
                {card.description}
              </p>

            </div>
          );
        })}

      </div>

      {/* Revenue and customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Revenue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Verified Payment Revenue
              </p>

              <h3 className="text-3xl font-bold text-slate-900 mt-2">
                {formatCurrency(stats.totalRevenue)}
              </h3>
            </div>

            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <PhilippinePeso size={25} />
            </div>

          </div>

          <p className="text-xs text-slate-400 mt-4">
            Based on verified payment transactions.
          </p>

        </div>

        {/* Customers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Registered Customers
              </p>

              <h3 className="text-3xl font-bold text-slate-900 mt-2">
                {stats.totalCustomers.toLocaleString("en-PH")}
              </h3>
            </div>

            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <UsersIcon size={25} />
            </div>

          </div>

          <p className="text-xs text-slate-400 mt-4">
            Total registered customer profiles.
          </p>

        </div>

      </div>

      {/* Recent orders */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 border-b border-slate-100">

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Laundry Orders
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Latest transactions recorded in your shop.
            </p>
          </div>

          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
            Latest 8 orders
          </span>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">

              <tr>
                <th className="px-6 py-4">
                  Order Number
                </th>

                <th className="px-6 py-4">
                  Customer
                </th>

                <th className="px-6 py-4">
                  Date
                </th>

                <th className="px-6 py-4">
                  Amount
                </th>

                <th className="px-6 py-4">
                  Status
                </th>
              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {recentOrders.length > 0 ? (

                recentOrders.map((order) => (

                  <tr
                    key={order.id}
                    className="hover:bg-slate-50 transition"
                  >

                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {order.order_number}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {order.customer_name}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {format(
                        new Date(order.created_at),
                        "MMM dd, yyyy"
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {formatCurrency(
                        Number(order.total_amount)
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          statusStyles[order.status] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatStatus(order.status)}
                      </span>

                    </td>

                  </tr>

                ))

              ) : (

                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center"
                  >

                    <Package
                      size={35}
                      className="mx-auto text-slate-300"
                    />

                    <p className="text-sm font-medium text-slate-600 mt-3">
                      No laundry orders yet
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      New customer orders will appear here.
                    </p>

                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 pb-4">
        © 2026 Zatro Laundry Shop. All rights reserved.
      </div>

    </div>
  );
}
