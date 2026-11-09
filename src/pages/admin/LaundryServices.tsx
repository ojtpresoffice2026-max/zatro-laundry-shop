
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Pencil,
  Power,
  Shirt,
  X,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type LaundryService = {
  id: string;
  service_name: string;
  description: string | null;
  pricing_type: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ServiceForm = {
  service_name: string;
  description: string;
  pricing_type: string;
  price: string;
};

const emptyForm: ServiceForm = {
  service_name: "",
  description: "",
  pricing_type: "per_load",
  price: "",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

export default function LaundryServices() {
  const [services, setServices] = useState<LaundryService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] =
    useState<LaundryService | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [formCategory, setFormCategory] = useState<"service" | "addon">("service");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serviceToDelete, setServiceToDelete] = useState<LaundryService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("laundry_services")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Unable to load services:", fetchError);
      setError(fetchError.message);
      setServices([]);
    } else {
      setServices((data || []) as LaundryService[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const isAddon = (service: LaundryService) =>
    service.service_name.trim().toUpperCase().startsWith("ADDITIONAL ");

  const filteredServices = services.filter((service) => {
    const searchValue = search.toLowerCase();

    const matchesSearch =
      service.service_name.toLowerCase().includes(searchValue) ||
      (service.description || "").toLowerCase().includes(searchValue);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && service.is_active) ||
      (statusFilter === "inactive" && !service.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCount = services.filter(
    (service) => service.is_active
  ).length;

  const inactiveCount = services.length - activeCount;

  const openAddModal = (category: "service" | "addon") => {
    setEditingService(null);
    setFormCategory(category);
    setForm({ ...emptyForm, pricing_type: category === "addon" ? "per_item" : "per_load" });
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (service: LaundryService) => {
    setEditingService(service);
    const addon = isAddon(service);
    setFormCategory(addon ? "addon" : "service");
    setForm({
      service_name: addon ? service.service_name.replace(/^ADDITIONAL\s+/i, "") : service.service_name,
      description: service.description || "",
      pricing_type: addon ? "per_item" : "per_load",
      price: String(service.price),
    });
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingService(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const enteredName = form.service_name.trim();
    const serviceName = formCategory === "addon"
      ? `ADDITIONAL ${enteredName.replace(/^ADDITIONAL\s+/i, "")}`
      : enteredName.replace(/^ADDITIONAL\s+/i, "");
    const price = Number(form.price);

    if (!enteredName) {
      setError(formCategory === "addon" ? "Please enter an add-on name." : "Please enter a service name.");
      return;
    }

    if (!form.price.trim() || !Number.isFinite(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    setSaving(true);

    const serviceData = {
      service_name: serviceName,
      description: form.description.trim() || null,
      pricing_type: formCategory === "addon" ? "per_item" : "per_load",
      price,
      updated_at: new Date().toISOString(),
    };

    const result = editingService
      ? await supabase
          .from("laundry_services")
          .update(serviceData)
          .eq("id", editingService.id)
          .select()
          .single()
      : await supabase
          .from("laundry_services")
          .insert({
            ...serviceData,
            is_active: true,
          })
          .select()
          .single();

    if (result.error) {
      console.error("Unable to save service:", result.error);
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setEditingService(null);
    setForm(emptyForm);

    setSuccess(
      editingService
        ? `${formCategory === "addon" ? "Add-on" : "Laundry service"} updated successfully.`
        : `${formCategory === "addon" ? "Add-on" : "Laundry service"} created successfully.`
    );

    await loadServices();
  };

  const toggleServiceStatus = async (service: LaundryService) => {
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("laundry_services")
      .update({
        is_active: !service.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", service.id);

    if (updateError) {
      console.error("Unable to update service status:", updateError);
      setError(updateError.message);
      return;
    }

    setSuccess(
      service.is_active
        ? "Service deactivated successfully."
        : "Service activated successfully."
    );

    await loadServices();
  };

  const deleteService = async () => {
    if (!serviceToDelete || deleting) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("laundry_services")
      .delete()
      .eq("id", serviceToDelete.id);

    if (deleteError) {
      console.error("Unable to delete service:", deleteError);
      setError(
        deleteError.code === "23503"
          ? "This service is already used in one or more laundry orders. It cannot be permanently deleted. Deactivate it instead to preserve order history."
          : deleteError.message
      );
      setDeleting(false);
      setServiceToDelete(null);
      return;
    }

    const deletedName = serviceToDelete.service_name;
    setDeleting(false);
    setServiceToDelete(null);
    setSuccess(`"${deletedName}" was deleted successfully.`);
    await loadServices();
  };

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Laundry Services
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the laundry services and pricing offered by Zatro.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => openAddModal("service")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add New Service
          </button>
          <button
            onClick={() => openAddModal("addon")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <Plus size={18} />
            Add New Add-on
          </button>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {success}
          <button
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {error && !modalOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error message"
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
              <p className="text-sm text-slate-500">Total Services</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-800">
                {services.length}
              </h2>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Shirt size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Active Services</p>
              <h2 className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </h2>
            </div>
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <CheckCircle2 size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Inactive Services</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-500">
                {inactiveCount}
              </h2>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
              <Power size={23} />
            </div>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Search and Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search services..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">All Services</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              onClick={() => void loadServices()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4">Offer Type</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
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
                      Loading laundry services...
                    </p>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Shirt
                      size={35}
                      className="mx-auto text-slate-300"
                    />
                    <p className="mt-3 font-semibold text-slate-700">
                      No services found
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {search || statusFilter !== "all"
                        ? "Try changing your search or filter."
                        : "Add your first laundry service to get started."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr
                    key={service.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">
                        {service.service_name}
                      </p>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                        {service.description || "No description provided"}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                        {isAddon(service) ? "Optional Add-on" : "Laundry Offer"}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {formatCurrency(Number(service.price))}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {isAddon(service) ? "/ item" : "/ 8 kg load"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {service.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(service)}
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                          title="Edit service"
                          aria-label={`Edit ${service.service_name}`}
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => void toggleServiceStatus(service)}
                          className={`rounded-lg p-2 transition ${
                            service.is_active
                              ? "text-red-500 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                          title={
                            service.is_active
                              ? "Deactivate service"
                              : "Activate service"
                          }
                          aria-label={`${
                            service.is_active ? "Deactivate" : "Activate"
                          } ${service.service_name}`}
                        >
                          <Power size={17} />
                        </button>

                        <button
                          onClick={() => {
                            setError("");
                            setServiceToDelete(service);
                          }}
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                          title="Delete service"
                          aria-label={`Delete ${service.service_name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {!loading && (
          <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
            Showing {filteredServices.length} of {services.length} services
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-service-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 id="delete-service-title" className="text-lg font-bold text-slate-800">
                  Delete Laundry Service?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Are you sure you want to delete <strong>{serviceToDelete.service_name}</strong>?
                  This permanently removes the service from the service catalog. Existing
                  laundry orders will keep their saved service name, quantity, unit price,
                  and subtotal.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteService()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                {deleting ? "Deleting..." : "Delete Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingService ? `Edit ${formCategory === "addon" ? "Add-on" : "Laundry Service"}` : `Add ${formCategory === "addon" ? "Add-on" : "Laundry Service"}`}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter the service information and pricing.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {formCategory === "addon" ? "Add-on Name" : "Service Name"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.service_name}
                  onChange={(event) =>
                    setForm({ ...form, service_name: event.target.value })
                  }
                  placeholder={formCategory === "addon" ? "e.g. Soap" : "e.g. Laundry with soap and fabcon included"}
                  required
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder={formCategory === "addon" ? "Describe this optional add-on..." : "Describe what this laundry service includes..."}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Pricing Type
                </label>
                <select
                  value={form.pricing_type}
                  onChange={(event) =>
                    setForm({ ...form, pricing_type: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {formCategory === "addon" ? <option value="per_item">Per Item</option> : <option value="per_load">Per Load (8 kg)</option>}
                </select>
                <p className="mt-1.5 text-xs text-slate-400">
                  {formCategory === "addon" ? "Enter the price for each additional item." : "One load is equivalent to 8 kilograms. Enter the price for one complete load."}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Price (PHP) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                    ₱
                  </span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: event.target.value })
                    }
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                    className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingService
                      ? "Save Changes"
                      : formCategory === "addon" ? "Create Add-on" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
