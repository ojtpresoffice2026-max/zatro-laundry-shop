
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  Power,
  RefreshCw,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, avatar_url, is_active, created_at"
      )
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Customer loading failed:", fetchError);
      setError(fetchError.message);
      setCustomers([]);
    } else {
      setCustomers((data || []) as Customer[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        customer.full_name.toLowerCase().includes(searchValue) ||
        customer.email.toLowerCase().includes(searchValue) ||
        (customer.phone || "").toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && customer.is_active) ||
        (statusFilter === "inactive" && !customer.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const activeCount = customers.filter(
    (customer) => customer.is_active
  ).length;

  const inactiveCount = customers.length - activeCount;

  const handleToggleStatus = async (customer: Customer) => {
    const action = customer.is_active ? "deactivate" : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${customer.full_name}'s account?`
    );

    if (!confirmed) return;

    setUpdatingId(customer.id);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: !customer.is_active })
      .eq("id", customer.id)
      .eq("role", "customer");

    if (updateError) {
      console.error("Customer status update failed:", updateError);
      setError(updateError.message);
      setUpdatingId(null);
      return;
    }

    setCustomers((previous) =>
      previous.map((item) =>
        item.id === customer.id
          ? { ...item, is_active: !customer.is_active }
          : item
      )
    );

    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer({
        ...customer,
        is_active: !customer.is_active,
      });
    }

    setSuccess(
      `${customer.full_name}'s account has been ${action}d successfully.`
    );

    setUpdatingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Customer Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage customers registered with Zatro Laundry Shop.
          </p>
        </div>

        <button
          onClick={() => void loadCustomers()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Dismiss message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Customers</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-800">
                {customers.length}
              </h2>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Active Customers</p>
              <h2 className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </h2>
            </div>
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Inactive Customers</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-500">
                {inactiveCount}
              </h2>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
              <UserRound size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">
              Registered Customers
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Customer accounts stored in your database
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All Customers</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact Number</th>
                <th className="px-6 py-4">Date Registered</th>
                <th className="px-6 py-4">Account Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Loader2
                      size={25}
                      className="mx-auto animate-spin text-blue-600"
                    />
                    <p className="mt-3 text-sm text-slate-500">
                      Loading customer records...
                    </p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Users
                      size={36}
                      className="mx-auto text-slate-300"
                    />
                    <p className="mt-3 font-semibold text-slate-700">
                      No customers found
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Try another search or wait for customers to register.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {customer.avatar_url ? (
                          <img
                            src={customer.avatar_url}
                            alt={customer.full_name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                            {customer.full_name
                              ?.charAt(0)
                              .toUpperCase() || "C"}
                          </div>
                        )}

                        <div>
                          <p className="font-semibold text-slate-800">
                            {customer.full_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {customer.phone || "Not provided"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(customer.created_at)}
                    </td>

                    <td className="px-6 py-4">
                      {customer.is_active ? (
                        <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          title="View customer"
                          aria-label={`View ${customer.full_name}`}
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                        >
                          <Eye size={17} />
                        </button>

                        <button
                          onClick={() => void handleToggleStatus(customer)}
                          disabled={updatingId === customer.id}
                          title={
                            customer.is_active
                              ? "Deactivate customer"
                              : "Activate customer"
                          }
                          aria-label={`${
                            customer.is_active ? "Deactivate" : "Activate"
                          } ${customer.full_name}`}
                          className={`rounded-lg p-2 transition disabled:opacity-50 ${
                            customer.is_active
                              ? "text-red-500 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {updatingId === customer.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <Power size={17} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          Showing {filteredCustomers.length} of {customers.length} customers
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCustomer(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Customer Details
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Customer account information
                </p>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 flex flex-col items-center text-center">
                {selectedCustomer.avatar_url ? (
                  <img
                    src={selectedCustomer.avatar_url}
                    alt={selectedCustomer.full_name}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-700">
                    {selectedCustomer.full_name
                      ?.charAt(0)
                      .toUpperCase() || "C"}
                  </div>
                )}

                <h3 className="mt-3 text-lg font-bold text-slate-800">
                  {selectedCustomer.full_name}
                </h3>

                <span
                  className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedCustomer.is_active
                      ? "bg-green-50 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {selectedCustomer.is_active ? "Active Account" : "Inactive Account"}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail size={18} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Email Address</p>
                    <p className="break-all text-sm font-medium text-slate-700">
                      {selectedCustomer.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone size={18} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Phone Number</p>
                    <p className="text-sm font-medium text-slate-700">
                      {selectedCustomer.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={18}
                    className="mt-0.5 text-slate-400"
                  />
                  <div>
                    <p className="text-xs text-slate-400">Registration Date</p>
                    <p className="text-sm font-medium text-slate-700">
                      {formatDate(selectedCustomer.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex gap-3 border-t border-slate-100 pt-5">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  onClick={() => void handleToggleStatus(selectedCustomer)}
                  disabled={updatingId === selectedCustomer.id}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    selectedCustomer.is_active
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {updatingId === selectedCustomer.id
                    ? "Updating..."
                    : selectedCustomer.is_active
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
