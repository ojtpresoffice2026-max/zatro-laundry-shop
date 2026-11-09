import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BarChart3,
  Banknote,
  CalendarDays,
  Download,
  RefreshCw,
  ShoppingBasket,
  Users,
  Shirt,
  Wallet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

// ==========================================
// TYPES
// ==========================================

type DateRange = "today" | "week" | "month" | "year" | "custom";

type ReportTab =
  | "overview"
  | "orders"
  | "payments"
  | "services"
  | "customers";

type OrderRecord = {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type PaymentRecord = {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
};

type CustomerRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

type ServiceRecord = {
  id: string;
  service_name: string;
  is_active: boolean;
  price: number;
  pricing_type: string;
};

type OrderItemRecord = {
  id: string;
  order_id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
};

type ServiceSummary = {
  service_name: string;
  total_quantity: number;
  total_sales: number;
  transactions: number;
};

type OrderStatusSummary = {
  status: string;
  count: number;
};

// ==========================================
// HELPERS
// ==========================================

const currency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatStatus = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateRange = (
  range: DateRange,
  customStart: string,
  customEnd: string
) => {
  const now = new Date();
  const today = getDateString(now);

  let start = today;
  let end = today;

  switch (range) {
    case "today": {
      start = today;
      end = today;
      break;
    }

    case "week": {
      const firstDay = new Date(now);
      const day = firstDay.getDay();
      const difference = day === 0 ? 6 : day - 1;

      firstDay.setDate(firstDay.getDate() - difference);

      start = getDateString(firstDay);
      end = today;
      break;
    }

    case "month": {
      const firstDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      start = getDateString(firstDay);
      end = today;
      break;
    }

    case "year": {
      const firstDay = new Date(now.getFullYear(), 0, 1);

      start = getDateString(firstDay);
      end = today;
      break;
    }

    case "custom": {
      start = customStart || today;
      end = customEnd || today;
      break;
    }
  }

  return { start, end };
};

const isWithinDateRange = (
  date: string | null,
  start: string,
  end: string
) => {
  if (!date) return false;

  const dateValue = new Date(date);

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59.999`);

  return dateValue >= startDate && dateValue <= endDate;
};

const downloadCSV = (
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) => {
  const escapeCSV = (value: string | number) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const content = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

// ==========================================
// REPORTS MANAGEMENT
// ==========================================

export default function ReportsManagement() {
  // Data
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRecord[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Tabs
  const [activeTab, setActiveTab] =
    useState<ReportTab>("overview");

  // Loading and messages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ========================================
  // LOAD REPORT DATA
  // ========================================

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        ordersResult,
        paymentsResult,
        customersResult,
        servicesResult,
        itemsResult,
      ] = await Promise.all([
        supabase
          .from("laundry_orders")
          .select(
            "id, order_number, customer_id, status, total_amount, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("payments")
          .select(
            "id, order_id, amount, payment_method, payment_status, paid_at, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone, role, is_active, created_at"
          )
          .eq("role", "customer")
          .order("created_at", { ascending: false }),

        supabase
          .from("laundry_services")
          .select(
            "id, service_name, is_active, price, pricing_type"
          )
          .order("service_name", { ascending: true }),

        supabase
          .from("order_items")
          .select(
            "id, order_id, service_id, service_name, quantity, unit_price, subtotal, created_at"
          ),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setOrders((ordersResult.data || []) as OrderRecord[]);
      setPayments((paymentsResult.data || []) as PaymentRecord[]);
      setCustomers((customersResult.data || []) as CustomerRecord[]);
      setServices((servicesResult.data || []) as ServiceRecord[]);
      setOrderItems((itemsResult.data || []) as OrderItemRecord[]);
    } catch (err) {
      console.error("Failed to load reports:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load report data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  // ========================================
  // DATE RANGE
  // ========================================

  const { start, end } = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  // ========================================
  // FILTERED DATA
  // ========================================

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        isWithinDateRange(order.created_at, start, end)
      ),
    [orders, start, end]
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) =>
        isWithinDateRange(
          payment.paid_at || payment.created_at,
          start,
          end
        )
      ),
    [payments, start, end]
  );

  const filteredOrderIds = useMemo(
    () => new Set(filteredOrders.map((order) => order.id)),
    [filteredOrders]
  );

  const filteredOrderItems = useMemo(
    () =>
      orderItems.filter((item) =>
        filteredOrderIds.has(item.order_id)
      ),
    [orderItems, filteredOrderIds]
  );

  // ========================================
  // SUMMARY STATISTICS
  // ========================================

  const verifiedPayments = filteredPayments.filter(
    (payment) => payment.payment_status === "verified"
  );

  const pendingPayments = filteredPayments.filter(
    (payment) => payment.payment_status === "pending"
  );

  const rejectedPayments = filteredPayments.filter(
    (payment) => payment.payment_status === "rejected"
  );

  const totalRevenue = verifiedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  const totalOrders = filteredOrders.length;

  const completedOrders = filteredOrders.filter(
    (order) => order.status === "completed"
  ).length;

  const pendingOrders = filteredOrders.filter(
    (order) => order.status === "pending"
  ).length;

  const activeCustomers = customers.filter(
    (customer) => customer.is_active
  ).length;

  const inactiveCustomers = customers.filter(
    (customer) => !customer.is_active
  ).length;



  // ========================================
  // ORDER STATUS SUMMARY
  // ========================================

  const orderStatusSummary = useMemo(() => {
    const statusMap = new Map<string, number>();

    filteredOrders.forEach((order) => {
      const current = statusMap.get(order.status) || 0;
      statusMap.set(order.status, current + 1);
    });

    return Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  // ========================================
  // SERVICE SUMMARY
  // ========================================

  const serviceSummary = useMemo(() => {
    const summaryMap = new Map<string, ServiceSummary>();

    filteredOrderItems.forEach((item) => {
      const name = item.service_name || "Unknown service";

      const existing = summaryMap.get(name) || {
        service_name: name,
        total_quantity: 0,
        total_sales: 0,
        transactions: 0,
      };

      existing.total_quantity += Number(item.quantity);
      existing.total_sales += Number(item.subtotal);
      existing.transactions += 1;

      summaryMap.set(name, existing);
    });

    return Array.from(summaryMap.values()).sort(
      (a, b) => b.total_sales - a.total_sales
    );
  }, [filteredOrderItems]);

  // ========================================
  // EXPORT REPORTS
  // ========================================

  const exportOrders = () => {
    downloadCSV(
      "zatro-orders-report.csv",
      [
        "Order Number",
        "Customer ID",
        "Status",
        "Total Amount",
        "Order Date",
      ],
      filteredOrders.map((order) => [
        order.order_number,
        order.customer_id,
        order.status,
        Number(order.total_amount).toFixed(2),
        formatDate(order.created_at),
      ])
    );
  };

  const exportPayments = () => {
    downloadCSV(
      "zatro-payments-report.csv",
      [
        "Payment ID",
        "Order ID",
        "Amount",
        "Payment Method",
        "Payment Status",
        "Payment Date",
      ],
      filteredPayments.map((payment) => [
        payment.id,
        payment.order_id,
        Number(payment.amount).toFixed(2),
        payment.payment_method,
        payment.payment_status,
        formatDate(payment.paid_at || payment.created_at),
      ])
    );
  };

  const exportServices = () => {
    downloadCSV(
      "zatro-services-report.csv",
      [
        "Service Name",
        "Total Quantity",
        "Number of Transactions",
        "Total Sales",
      ],
      serviceSummary.map((service) => [
        service.service_name,
        service.total_quantity,
        service.transactions,
        service.total_sales.toFixed(2),
      ])
    );
  };

  const exportCustomers = () => {
    downloadCSV(
      "zatro-customers-report.csv",
      [
        "Customer Name",
        "Email",
        "Phone",
        "Account Status",
        "Registration Date",
      ],
      customers.map((customer) => [
        customer.full_name,
        customer.email,
        customer.phone || "",
        customer.is_active ? "Active" : "Inactive",
        formatDate(customer.created_at),
      ])
    );
  };

  const exportCurrentReport = () => {
    switch (activeTab) {
      case "orders":
        exportOrders();
        break;

      case "payments":
        exportPayments();
        break;

      case "services":
        exportServices();
        break;

      case "customers":
        exportCustomers();
        break;

      default:
        downloadCSV(
          "zatro-overview-report.csv",
          ["Metric", "Value"],
          [
            ["Report Start Date", start],
            ["Report End Date", end],
            ["Total Revenue", totalRevenue.toFixed(2)],
            ["Total Orders", totalOrders],
            ["Completed Orders", completedOrders],
            ["Pending Orders", pendingOrders],
            ["Verified Payments", verifiedPayments.length],
            ["Pending Payments", pendingPayments.length],
            ["Rejected Payments", rejectedPayments.length],
            ["Total Customers", customers.length],
            ["Active Customers", activeCustomers],
            ["Inactive Customers", inactiveCustomers],
          ]
        );
    }
  };

  // ========================================
  // REPORT TABS
  // ========================================

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders" },
    { id: "payments", label: "Payments" },
    { id: "services", label: "Services" },
    { id: "customers", label: "Customers" },
  ];

  // ========================================
  // LOADING STATE
  // ========================================

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading reports...
          </p>
        </div>
      </div>
    );
  }

  // ========================================
  // ERROR STATE
  // ========================================

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <AlertCircle
          size={36}
          className="mx-auto text-red-500"
        />

        <h2 className="mt-3 font-bold text-slate-800">
          Unable to Load Reports
        </h2>

        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>

        <button
          onClick={() => void loadReports()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Reports
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor laundry shop performance and financial activity.
          </p>
        </div>

        <button
          onClick={exportCurrentReport}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* DATE FILTER */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={19} className="text-blue-600" />

          <h2 className="font-bold text-slate-800">
            Report Period
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["year", "This Year"],
              ["custom", "Custom Range"],
            ] as [DateRange, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setDateRange(value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                dateRange === value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {dateRange === "custom" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Start Date
              </label>

              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(event) =>
                  setCustomStart(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                End Date
              </label>

              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(event) =>
                  setCustomEnd(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Showing reports from {formatDate(`${start}T00:00:00`)} to{" "}
          {formatDate(`${end}T00:00:00`)}.
        </p>
      </div>

      {/* REPORT TABS */}

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================== */}
      {/* OVERVIEW REPORT */}
      {/* ================================== */}

      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* SUMMARY CARDS */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <SummaryCard
              title="Total Revenue"
              value={currency(totalRevenue)}
              description="Verified payments"
              icon={<Wallet size={23} />}
              color="green"
            />

            <SummaryCard
              title="Total Orders"
              value={String(totalOrders)}
              description="Orders within selected period"
              icon={<ShoppingBasket size={23} />}
              color="blue"
            />

            <SummaryCard
              title="Completed Orders"
              value={String(completedOrders)}
              description="Successfully completed"
              icon={<CheckCircle2 size={23} />}
              color="purple"
            />

            <SummaryCard
              title="Total Customers"
              value={String(customers.length)}
              description="Registered customer accounts"
              icon={<Users size={23} />}
              color="amber"
            />

          </div>

          {/* ORDER AND PAYMENT BREAKDOWN */}

          <div className="grid gap-6 xl:grid-cols-2">

            {/* ORDER STATUS */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800">
                    Order Status Breakdown
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Orders grouped by current status
                  </p>
                </div>

                <ShoppingBasket
                  size={22}
                  className="text-blue-600"
                />
              </div>

              {orderStatusSummary.length === 0 ? (
                <EmptyState message="No orders found for this period." />
              ) : (
                <div className="space-y-4">
                  {orderStatusSummary.map((item: OrderStatusSummary) => {
                    const percentage =
                      totalOrders > 0
                        ? (item.count / totalOrders) * 100
                        : 0;

                    return (
                      <div key={item.status}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-700">
                            {formatStatus(item.status)}
                          </span>

                          <span className="font-semibold text-slate-800">
                            {item.count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PAYMENT BREAKDOWN */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800">
                    Payment Summary
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Payment records within selected period
                  </p>
                </div>

                <Banknote
                  size={22}
                  className="text-green-600"
                />
              </div>

              <div className="space-y-4">

                <PaymentSummaryRow
                  label="Verified Payments"
                  count={verifiedPayments.length}
                  amount={verifiedPayments.reduce(
                    (sum, payment) =>
                      sum + Number(payment.amount),
                    0
                  )}
                  color="green"
                />

                <PaymentSummaryRow
                  label="Pending Payments"
                  count={pendingPayments.length}
                  amount={pendingPayments.reduce(
                    (sum, payment) =>
                      sum + Number(payment.amount),
                    0
                  )}
                  color="amber"
                />

                <PaymentSummaryRow
                  label="Rejected Payments"
                  count={rejectedPayments.length}
                  amount={rejectedPayments.reduce(
                    (sum, payment) =>
                      sum + Number(payment.amount),
                    0
                  )}
                  color="red"
                />

              </div>
            </div>

          </div>

          {/* CUSTOMER SUMMARY */}

          <div className="grid gap-4 sm:grid-cols-3">

            <SimpleStat
              title="Total Customers"
              value={customers.length}
              icon={<Users size={21} />}
            />

            <SimpleStat
              title="Active Customers"
              value={activeCustomers}
              icon={<CheckCircle2 size={21} />}
            />

            <SimpleStat
              title="Inactive Customers"
              value={inactiveCustomers}
              icon={<XCircle size={21} />}
            />

          </div>

          {/* TOP SERVICES */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">
                  Top Laundry Services
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Ranked by service sales
                </p>
              </div>

              <TrendingUp
                size={22}
                className="text-blue-600"
              />
            </div>

            {serviceSummary.length === 0 ? (
              <EmptyState message="No service transactions found for this period." />
            ) : (
              <div className="space-y-3">
                {serviceSummary.slice(0, 5).map((service, index) => (
                  <div
                    key={service.service_name}
                    className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-700">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {service.service_name}
                        </p>

                        <p className="text-xs text-slate-400">
                          {service.transactions} transactions
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-slate-800">
                      {currency(service.total_sales)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ================================== */}
      {/* ORDERS REPORT */}
      {/* ================================== */}

      {activeTab === "orders" && (
        <div className="space-y-5">

          <div className="grid gap-4 sm:grid-cols-3">
            <SimpleStat
              title="Total Orders"
              value={totalOrders}
              icon={<ShoppingBasket size={21} />}
            />

            <SimpleStat
              title="Completed Orders"
              value={completedOrders}
              icon={<CheckCircle2 size={21} />}
            />

            <SimpleStat
              title="Pending Orders"
              value={pendingOrders}
              icon={<Clock size={21} />}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ReportTable title="Laundry Orders Report">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Order Number</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Order Total</TableHeader>
                  <TableHeader>Order Date</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <TableEmpty colSpan={4} />
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <TableCell>
                        <span className="font-semibold text-slate-800">
                          {order.order_number}
                        </span>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>

                      <TableCell>
                        {currency(Number(order.total_amount))}
                      </TableCell>

                      <TableCell>
                        {formatDate(order.created_at)}
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </ReportTable>
          </div>

        </div>
      )}

      {/* ================================== */}
      {/* PAYMENTS REPORT */}
      {/* ================================== */}

      {activeTab === "payments" && (
        <div className="space-y-5">

          <div className="grid gap-4 sm:grid-cols-3">
            <SimpleStat
              title="Verified Payments"
              value={verifiedPayments.length}
              icon={<CheckCircle2 size={21} />}
            />

            <SimpleStat
              title="Pending Payments"
              value={pendingPayments.length}
              icon={<Clock size={21} />}
            />

            <SimpleStat
              title="Rejected Payments"
              value={rejectedPayments.length}
              icon={<XCircle size={21} />}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ReportTable title="Payment Transactions">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Payment ID</TableHeader>
                  <TableHeader>Order ID</TableHeader>
                  <TableHeader>Method</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Payment Date</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <TableEmpty colSpan={6} />
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <TableCell>
                        {payment.id.slice(0, 8).toUpperCase()}
                      </TableCell>

                      <TableCell>
                        {payment.order_id.slice(0, 8).toUpperCase()}
                      </TableCell>

                      <TableCell>
                        {payment.payment_method}
                      </TableCell>

                      <TableCell>
                        {currency(Number(payment.amount))}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={payment.payment_status} />
                      </TableCell>

                      <TableCell>
                        {formatDate(
                          payment.paid_at || payment.created_at
                        )}
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </ReportTable>
          </div>

        </div>
      )}

      {/* ================================== */}
      {/* SERVICES REPORT */}
      {/* ================================== */}

      {activeTab === "services" && (
        <div className="space-y-5">

          <div className="grid gap-4 sm:grid-cols-3">
            <SimpleStat
              title="Available Services"
              value={services.filter((service) => service.is_active).length}
              icon={<Shirt size={21} />}
            />

            <SimpleStat
              title="Service Transactions"
              value={filteredOrderItems.length}
              icon={<ShoppingBasket size={21} />}
            />

            <SimpleStat
              title="Service Sales"
              value={currency(
                serviceSummary.reduce(
                  (sum, service) => sum + service.total_sales,
                  0
                )
              )}
              icon={<Wallet size={21} />}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ReportTable title="Laundry Service Performance">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Service Name</TableHeader>
                  <TableHeader>Quantity</TableHeader>
                  <TableHeader>Transactions</TableHeader>
                  <TableHeader>Total Sales</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {serviceSummary.length === 0 ? (
                  <TableEmpty colSpan={4} />
                ) : (
                  serviceSummary.map((service) => (
                    <tr key={service.service_name}>
                      <TableCell>
                        <span className="font-semibold text-slate-800">
                          {service.service_name}
                        </span>
                      </TableCell>

                      <TableCell>
                        {service.total_quantity}
                      </TableCell>

                      <TableCell>
                        {service.transactions}
                      </TableCell>

                      <TableCell>
                        {currency(service.total_sales)}
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </ReportTable>
          </div>

        </div>
      )}

      {/* ================================== */}
      {/* CUSTOMERS REPORT */}
      {/* ================================== */}

      {activeTab === "customers" && (
        <div className="space-y-5">

          <div className="grid gap-4 sm:grid-cols-3">
            <SimpleStat
              title="Total Customers"
              value={customers.length}
              icon={<Users size={21} />}
            />

            <SimpleStat
              title="Active Customers"
              value={activeCustomers}
              icon={<CheckCircle2 size={21} />}
            />

            <SimpleStat
              title="Inactive Customers"
              value={inactiveCustomers}
              icon={<XCircle size={21} />}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ReportTable title="Registered Customers">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Phone</TableHeader>
                  <TableHeader>Account Status</TableHeader>
                  <TableHeader>Registration Date</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <TableEmpty colSpan={5} />
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id}>
                      <TableCell>
                        <span className="font-semibold text-slate-800">
                          {customer.full_name}
                        </span>
                      </TableCell>

                      <TableCell>{customer.email}</TableCell>

                      <TableCell>
                        {customer.phone || "Not provided"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          status={
                            customer.is_active ? "active" : "inactive"
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {formatDate(customer.created_at)}
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </ReportTable>
          </div>

        </div>
      )}

      {/* REPORT FOOTER */}

      <div className="flex flex-col justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400 sm:flex-row">
        <p>Zatro Laundry Shop Management System</p>

        <p>
          Report generated: {new Date().toLocaleString("en-PH")}
        </p>
      </div>

    </div>
  );
}

// ==========================================
// REUSABLE COMPONENTS
// ==========================================

function SummaryCard({
  title,
  value,
  description,
  icon,
  color,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  color: "green" | "blue" | "purple" | "amber";
}) {
  const colors = {
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>

          <h2 className="mt-2 break-words text-2xl font-bold text-slate-800">
            {value}
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SimpleStat({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

          <h3 className="mt-2 text-2xl font-bold text-slate-800">
            {value}
          </h3>
        </div>

        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function PaymentSummaryRow({
  label,
  count,
  amount,
  color,
}: {
  label: string;
  count: number;
  amount: number;
  color: "green" | "amber" | "red";
}) {
  const colors = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          {label}
        </p>

        <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${colors[color]}`}>
          {count} transactions
        </span>
      </div>

      <p className="text-sm font-bold text-slate-800">
        {currency(amount)}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <BarChart3
        size={32}
        className="mx-auto text-slate-300"
      />

      <p className="mt-3 text-sm text-slate-500">
        {message}
      </p>
    </div>
  );
}

function ReportTable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-bold text-slate-800">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[750px] text-left text-sm">
          {children}
        </table>
      </div>
    </>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
      {children}
    </td>
  );
}

function TableEmpty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-12 text-center text-sm text-slate-400"
      >
        No records found for the selected period.
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const color =
    normalized === "completed" ||
    normalized === "verified" ||
    normalized === "active"
      ? "bg-green-50 text-green-700"
      : normalized === "pending" ||
          normalized === "washing" ||
          normalized === "drying" ||
          normalized === "folding"
        ? "bg-amber-50 text-amber-700"
        : normalized === "rejected" ||
            normalized === "cancelled" ||
            normalized === "inactive"
          ? "bg-red-50 text-red-700"
          : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${color}`}>
      {formatStatus(status)}
    </span>
  );
}