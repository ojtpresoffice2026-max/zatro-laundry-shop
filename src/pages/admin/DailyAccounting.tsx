
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Banknote,
  ShoppingBag,
  Wallet,
  PackageCheck,
  Printer,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type LaundryOrder = {
  id: string;
  order_number: string;
  customer_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type Payment = {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
};

type CustomerProfile = {
  id: string;
  full_name: string;
};

type OrderWithCustomer = LaundryOrder & {
  customer_name: string;
};

type PaymentWithDetails = Payment & {
  order_number: string;
  customer_name: string;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount || 0);

const formatDateTime = (value: string | null) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDayRange = (date: string) => {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

// Only payments that have actually been collected are included.
const isCollected = (payment: Payment) => {
  const status = payment.payment_status?.toLowerCase();

  return (
    Boolean(payment.paid_at) &&
    !["pending", "unpaid", "cancelled", "failed"].includes(status)
  );
};


type PaginationProps = {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

const PAGE_SIZE = 10;

function TablePagination({
  currentPage,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{start}-{end}</span> of{" "}
        <span className="font-semibold text-slate-700">{totalItems}</span> records
        <span className="ml-2 text-slate-400">· 10 rows per page</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-[90px] text-center text-xs font-medium text-slate-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function DailyAccounting() {
  const [selectedDate, setSelectedDate] = useState(getToday());

  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [claims, setClaims] = useState<OrderWithCustomer[]>([]);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [activeSection, setActiveSection] = useState<
    "laundry" | "payments" | "claims"
  >("laundry");
  const [laundryPage, setLaundryPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [claimsPage, setClaimsPage] = useState(1);

  const [salesPaymentTotals, setSalesPaymentTotals] = useState<
    Record<string, number>
  >({});

  // Total payments already recorded for each completed order.
  const [claimPaymentTotals, setClaimPaymentTotals] = useState<
    Record<string, number>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAccounting = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { start, end } = getDayRange(selectedDate);

      // 1. Orders created on the selected date.
      const { data: salesData, error: salesError } = await supabase
        .from("laundry_orders")
        .select(
          "id, order_number, customer_id, total_amount, status, created_at, completed_at"
        )
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });

      if (salesError) throw salesError;

      // 2. Orders picked up / completed on the selected date.
      const { data: claimsData, error: claimsError } = await supabase
        .from("laundry_orders")
        .select(
          "id, order_number, customer_id, total_amount, status, created_at, completed_at"
        )
        .gte("completed_at", start)
        .lt("completed_at", end)
        .lt("created_at", start)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (claimsError) throw claimsError;

      // 3. Actual payments collected on the selected date.
      const { data: dailyPaymentsData, error: paymentsError } =
        await supabase
          .from("payments")
          .select(
            "id, order_id, amount, payment_method, payment_status, paid_at, created_at"
          )
          .gte("paid_at", start)
          .lt("paid_at", end)
          .order("paid_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      const sales = (salesData || []) as LaundryOrder[];
      const dailyClaims = (claimsData || []) as LaundryOrder[];

      const dailyPayments = (
        (dailyPaymentsData || []) as Payment[]
      ).filter(isCollected);

      // 4. Get all collected payments for orders created on this date.
      // Used to calculate Paid Sales and Unpaid Sales.
      const salesOrderIds = sales.map((order) => order.id);

      let salesPayments: Payment[] = [];

      if (salesOrderIds.length > 0) {
        const { data, error: salesPaymentsError } = await supabase
          .from("payments")
          .select(
            "id, order_id, amount, payment_method, payment_status, paid_at, created_at"
          )
          .in("order_id", salesOrderIds);

        if (salesPaymentsError) throw salesPaymentsError;

        salesPayments = ((data || []) as Payment[]).filter(isCollected);
      }

      const paymentTotals: Record<string, number> = {};

      salesPayments.forEach((payment) => {
        paymentTotals[payment.order_id] =
          (paymentTotals[payment.order_id] || 0) +
          Number(payment.amount || 0);
      });

      setSalesPaymentTotals(paymentTotals);

      // 5. Get ALL collected payments for orders picked up on this date.
      // This prevents adding the same amount again to Cash on Hand.
      const claimOrderIds = dailyClaims.map((order) => order.id);

      let claimPayments: Payment[] = [];

      if (claimOrderIds.length > 0) {
        const { data, error: claimPaymentsError } = await supabase
          .from("payments")
          .select(
            "id, order_id, amount, payment_method, payment_status, paid_at, created_at"
          )
          .in("order_id", claimOrderIds)
          .lt("paid_at", end);

        if (claimPaymentsError) throw claimPaymentsError;

        claimPayments = ((data || []) as Payment[]).filter(isCollected);
      }

      const claimTotals: Record<string, number> = {};

      claimPayments.forEach((payment) => {
        claimTotals[payment.order_id] =
          (claimTotals[payment.order_id] || 0) +
          Number(payment.amount || 0);
      });

      setClaimPaymentTotals(claimTotals);

      // 6. Get all relevant orders for the payments table.
      const relevantOrders = [...sales, ...dailyClaims];

      const paymentOrderIds = dailyPayments.map(
        (payment) => payment.order_id
      );

      const allRelevantOrderIds = Array.from(
        new Set([
          ...relevantOrders.map((order) => order.id),
          ...paymentOrderIds,
        ])
      );

      let paymentOrders: LaundryOrder[] = [];

      if (allRelevantOrderIds.length > 0) {
        const { data, error: orderDetailsError } = await supabase
          .from("laundry_orders")
          .select(
            "id, order_number, customer_id, total_amount, status, created_at, completed_at"
          )
          .in("id", allRelevantOrderIds);

        if (orderDetailsError) throw orderDetailsError;

        paymentOrders = (data || []) as LaundryOrder[];
      }

      // 7. Get customer names.
      const customerIds = Array.from(
        new Set(
          paymentOrders
            .map((order) => order.customer_id)
            .filter(Boolean)
        )
      );

      let profiles: CustomerProfile[] = [];

      if (customerIds.length > 0) {
        const { data, error: customersError } = await supabase
          .from("customers")
          .select("id, full_name")
          .in("id", customerIds);

        if (customersError) throw customersError;

        profiles = (data || []) as CustomerProfile[];
      }

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile.full_name])
      );

      const orderMap = new Map(
        paymentOrders.map((order) => [order.id, order])
      );

      const addCustomerName = (
        order: LaundryOrder
      ): OrderWithCustomer => ({
        ...order,
        customer_name:
          profileMap.get(order.customer_id) || "Unknown Customer",
      });

      setOrders(sales.map(addCustomerName));

      // Claims are older orders picked up today and fully paid.
      const fullyPaidClaims = dailyClaims.filter(
        (order) =>
          (claimTotals[order.id] || 0) >= Number(order.total_amount || 0)
      );
      setClaims(fullyPaidClaims.map(addCustomerName));

      setPayments(
        dailyPayments.map((payment) => {
          const order = orderMap.get(payment.order_id);

          return {
            ...payment,
            order_number: order?.order_number || "Unknown Order",
            customer_name: order
              ? profileMap.get(order.customer_id) || "Unknown Customer"
              : "Unknown Customer",
          };
        })
      );
    } catch (err) {
      console.error("Daily accounting load failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load daily accounting records."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLaundryPage(1);
    setPaymentsPage(1);
    setClaimsPage(1);
  }, [selectedDate]);

  useEffect(() => {
    void loadAccounting();

    // Realtime updates when orders or payments change.
    const channel = supabase
      .channel("zatro-daily-accounting-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "laundry_orders" },
        () => void loadAccounting()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => void loadAccounting()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAccounting]);

  // TOTAL SALES:
  // Total value of orders created on the selected date.
  const totalSales = useMemo(
    () =>
      orders.reduce(
        (total, order) => total + Number(order.total_amount || 0),
        0
      ),
    [orders]
  );

  // PAID SALES:
  // Payments recorded against orders created on the selected date.
  const paidSales = useMemo(
    () =>
      orders.reduce(
        (total, order) =>
          total + (salesPaymentTotals[order.id] || 0),
        0
      ),
    [orders, salesPaymentTotals]
  );

  // UNPAID SALES:
  const unpaidSales = Math.max(0, totalSales - paidSales);

  // CASH ON HAND:
  // Only actual payment records collected on the selected date.
  // Never assume an unpaid balance was collected just because an order
  // was marked completed.
  const cashOnHand = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      ),
    [payments]
  );

  // TOTAL VALUE OF CLAIMED ORDERS:
  const claimsTotal = useMemo(
    () =>
      claims.reduce(
        (total, order) => total + Number(order.total_amount || 0),
        0
      ),
    [claims]
  );

  const paginatedOrders = useMemo(
    () => orders.slice((laundryPage - 1) * PAGE_SIZE, laundryPage * PAGE_SIZE),
    [orders, laundryPage]
  );
  const paginatedPayments = useMemo(
    () => payments.slice((paymentsPage - 1) * PAGE_SIZE, paymentsPage * PAGE_SIZE),
    [payments, paymentsPage]
  );
  const paginatedClaims = useMemo(
    () => claims.slice((claimsPage - 1) * PAGE_SIZE, claimsPage * PAGE_SIZE),
    [claims, claimsPage]
  );

  const exportCSV = () => {
    const rows = [
      ["ZATRO LAUNDRY SHOP - DAILY ACCOUNTING"],
      ["Date", selectedDate],
      [],
      ["SUMMARY"],
      ["Total Sales", totalSales.toFixed(2)],
      ["Paid Sales", paidSales.toFixed(2)],
      ["Unpaid Sales", unpaidSales.toFixed(2)],
      ["Cash on Hand", cashOnHand.toFixed(2)],
      ["Claims", claims.length],
      ["Claimed Order Value", claimsTotal.toFixed(2)],
      [],
      ["PAYMENTS COLLECTED"],
      [
        "Order Number",
        "Customer",
        "Payment Method",
        "Amount",
        "Date",
      ],
      ...payments.map((payment) => [
        payment.order_number,
        payment.customer_name,
        payment.payment_method,
        Number(payment.amount).toFixed(2),
        payment.paid_at || "",
      ]),
      [],
      ["LAUNDRY CLAIMS"],
      [
        "Order Number",
        "Customer",
        "Order Value",
        "Total Paid",
        "Paid Amount at Pickup",
        "Pickup Date",
      ],
      ...claims.map((order) => {
        const paid = claimPaymentTotals[order.id] || 0;
        return [
          order.order_number,
          order.customer_name,
          Number(order.total_amount).toFixed(2),
          paid.toFixed(2),
          paid.toFixed(2),
          order.completed_at || "",
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "").replace(/"/g, '""');
            return `"${value}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ZATRO-Daily-Accounting-${selectedDate}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const cards = [
    {
      title: "Total Sales",
      value: formatCurrency(totalSales),
      subtitle: `${orders.length} orders created`,
      icon: ShoppingBag,
      color: "blue",
    },
    {
      title: "Paid Sales",
      value: formatCurrency(paidSales),
      subtitle: "Payments against selected day's orders",
      icon: Wallet,
      color: "emerald",
    },
    {
      title: "Unpaid Sales",
      value: formatCurrency(unpaidSales),
      subtitle: "Outstanding balance from selected day's orders",
      icon: AlertCircle,
      color: "amber",
    },
    {
      title: "Cash on Hand",
      value: formatCurrency(cashOnHand),
      subtitle: "Actual payments collected on the selected date",
      icon: Banknote,
      color: "violet",
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="space-y-6">
      <style>
        {`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            main { padding: 0 !important; }
            .print-area { box-shadow: none !important; border: 0 !important; }
          }
        `}
      </style>

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Daily Accounting
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Daily sales, cash collections, and laundry pickups.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={17} />
            Print
          </button>

          <button
            onClick={exportCSV}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#142B4A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </div>

      {/* DATE FILTER */}
      <div className="no-print flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="accounting-date"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Select Accounting Date
          </label>

          <div className="relative">
            <CalendarDays
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              id="accounting-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
            />
          </div>
        </div>

        <button
          onClick={() => void loadAccounting()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <RefreshCw size={17} />
          )}
          Refresh
        </button>
      </div>

      <div className="print-area">
        {/* PRINT HEADER */}
        <div className="mb-4 hidden print:block">
          <h1 className="text-xl font-bold">ZATRO LAUNDRY SHOP</h1>
          <p className="text-sm">
            Daily Accounting Report — {selectedDate}
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />

            <div>
              <p className="font-semibold">
                Unable to load accounting data
              </p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    {card.title}
                  </p>

                  <div
                    className={`rounded-lg p-2 ${colorClasses[card.color]}`}
                  >
                    <Icon size={20} />
                  </div>
                </div>

                <p className="mt-4 text-2xl font-bold text-slate-800">
                  {loading ? "—" : card.value}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {card.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        {/* CLAIMS AND ACCOUNTING SUMMARY */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
                <PackageCheck size={21} />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">
                  Laundry Claims / Pickups
                </p>

                <p className="text-2xl font-bold text-slate-800">
                  {loading ? "—" : claims.length}

                  <span className="ml-2 text-sm font-medium text-slate-400">
                    orders
                  </span>
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Total value of claimed orders:{" "}
              <span className="font-bold text-slate-800">
                {loading ? "—" : formatCurrency(claimsTotal)}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Daily Accounting Summary
            </p>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Orders created</span>
                <span className="font-semibold text-slate-800">
                  {loading ? "—" : orders.length}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">
                  Payments recorded today
                </span>
                <span className="font-semibold text-slate-800">
                  {loading ? "—" : payments.length}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Orders claimed</span>
                <span className="font-semibold text-slate-800">
                  {loading ? "—" : claims.length}
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">
                  Claimed order value
                </span>
                <span className="font-semibold text-emerald-700">
                  {loading ? "—" : formatCurrency(claimsTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ACCOUNTING SECTION TABS */}
        <div className="no-print mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
          {[
            { id: "laundry", label: "New Laundry" },
            { id: "payments", label: "Payments Collected" },
            { id: "claims", label: "Laundry Claims / Pickups" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveSection(tab.id as "laundry" | "payments" | "claims")
              }
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                activeSection === tab.id
                  ? "bg-[#142B4A] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* NEW LAUNDRY TABLE */}
        {activeSection === "laundry" && (
          <>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-800">New Laundry</h2>
            <p className="mt-1 text-xs text-slate-500">
              Orders received on {selectedDate}, including paid and unpaid orders.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order Number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Date Received</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Unpaid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Loading new laundry...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No new laundry orders on this date.</td></tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const total = Number(order.total_amount || 0);
                    const paid = Math.min(total, salesPaymentTotals[order.id] || 0);
                    const unpaid = Math.max(0, total - paid);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700">{order.order_number}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{order.customer_name}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(order.created_at)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-700">{formatCurrency(total)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-emerald-700">{formatCurrency(paid)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-amber-700">{formatCurrency(unpaid)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-right font-bold text-slate-700">Totals</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">{loading ? "—" : formatCurrency(totalSales)}</td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-700">{loading ? "—" : formatCurrency(paidSales)}</td>
                  <td className="px-5 py-3 text-right font-bold text-amber-700">{loading ? "—" : formatCurrency(unpaidSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <TablePagination
            currentPage={laundryPage}
            totalItems={orders.length}
            onPageChange={setLaundryPage}
          />
        </div>

          </>
        )}

        {/* PAYMENTS TABLE */}
        {activeSection === "payments" && (
          <>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-800">
              Payments Collected
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Actual payment records received on {selectedDate}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order Number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Payment Method</th>
                  <th className="px-5 py-3">Date Collected</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      No payment records collected on this date.
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700">
                        {payment.order_number}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {payment.customer_name}
                      </td>

                      <td className="px-5 py-3 capitalize text-slate-600">
                        {payment.payment_method}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                        {formatDateTime(payment.paid_at)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-emerald-700">
                        {formatCurrency(Number(payment.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-3 text-right font-bold text-slate-700"
                  >
                    Actual Payments Recorded Today
                  </td>

                  <td className="px-5 py-3 text-right font-bold text-emerald-700">
                    {loading
                      ? "—"
                      : formatCurrency(
                          payments.reduce(
                            (total, payment) =>
                              total + Number(payment.amount || 0),
                            0
                          )
                        )}
                  </td>
                </tr>

                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-3 text-right font-bold text-slate-700"
                  >
                    Total Cash on Hand
                  </td>

                  <td className="px-5 py-3 text-right font-bold text-emerald-700">
                    {loading ? "—" : formatCurrency(cashOnHand)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <TablePagination
            currentPage={paymentsPage}
            totalItems={payments.length}
            onPageChange={setPaymentsPage}
          />
        </div>

          </>
        )}

        {/* CLAIMS TABLE */}
        {activeSection === "claims" && (
          <>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-800">
              Laundry Claims / Pickups
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Older orders created before {selectedDate}, picked up today,
              and fully paid before release.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order Number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Order Date</th>
                  <th className="px-5 py-3">Pickup Date</th>
                  <th className="px-5 py-3 text-right">Order Value</th>
                  <th className="px-5 py-3 text-right">
                    Paid Amount
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      Loading claims...
                    </td>
                  </tr>
                ) : claims.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      No laundry pickups recorded on this date.
                    </td>
                  </tr>
                ) : (
                  paginatedClaims.map((order) => {
                    const alreadyPaid =
                      claimPaymentTotals[order.id] || 0;

                    const paidAmount = alreadyPaid;

                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700">
                          {order.order_number}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {order.customer_name}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {formatDateTime(order.created_at)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {formatDateTime(order.completed_at)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-700">
                          {formatCurrency(Number(order.total_amount))}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-emerald-700">
                          {formatCurrency(paidAmount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-3 text-right font-bold text-slate-700"
                  >
                    Total Claimed Order Value
                  </td>

                  <td className="px-5 py-3 text-right font-bold text-slate-800">
                    {loading ? "—" : formatCurrency(claimsTotal)}
                  </td>

                  <td className="px-5 py-3 text-right font-bold text-emerald-700">
                    {loading
                      ? "—"
                      : formatCurrency(
                          claims.reduce(
                            (total, order) =>
                              total + (claimPaymentTotals[order.id] || 0),
                            0
                          )
                        )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <TablePagination
            currentPage={claimsPage}
            totalItems={claims.length}
            onPageChange={setClaimsPage}
          />
        </div>
          </>
        )}

      </div>
    </div>
  );
}
