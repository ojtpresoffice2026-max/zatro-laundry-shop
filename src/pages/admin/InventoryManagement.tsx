
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Search,
  Package,
  Plus,
  Pencil,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  History,
  Boxes,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

type InventoryItem = {
  id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type InventoryTransaction = {
  id: string;
  inventory_item_id: string;
  order_id: string | null;
  performed_by: string | null;
  transaction_type: string;
  quantity: number;
  remarks: string | null;
  created_at: string;
};

type TransactionRecord = InventoryTransaction & {
  item_name: string;
  performed_by_name: string;
};

type ItemForm = {
  item_name: string;
  description: string;
  quantity: string;
  unit: string;
  reorder_level: string;
};

const initialForm: ItemForm = {
  item_name: "",
  description: "",
  quantity: "0",
  unit: "pcs",
  reorder_level: "5",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const units = [
  "pcs",
  "kg",
  "g",
  "L",
  "mL",
  "bottle",
  "pack",
  "box",
  "roll",
];

export default function InventoryManagement() {
  const { user } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [editingItem, setEditingItem] =
    useState<InventoryItem | null>(null);

  const [selectedItem, setSelectedItem] =
    useState<InventoryItem | null>(null);

  const [stockType, setStockType] = useState<"stock_in" | "stock_out">(
    "stock_in"
  );

  const [form, setForm] = useState<ItemForm>(initialForm);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockRemarks, setStockRemarks] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        { data: itemData, error: itemError },
        { data: transactionData, error: transactionError },
        { data: profileData, error: profileError },
      ] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("*")
          .order("item_name", { ascending: true }),

        supabase
          .from("inventory_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("profiles")
          .select("id, full_name"),
      ]);

      if (itemError) throw itemError;
      if (transactionError) throw transactionError;
      if (profileError) throw profileError;

      const inventoryItems = (itemData || []) as InventoryItem[];
      const inventoryTransactions =
        (transactionData || []) as InventoryTransaction[];

      const profileMap = new Map(
        (profileData || []).map((profile) => [
          profile.id,
          profile.full_name,
        ])
      );

      const itemMap = new Map(
        inventoryItems.map((item) => [
          item.id,
          item.item_name,
        ])
      );

      const transactionRecords: TransactionRecord[] =
        inventoryTransactions.map((transaction) => ({
          ...transaction,
          item_name:
            itemMap.get(transaction.inventory_item_id) ||
            "Deleted inventory item",
          performed_by_name: transaction.performed_by
            ? profileMap.get(transaction.performed_by) ||
              "Unknown user"
            : "System",
        }));

      setItems(inventoryItems);
      setTransactions(transactionRecords);
    } catch (err) {
      console.error("Inventory loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load inventory."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  // Inventory Statistics
  const activeItems = items.filter((item) => item.is_active);

  const lowStockItems = activeItems.filter(
    (item) =>
      Number(item.quantity) > 0 &&
      Number(item.quantity) <= Number(item.reorder_level)
  );

  const outOfStockItems = activeItems.filter(
    (item) => Number(item.quantity) <= 0
  );

  const totalItems = items.length;

  // Search and filtering
  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        item.item_name.toLowerCase().includes(searchValue) ||
        (item.description || "").toLowerCase().includes(searchValue);

      let matchesStatus = true;

      if (statusFilter === "active") {
        matchesStatus = item.is_active;
      } else if (statusFilter === "inactive") {
        matchesStatus = !item.is_active;
      } else if (statusFilter === "low") {
        matchesStatus =
          item.is_active &&
          Number(item.quantity) > 0 &&
          Number(item.quantity) <= Number(item.reorder_level);
      } else if (statusFilter === "out") {
        matchesStatus =
          item.is_active && Number(item.quantity) <= 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  // Open Add Item Modal
  const openAddModal = () => {
    setEditingItem(null);
    setForm(initialForm);
    setError("");
    setItemModalOpen(true);
  };

  // Open Edit Item Modal
  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);

    setForm({
      item_name: item.item_name,
      description: item.description || "",
      quantity: String(item.quantity),
      unit: item.unit,
      reorder_level: String(item.reorder_level),
    });

    setError("");
    setItemModalOpen(true);
  };

  const closeItemModal = () => {
    if (saving) return;

    setItemModalOpen(false);
    setEditingItem(null);
    setForm(initialForm);
    setError("");
  };

  // Save New or Updated Item
  const handleSaveItem = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const quantity = Number(form.quantity);
    const reorderLevel = Number(form.reorder_level);

    if (!form.item_name.trim()) {
      setError("Please enter an inventory item name.");
      return;
    }

    if (!form.unit.trim()) {
      setError("Please select an item unit.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(reorderLevel) ||
      quantity < 0 ||
      reorderLevel < 0
    ) {
      setError("Quantity and reorder level must be valid non-negative numbers.");
      return;
    }

    setSaving(true);

    try {
      if (editingItem) {
        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({
            item_name: form.item_name.trim(),
            description: form.description.trim() || null,
            unit: form.unit,
            reorder_level: reorderLevel,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingItem.id);

        if (updateError) throw updateError;

        // Quantity is changed only through stock transactions.
        setSuccess("Inventory item updated successfully.");
      } else {
        const { data: newItem, error: insertError } = await supabase
          .from("inventory_items")
          .insert({
            item_name: form.item_name.trim(),
            description: form.description.trim() || null,
            quantity,
            unit: form.unit,
            reorder_level: reorderLevel,
            is_active: true,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Record initial stock as a transaction.
        if (quantity > 0 && newItem) {
          const { error: transactionError } = await supabase
            .from("inventory_transactions")
            .insert({
              inventory_item_id: newItem.id,
              performed_by: user?.id || null,
              transaction_type: "stock_in",
              quantity,
              remarks: "Initial inventory stock",
            });

          if (transactionError) {
            throw new Error(
              `Item was created, but its initial stock transaction failed: ${transactionError.message}`
            );
          }
        }

        setSuccess("Inventory item added successfully.");
      }

      setItemModalOpen(false);
      setEditingItem(null);
      setForm(initialForm);

      await loadInventory();
    } catch (err) {
      console.error("Saving inventory item failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save inventory item."
      );
    } finally {
      setSaving(false);
    }
  };

  // Open Stock In / Stock Out Modal
  const openStockModal = (
    item: InventoryItem,
    type: "stock_in" | "stock_out"
  ) => {
    setSelectedItem(item);
    setStockType(type);
    setStockQuantity("");
    setStockRemarks("");
    setError("");
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    if (saving) return;

    setStockModalOpen(false);
    setSelectedItem(null);
    setStockQuantity("");
    setStockRemarks("");
    setError("");
  };

  // Record Stock Movement
  const handleStockTransaction = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedItem) {
      setError("Please select an inventory item.");
      return;
    }

    const quantity = Number(stockQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a valid quantity greater than zero.");
      return;
    }

    const currentQuantity = Number(selectedItem.quantity);

    if (
      stockType === "stock_out" &&
      quantity > currentQuantity
    ) {
      setError(
        `Insufficient stock. Available quantity: ${currentQuantity} ${selectedItem.unit}.`
      );
      return;
    }

    const newQuantity =
      stockType === "stock_in"
        ? currentQuantity + quantity
        : currentQuantity - quantity;

    setSaving(true);

    try {
      // Update current stock quantity.
      const { data: updatedItem, error: updateError } =
        await supabase
          .from("inventory_items")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedItem.id)
          .eq("quantity", currentQuantity)
          .select("id")
          .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedItem) {
        throw new Error(
          "The stock quantity has changed. Refresh the inventory and try again."
        );
      }

      // Record the stock movement.
      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          inventory_item_id: selectedItem.id,
          performed_by: user?.id || null,
          transaction_type: stockType,
          quantity,
          remarks: stockRemarks.trim() || null,
        });

      if (transactionError) {
        // Attempt to restore the previous quantity if transaction
        // logging fails. A database RPC is preferable for atomicity.
        const { error: rollbackError } = await supabase
          .from("inventory_items")
          .update({
            quantity: currentQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedItem.id)
          .eq("quantity", newQuantity);

        if (rollbackError) {
          throw new Error(
            `Stock was updated, but transaction logging and automatic rollback both failed. Please inspect this item. Transaction error: ${transactionError.message}`
          );
        }

        throw transactionError;
      }

      setStockModalOpen(false);
      setSelectedItem(null);
      setStockQuantity("");
      setStockRemarks("");

      setSuccess(
        `${stockType === "stock_in" ? "Stock added" : "Stock deducted"} successfully. New quantity: ${newQuantity} ${selectedItem.unit}.`
      );

      await loadInventory();
    } catch (err) {
      console.error("Stock transaction failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to process stock transaction."
      );
    } finally {
      setSaving(false);
    }
  };

  // Activate / Deactivate Inventory Item
  const handleToggleStatus = async (item: InventoryItem) => {
    const action = item.is_active ? "deactivate" : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${item.item_name}?`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({
          is_active: !item.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      setSuccess(
        `${item.item_name} ${action}d successfully.`
      );

      await loadInventory();
    } catch (err) {
      console.error("Inventory status update failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update inventory status."
      );
    }
  };

  const openHistory = () => {
    setHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Inventory Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage laundry supplies and monitor stock movements.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openHistory}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <History size={18} />
            Transaction History
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Item
          </button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} />
          <span>{success}</span>

          <button
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && !itemModalOpen && !stockModalOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} />
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

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Items
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-800">
                {totalItems}
              </h2>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Active Items
              </p>

              <h2 className="mt-2 text-2xl font-bold text-green-600">
                {activeItems.length}
              </h2>
            </div>

            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <Boxes size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Low Stock
              </p>

              <h2 className="mt-2 text-2xl font-bold text-amber-600">
                {lowStockItems.length}
              </h2>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Out of Stock
              </p>

              <h2 className="mt-2 text-2xl font-bold text-red-600">
                {outOfStockItems.length}
              </h2>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-red-600">
              <Package size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Warning */}
      {lowStockItems.length + outOfStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-amber-600"
          />

          <div>
            <p className="text-sm font-semibold text-amber-800">
              Inventory Stock Alert
            </p>

            <p className="mt-1 text-xs text-amber-700">
              {outOfStockItems.length} item(s) are out of stock and{" "}
              {lowStockItems.length} item(s) are at or below their
              reorder level.
            </p>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Table Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">
              Inventory Items
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Manage available laundry supplies.
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
                placeholder="Search inventory..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All Items</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>

            <button
              onClick={() => void loadInventory()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
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
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Reorder Level</th>
                <th className="px-6 py-4">Stock Status</th>
                <th className="px-6 py-4">Availability</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2
                      size={26}
                      className="mx-auto animate-spin text-blue-600"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      Loading inventory...
                    </p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Package
                      size={36}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 font-semibold text-slate-700">
                      No inventory items found
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Add your first inventory item to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const quantity = Number(item.quantity);
                  const reorderLevel = Number(item.reorder_level);

                  const isOut = quantity <= 0;
                  const isLow =
                    !isOut && quantity <= reorderLevel;

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                            <Package size={20} />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.item_name}
                            </p>

                            <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                              {item.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">
                          {quantity}
                        </span>

                        <span className="ml-1 text-xs text-slate-400">
                          {item.unit}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {reorderLevel} {item.unit}
                      </td>

                      <td className="px-6 py-4">
                        {isOut ? (
                          <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                            Low Stock
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                            In Stock
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            item.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              openStockModal(item, "stock_in")
                            }
                            disabled={!item.is_active}
                            title="Stock In"
                            aria-label={`Stock in ${item.item_name}`}
                            className="rounded-lg p-2 text-green-600 transition hover:bg-green-50 disabled:opacity-40"
                          >
                            <ArrowDownToLine size={17} />
                          </button>

                          <button
                            onClick={() =>
                              openStockModal(item, "stock_out")
                            }
                            disabled={!item.is_active || quantity <= 0}
                            title="Stock Out"
                            aria-label={`Stock out ${item.item_name}`}
                            className="rounded-lg p-2 text-amber-600 transition hover:bg-amber-50 disabled:opacity-40"
                          >
                            <ArrowUpFromLine size={17} />
                          </button>

                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit Item"
                            aria-label={`Edit ${item.item_name}`}
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            onClick={() => void handleToggleStatus(item)}
                            title={
                              item.is_active
                                ? "Deactivate Item"
                                : "Activate Item"
                            }
                            aria-label={`${
                              item.is_active ? "Deactivate" : "Activate"
                            } ${item.item_name}`}
                            className={`rounded-lg p-2 transition ${
                              item.is_active
                                ? "text-red-500 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {item.is_active ? (
                              <Trash2 size={17} />
                            ) : (
                              <CheckCircle2 size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          Showing {filteredItems.length} of {items.length} inventory items
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Enter the inventory item information.
                </p>
              </div>

              <button
                onClick={closeItemModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close item modal"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveItem}
              className="space-y-4 p-6"
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Item Name
                </label>

                <input
                  type="text"
                  required
                  value={form.item_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      item_name: event.target.value,
                    })
                  }
                  placeholder="e.g. Laundry Detergent"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Enter item description..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {editingItem ? "Current Quantity" : "Initial Quantity"}
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantity}
                    disabled={Boolean(editingItem)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        quantity: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                  />

                  {editingItem && (
                    <p className="mt-1 text-xs text-slate-400">
                      Use Stock In or Stock Out to change quantity.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Unit
                  </label>

                  <select
                    value={form.unit}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        unit: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reorder Level
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.reorder_level}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      reorder_level: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />

                <p className="mt-1 text-xs text-slate-400">
                  The system will flag this item when its quantity
                  reaches this level or lower.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeItemModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 size={16} className="animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : editingItem
                      ? "Save Changes"
                      : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In / Stock Out Modal */}
      {stockModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {stockType === "stock_in" ? "Stock In" : "Stock Out"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedItem.item_name}
                </p>
              </div>

              <button
                onClick={closeStockModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close stock modal"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleStockTransaction}
              className="space-y-5 p-6"
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Current Available Stock
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {Number(selectedItem.quantity)} {selectedItem.unit}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Quantity ({selectedItem.unit})
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={stockQuantity}
                  onChange={(event) =>
                    setStockQuantity(event.target.value)
                  }
                  placeholder="Enter quantity"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Remarks
                </label>

                <textarea
                  rows={3}
                  value={stockRemarks}
                  onChange={(event) =>
                    setStockRemarks(event.target.value)
                  }
                  placeholder={
                    stockType === "stock_in"
                      ? "e.g. New supply purchase"
                      : "e.g. Used for daily laundry operations"
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div
                className={`rounded-xl p-4 ${
                  stockType === "stock_in"
                    ? "bg-green-50"
                    : "bg-amber-50"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    stockType === "stock_in"
                      ? "text-green-800"
                      : "text-amber-800"
                  }`}
                >
                  {stockType === "stock_in"
                    ? "Stock will be added"
                    : "Stock will be deducted"}
                </p>

                <p
                  className={`mt-1 text-xs ${
                    stockType === "stock_in"
                      ? "text-green-700"
                      : "text-amber-700"
                  }`}
                >
                  {stockType === "stock_in"
                    ? "The recorded quantity will increase your available inventory."
                    : "The recorded quantity will be deducted from available inventory."}
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeStockModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    stockType === "stock_in"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {saving && (
                    <Loader2 size={16} className="animate-spin" />
                  )}

                  {saving
                    ? "Processing..."
                    : stockType === "stock_in"
                      ? "Add Stock"
                      : "Deduct Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Inventory Transaction History
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Recent stock movements, up to 100 records.
                </p>
              </div>

              <button
                onClick={() => setHistoryModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close transaction history"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full min-w-[750px] text-left">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-xs font-semibold uppercase text-slate-500">
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Transaction</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Performed By</th>
                    <th className="px-5 py-4">Remarks</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        No inventory transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {formatDate(transaction.created_at)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {transaction.item_name}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              transaction.transaction_type === "stock_in"
                                ? "bg-green-50 text-green-700"
                                : transaction.transaction_type === "stock_out"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {transaction.transaction_type
                              .replaceAll("_", " ")
                              .replace(/\b\w/g, (char) =>
                                char.toUpperCase()
                              )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {Number(transaction.quantity)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {transaction.performed_by_name}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {transaction.remarks || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 p-5">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
