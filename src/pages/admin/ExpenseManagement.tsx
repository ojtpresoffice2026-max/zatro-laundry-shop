import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Wallet,
  Receipt,
  CalendarDays,
  Pencil,
  Ban,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type ExpenseStatus = "active" | "voided";

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  status: ExpenseStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type ExpenseForm = {
  expense_date: string;
  category: string;
  description: string;
  amount: string;
};

const PAGE_SIZE = 10;

const CATEGORIES = [
  "Supplies",
  "Detergent and Chemicals",
  "Utilities",
  "Rent",
  "Maintenance and Repairs",
  "Transportation",
  "Salaries and Wages",
  "Equipment",
  "Packaging",
  "Other",
];

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const emptyForm = (): ExpenseForm => ({
  expense_date: today(),
  category: "",
  description: "",
  amount: "",
});

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount) || 0);

const formatDate = (value: string) => {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const escapeCSV = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

function SummaryCard({
  title,
  amount,
  subtitle,
  icon: Icon,
}: {
  title: string;
  amount: number;
  subtitle: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-bold text-slate-800">
            {formatCurrency(amount)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-rose-50 p-3 text-rose-600">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function ExpenseManagement() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ExpenseStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("expenses")
        .select(
          "id, expense_date, category, description, amount, status, created_by, updated_by, created_at, updated_at"
        )
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      setExpenses((data || []) as Expense[]);
    } catch (err) {
      console.error("Expense loading failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load expense records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExpenses();

    const channel = supabase
      .channel("zatro-expenses-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => void loadExpenses()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadExpenses]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !normalizedSearch ||
        expense.category.toLowerCase().includes(normalizedSearch) ||
        expense.description.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "all" || expense.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || expense.status === statusFilter;
      const matchesFrom = !dateFrom || expense.expense_date >= dateFrom;
      const matchesTo = !dateTo || expense.expense_date <= dateTo;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [expenses, search, categoryFilter, statusFilter, dateFrom, dateTo]);

  const activeFilteredExpenses = filteredExpenses.filter(
    (expense) => expense.status === "active"
  );

  const totalActiveExpenses = activeFilteredExpenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  const currentMonth = today().slice(0, 7);
  const monthlyExpenses = expenses
    .filter(
      (expense) =>
        expense.status === "active" &&
        expense.expense_date.startsWith(currentMonth)
    )
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  const todayExpenses = expenses
    .filter(
      (expense) =>
        expense.status === "active" && expense.expense_date === today()
    )
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedExpenses = filteredExpenses.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const openCreate = () => {
    setEditingExpense(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (expense.status !== "active") return;
    setEditingExpense(expense);
    setForm({
      expense_date: expense.expense_date,
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingExpense(null);
    setForm(emptyForm());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(form.amount);
    if (!form.expense_date || !form.category.trim() || !form.description.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an expense amount greater than zero.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Your administrator session has expired. Please log in again.");

      const payload = {
        expense_date: form.expense_date,
        category: form.category.trim(),
        description: form.description.trim(),
        amount: Number(amount.toFixed(2)),
        updated_by: user.id,
      };

      if (editingExpense) {
        const { error: updateError } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpense.id)
          .eq("status", "active");

        if (updateError) throw updateError;
        setSuccess("Expense updated successfully.");
      } else {
        const { error: insertError } = await supabase.from("expenses").insert({
          ...payload,
          created_by: user.id,
          status: "active",
        });

        if (insertError) throw insertError;
        setSuccess("Expense recorded successfully.");
      }

      setFormOpen(false);
      setEditingExpense(null);
      setForm(emptyForm());
      await loadExpenses();
    } catch (err) {
      console.error("Saving expense failed:", err);
      setError(
        err instanceof Error ? err.message : "Unable to save the expense."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!voidingExpense) return;
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Your administrator session has expired. Please log in again.");

      const { error: updateError } = await supabase
        .from("expenses")
        .update({ status: "voided", updated_by: user.id })
        .eq("id", voidingExpense.id)
        .eq("status", "active");

      if (updateError) throw updateError;

      setSuccess(`Expense "${voidingExpense.description}" was voided.`);
      setVoidingExpense(null);
      await loadExpenses();
    } catch (err) {
      console.error("Voiding expense failed:", err);
      setError(
        err instanceof Error ? err.message : "Unable to void the expense."
      );
    }
  };

  const exportCSV = () => {
    const rows = [
      ["ZATRO LAUNDRY SHOP - EXPENSE REPORT"],
      ["Generated", new Date().toLocaleString("en-PH")],
      [],
      ["Expense Date", "Category", "Description", "Amount (PHP)", "Status"],
      ...filteredExpenses.map((expense) => [
        expense.expense_date,
        expense.category,
        expense.description,
        Number(expense.amount).toFixed(2),
        expense.status,
      ]),
      [],
      ["Active Expense Total", totalActiveExpenses.toFixed(2)],
    ];

    const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ZATRO-Expenses-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Expense Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record, review, and manage the laundry shop's operating expenses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadExpenses()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCSV}
            disabled={loading || filteredExpenses.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={17} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#142B4A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
          >
            <Plus size={18} />
            Add Expense
          </button>
        </div>
      </div>

      {error && !formOpen && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto text-emerald-600 hover:text-emerald-800"
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Filtered Active Expenses"
          amount={totalActiveExpenses}
          subtitle={`${activeFilteredExpenses.length} active records in current view`}
          icon={Wallet}
        />
        <SummaryCard
          title="This Month"
          amount={monthlyExpenses}
          subtitle="Active expenses for the current month"
          icon={CalendarDays as typeof Wallet}
        />
        <SummaryCard
          title="Today"
          amount={todayExpenses}
          subtitle="Active expenses recorded today"
          icon={Receipt as typeof Wallet}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-slate-800">Expense Records</h2>
              <p className="mt-1 text-xs text-slate-500">
                Voided records remain visible for audit purposes and are excluded from totals.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {filteredExpenses.length} matching records
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search category or description..."
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All categories</option>
              {Array.from(new Set(expenses.map((item) => item.category)))
                .sort()
                .map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | ExpenseStatus)
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="voided">Voided</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="whitespace-nowrap">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="whitespace-nowrap">To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Expense Date</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
                    Loading expense records...
                  </td>
                </tr>
              ) : paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    <Receipt className="mx-auto mb-2 text-slate-300" size={26} />
                    No expense records found.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-700">
                      {expense.category}
                    </td>
                    <td className="max-w-[320px] px-5 py-3 text-slate-600">
                      <span className="line-clamp-2">{expense.description}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(Number(expense.amount))}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          expense.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {expense.status === "active" ? "Active" : "Voided"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {expense.status === "active" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(expense)}
                              title="Edit expense"
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-700"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setVoidingExpense(expense)}
                              title="Void expense"
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Ban size={15} />
                            </button>
                          </>
                        ) : (
                          <span className="pr-2 text-xs text-slate-400">
                            No actions
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && filteredExpenses.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-right font-bold text-slate-700">
                    Active expenses in filtered results
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-rose-700">
                    {formatCurrency(totalActiveExpenses)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filteredExpenses.length === 0
                ? 0
                : (safePage - 1) * PAGE_SIZE + 1}
              -
              {Math.min(safePage * PAGE_SIZE, filteredExpenses.length)}
            </span>{" "}
            of {filteredExpenses.length} records · 10 rows per page
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="min-w-[100px] text-center text-xs font-medium text-slate-600">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={safePage >= totalPages}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingExpense ? "Edit Expense" : "Record New Expense"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter the expense details below.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Expense Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.expense_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expense_date: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Category <span className="text-rose-600">*</span>
                </label>
                <input
                  list="expense-category-options"
                  required
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="Select or type a category"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <datalist id="expense-category-options">
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Description <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe what the expense was for..."
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Amount (PHP) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₱
                  </span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#142B4A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingExpense
                      ? "Save Changes"
                      : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {voidingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Ban size={21} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800">
              Void this expense?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              You are about to void{" "}
              <span className="font-semibold text-slate-700">
                {voidingExpense.description}
              </span>{" "}
              ({formatCurrency(Number(voidingExpense.amount))}). It will remain
              in the records but will no longer be included in expense totals.
            </p>
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setVoidingExpense(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleVoid()}
                className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
