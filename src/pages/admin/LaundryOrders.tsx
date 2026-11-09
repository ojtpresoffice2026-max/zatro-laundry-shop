
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  X,
  Package,
  AlertCircle,
  Printer,
  ShoppingBasket,
  WashingMachine,
  CheckCircle2,
  ScanLine,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";

import { format } from "date-fns";
import { supabase } from "../../lib/supabase";

// =====================================================
// TYPES
// =====================================================

type OrderStatus = "in_shop" | "completed";

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Service {
  id: string;
  service_name: string;
  description: string | null;
  pricing_type: string;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  processed_by: string | null;
  status: OrderStatus;
  total_amount: number;
  special_instructions: string | null;
  completed_at: string | null;
  created_at: string;
  customer_name: string;
  customer_email: string;
  paid_amount: number;
  balance_due: number;
}

interface OrderItem {
  id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface NewOrderItem {
  service_id: string;
  quantity: number;
}

interface OrderCreationNotice {
  orderId: string;
  customerName: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const statusStyles: Record<OrderStatus, string> = {
  in_shop: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);

const readableStatus = (status: string) =>
  status.replaceAll("_", " ").replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const dbError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      dbError.message,
      dbError.details,
      dbError.hint,
      dbError.code ? `Code: ${dbError.code}` : undefined,
    ].filter((part): part is string => Boolean(part));

    if (parts.length > 0) return parts.join(" | ");
  }

  return typeof error === "string" ? error : "An unexpected error occurred.";
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function LaundryOrders() {
  // Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Page controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [showScanner, setShowScanner] = useState(false);
  const [pickupOrder, setPickupOrder] = useState<Order | null>(null);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creationNotice, setCreationNotice] = useState<OrderCreationNotice | null>(null);
  const [printingCreatedReceipt, setPrintingCreatedReceipt] = useState(false);

  const isAlreadyPickedUpNotice = /has already been picked up\.$/i.test(error);

  // Automatically dismiss centered system notifications.
  useEffect(() => {
    if (!error && !success) return;
    const timeout = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [error, success]);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  // Order details
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Create order form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [newItems, setNewItems] = useState<NewOrderItem[]>([
    { service_id: "", quantity: 1 },
  ]);
  const [newAddons, setNewAddons] = useState<NewOrderItem[]>([]);

  const laundryServices = services.filter(
    (service) => !service.service_name.toUpperCase().startsWith("ADDITIONAL ")
  );
  const addonServices = services.filter(
    (service) => service.service_name.toUpperCase().startsWith("ADDITIONAL ")
  );

  const [instructions, setInstructions] = useState("");

  // Keep the order-created panel open until the admin closes it so there is
  // enough time to review the order and print its receipt.

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [
        ordersResult,
        customersResult,
        servicesResult,
        paymentsResult,
      ] = await Promise.all([
        supabase
          .from("laundry_orders")
          .select(
            "id, order_number, customer_id, processed_by, status, total_amount, special_instructions, completed_at, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("customers")
          .select("id, full_name, phone")
          .order("full_name"),

        supabase
          .from("laundry_services")
          .select(
            "id, service_name, description, pricing_type, price"
          )
          .eq("is_active", true)
          .order("service_name"),

        supabase
          .from("payments")
          .select("order_id, amount, payment_status, paid_at"),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (customersResult.error) throw customersResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const paidByOrder = new Map<string, number>();
      (paymentsResult.data ?? []).forEach((payment) => {
        if (String(payment.payment_status).toLowerCase() === "verified" && payment.paid_at) {
          paidByOrder.set(
            payment.order_id,
            (paidByOrder.get(payment.order_id) ?? 0) + Number(payment.amount)
          );
        }
      });

      const customerList = customersResult.data ?? [];

      const customerMap = new Map(
        customerList.map((customer) => [
          customer.id,
          customer,
        ])
      );

      const mappedOrders: Order[] = (
        ordersResult.data ?? []
      ).map((order) => {
        const customer = customerMap.get(order.customer_id);

        return {
          ...order,
          status: order.status === "completed" ? "completed" : "in_shop",
          total_amount: Number(order.total_amount),
          paid_amount: paidByOrder.get(order.id) ?? 0,
          balance_due: Math.max(Number(order.total_amount) - (paidByOrder.get(order.id) ?? 0), 0),
          customer_name:
            customer?.full_name ?? "Unknown Customer",
          customer_email: customer?.phone ?? "",
        };
      });

      setOrders(mappedOrders);
      setCustomers(customerList);

      setServices(
        (servicesResult.data ?? []).map((service) => ({
          ...service,
          price: Number(service.price),
        }))
      );
    } catch (err) {
      console.error("Laundry orders loading error:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // =====================================================
  // FILTER ORDERS
  // =====================================================

  const filteredOrders = orders.filter((order) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      order.order_number.toLowerCase().includes(searchText) ||
      order.customer_name.toLowerCase().includes(searchText) ||
      order.customer_email.toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const firstRow = filteredOrders.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const lastRow = Math.min(currentPage * rowsPerPage, filteredOrders.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // =====================================================
  // SUMMARY STATISTICS
  // =====================================================

  const totalOrders = orders.length;

  const inShopOrders = orders.filter(
    (order) => order.status === "in_shop"
  ).length;

  const completedOrders = orders.filter(
    (order) => order.status === "completed"
  ).length;

  // =====================================================
  // CREATE ORDER FORM HELPERS
  // =====================================================

  const addItem = () => {
    setNewItems((current) => [
      ...current,
      { service_id: "", quantity: 1 },
    ]);
  };

  const removeItem = (index: number) => {
    setNewItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const updateItem = (
    index: number,
    field: keyof NewOrderItem,
    value: string | number
  ) => {
    setNewItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const addAddon = () => {
    setNewAddons((current) => [
      ...current,
      { service_id: "", quantity: 1 },
    ]);
  };

  const removeAddon = (index: number) => {
    setNewAddons((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const updateAddon = (
    index: number,
    field: keyof NewOrderItem,
    value: string | number
  ) => {
    setNewAddons((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  // =====================================================
  // CALCULATE ORDER TOTAL
  // =====================================================

  const allNewItems = [...newItems, ...newAddons];

  const estimatedTotal = allNewItems.reduce((total, item) => {
    const service = services.find((entry) => entry.id === item.service_id);
    if (!service) return total;
    return total + service.price * item.quantity;
  }, 0);

  // =====================================================
  // CREATE ORDER
  // =====================================================

  const createOrder = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setCreationNotice(null);

    if (!customerName.trim()) {
      setError("Please enter the customer's full name.");
      return;
    }

    if (newItems.length === 0) {
      setError("Please add at least one laundry service.");
      return;
    }

    const invalidItem = allNewItems.some(
      (item) =>
        !item.service_id ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
    );

    if (invalidItem) {
      setError(
        "Select a service or add-on and enter a valid quantity for every selected item."
      );
      return;
    }

    const uniqueServices = new Set(
      allNewItems.map((item) => item.service_id)
    );

    if (uniqueServices.size !== allNewItems.length) {
      setError(
        "Please combine duplicate services into one item."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: orderId, error: createError } =
        await supabase.rpc("create_laundry_order_for_customer", {
          p_customer_name: customerName.trim(),
          p_customer_phone: customerPhone.trim() || null,

          p_items: allNewItems.map((item) => ({
            service_id: item.service_id,
            quantity: item.quantity,
          })),

          p_special_instructions: instructions || null,

          p_estimated_completion: null,
        });

      if (createError) throw createError;
      if (!orderId) {
        throw new Error("The order was created, but no order ID was returned.");
      }

      // Fetch the generated order number and database creation timestamp.
      const { data: createdOrder, error: createdOrderError } = await supabase
        .from("laundry_orders")
        .select("order_number, created_at")
        .eq("id", orderId)
        .single();

      if (createdOrderError) throw createdOrderError;

      setCreationNotice({
        orderId,
        customerName: customerName.trim(),
        orderNumber: createdOrder.order_number,
        createdAt: createdOrder.created_at,
        totalAmount: estimatedTotal,
      });

      setShowCreate(false);
      setCustomerName("");
      setCustomerPhone("");
      setNewItems([{ service_id: "", quantity: 1 }]);
      setNewAddons([]);
      setInstructions("");

      await loadData(true);
    } catch (err) {
      console.error("Create order error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE ORDER (ALL ORDERS; ADMIN CONFIRMATION REQUIRED)
  // =====================================================

  const deleteOrder = async () => {
    if (!orderToDelete) return;

    setDeletingOrder(true);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase.rpc("delete_laundry_order", {
        p_order_id: orderToDelete.id,
      });

      if (deleteError) throw deleteError;

      setSuccess(`${orderToDelete.order_number} was deleted successfully.`);
      if (selectedOrder?.id === orderToDelete.id) setSelectedOrder(null);
      setOrderToDelete(null);
      await loadData(true);
    } catch (err) {
      console.error("Delete laundry order error:", err);
      setError(getErrorMessage(err));
    } finally {
      setDeletingOrder(false);
    }
  };

  // =====================================================
  // VIEW ORDER DETAILS
  // =====================================================

  const viewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setOrderItems([]);
    setLoadingDetails(true);
    setError("");

    try {
      const { data, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, service_name, quantity, unit_price, subtotal"
        )
        .eq("order_id", order.id)
        .order("created_at");

      if (itemsError) throw itemsError;

      setOrderItems(
        (data ?? []).map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        }))
      );
    } catch (err) {
      console.error("Order details error:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoadingDetails(false);
    }
  };

  // =====================================================
  // QR SCANNING AND PICKUP
  // =====================================================

  const openPickup = (order: Order) => {
    if (order.status === "completed") {
      setError(`${order.order_number} has already been picked up.`);
      return;
    }
    setPickupOrder(order);
  };

  const handleQrScan = async (decodedText: string) => {
    // Each order QR contains: ZATRO:ORDER:<laundry_order_uuid>
    const match = decodedText.trim().match(/^ZATRO:ORDER:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    setShowScanner(false);

    if (!match) {
      setError("Invalid QR code. Please scan the QR code printed for this laundry order.");
      return;
    }

    let order = orders.find((entry) => entry.id.toLowerCase() === match[1].toLowerCase());

    // Fetch directly if the order is not in the current page's loaded data.
    if (!order) {
      const { data, error: orderError } = await supabase
        .from("laundry_orders")
        .select("id, order_number, customer_id, processed_by, status, total_amount, special_instructions, completed_at, created_at")
        .eq("id", match[1])
        .maybeSingle();
      if (orderError) {
        setError(orderError.message);
        return;
      }
      if (data) {
        const customer = customers.find((entry) => entry.id === data.customer_id);
        const { data: paymentRows, error: paymentError } = await supabase
          .from("payments")
          .select("amount, payment_status, paid_at")
          .eq("order_id", data.id);
        if (paymentError) {
          setError(paymentError.message);
          return;
        }
        const paid = (paymentRows ?? []).reduce((sum, payment) =>
          String(payment.payment_status).toLowerCase() === "verified" && payment.paid_at
            ? sum + Number(payment.amount) : sum, 0);
        order = {
          ...data,
          status: data.status === "completed" ? "completed" : "in_shop",
          total_amount: Number(data.total_amount),
          paid_amount: paid,
          balance_due: Math.max(Number(data.total_amount) - paid, 0),
          customer_name: customer?.full_name ?? "Customer",
          customer_email: customer?.phone ?? "",
        };
      }
    }

    if (!order) {
      setError("No laundry order matches this QR code. Check that you scanned the correct order tag.");
      return;
    }

    if (order.status === "completed") {
      setError(`${order.order_number} has already been picked up.`);
      return;
    }

    // Scanning an order QR identifies the exact order; no manual order selection.
    openPickup(order);
  };

  useEffect(() => {
    if (!showScanner) return;
    let cancelled = false;
    const scanner = new Html5Qrcode("zatro-customer-qr-reader");
    scannerRef.current = scanner;
    void scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        if (cancelled) return;
        cancelled = true;
        void scanner.stop().catch(() => undefined).finally(() => {
          scanner.clear();
          scannerRef.current = null;
          void handleQrScan(decodedText);
        });
      },
      () => undefined
    ).catch((scanError: unknown) => {
      if (!cancelled) {
        setError(`Unable to start camera: ${getErrorMessage(scanError)}. Allow camera access and try again.`);
        setShowScanner(false);
      }
    });
    return () => {
      cancelled = true;
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => undefined).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
    };
  }, [showScanner]);

  const confirmPickup = async () => {
    if (!pickupOrder) return;
    setPickupSaving(true);
    setError("");
    setSuccess("");
    try {
      const { error: pickupError } = await supabase.rpc("complete_laundry_pickup", {
        p_order_id: pickupOrder.id,
        p_payment_amount: pickupOrder.balance_due,
        p_payment_method: "cash",
      });
      if (pickupError) throw pickupError;
      setSuccess(
        `${pickupOrder.order_number} picked up successfully. Payment and actual pickup date/time have been recorded.`
      );
      setPickupOrder(null);
      await loadData(true);
    } catch (err) {
      console.error("Pickup confirmation error (inspect message, code, details, hint):", err);
      setError(getErrorMessage(err));
    } finally {
      setPickupSaving(false);
    }
  };

  // =====================================================
  // CLOSE CREATE MODAL
  // =====================================================

  const closeCreate = () => {
    if (saving) return;

    setShowCreate(false);
    setCustomerName("");
    setCustomerPhone("");
    setNewItems([{ service_id: "", quantity: 1 }]);
    setNewAddons([]);
    setInstructions("");
    setError("");
  };

  // Print the existing receipt layout inside a hidden iframe.
  // The same receipt is used by both the order-details view and the
  // order-created confirmation panel. No separate about:blank tab is opened.
  const printReceipt = async (
    receiptOrder: Pick<Order, "order_number" | "customer_name" | "created_at" | "total_amount">,
    receiptItems: OrderItem[],
    qrSvg: string,
  ) => {
    if (!qrSvg) {
      setError("The order QR code is not ready. Please close and reopen the panel, then try again.");
      return;
    }

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char);

    const itemRows = receiptItems.map((item) => `
      <div class="item">
        <div class="item-name">
          <strong>${escapeHtml(item.service_name)}</strong>
          <small>${item.quantity} × ${currency(item.unit_price)}</small>
        </div>
        <strong>${currency(item.subtotal)}</strong>
      </div>
    `).join("");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "ZATRO receipt print preview");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    document.body.appendChild(iframe);

    const printDocument = iframe.contentDocument;
    const printWindow = iframe.contentWindow;

    if (!printDocument || !printWindow) {
      iframe.remove();
      setError("Unable to prepare the receipt for printing. Please try again.");
      return;
    }

    const cleanup = () => {
      window.clearTimeout(cleanupTimeout);
      iframe.remove();
    };

    const cleanupTimeout = window.setTimeout(cleanup, 60000);

    printWindow.addEventListener("afterprint", cleanup, { once: true });

    printDocument.open();
    printDocument.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <base href="${window.location.origin}/">
          <title>ZATRO Receipt ${escapeHtml(receiptOrder.order_number)}</title>
          <style>
            @page { size: 80mm 250mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              width: 80mm;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body { padding: 4mm; }
            .receipt { width: 72mm; margin: 0 auto; }
            .brand {
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              font-size: 15pt;
              font-weight: 800;
              letter-spacing: 1px;
              margin: 0 0 1mm;
            }
            .brand-logo {
              display: block;
              width: 22mm;
              height: 22mm;
              object-fit: contain;
              margin: 0 auto 1mm;
            }
            .subtitle {
              text-align: center;
              font-size: 8pt;
              margin: 0 0 3mm;
              color: #444;
            }
            .rule { border: 0; border-top: 1px dashed #777; margin: 3mm 0; }
            .order-number {
              text-align: center;
              font-size: 10pt;
              font-weight: 700;
              margin: 0 0 3mm;
            }
            .qr {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              margin: 0 auto 3mm;
            }
            .qr svg {
              display: block;
              width: 32mm;
              height: 32mm;
              margin: 0 auto 1.5mm;
            }
            .qr small { font-size: 7pt; }
            .meta {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2mm;
              font-size: 8pt;
            }
            .meta p { margin: 0 0 1mm; overflow-wrap: anywhere; }
            .label { color: #555; font-size: 7pt; }
            .section-title { font-size: 9pt; font-weight: 700; margin: 3mm 0 2mm; }
            .item {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 2mm;
              border-bottom: 1px solid #ddd;
              padding: 2mm 0;
              font-size: 8pt;
            }
            .item-name { min-width: 0; }
            .item-name strong { display: block; overflow-wrap: anywhere; }
            .item small { display: block; margin-top: 1mm; color: #555; font-size: 7pt; }
            .total {
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #111;
              margin-top: 3mm;
              padding-top: 3mm;
              font-size: 11pt;
              font-weight: 800;
            }
            .footer { text-align: center; font-size: 7pt; color: #555; margin-top: 5mm; }
            @media print {
              html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; }
              .receipt { width: 72mm !important; margin: 0 auto !important; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <div class="brand">
              <img src="zatro.jpeg" alt="ZATRO Laundry Shop" class="brand-logo">
              <div>ZATRO</div>
            </div>
            <p class="subtitle">LAUNDRY SHOP</p>
            <hr class="rule">
            <p class="order-number">${escapeHtml(receiptOrder.order_number)}</p>
            <div class="qr">${qrSvg}<small>Scan this code to identify this exact order</small></div>
            <hr class="rule">
            <div class="meta">
              <div>
                <p class="label">CUSTOMER</p>
                <p><strong>${escapeHtml(receiptOrder.customer_name)}</strong></p>
              </div>
              <div>
                <p class="label">ORDER DATE &amp; TIME</p>
                <p>${format(new Date(receiptOrder.created_at), "MMM dd, yyyy hh:mm:ss a")}</p>
              </div>
            </div>
            <p class="section-title">ORDER SERVICES</p>
            ${itemRows || "<p>No order items found.</p>"}
            <div class="total">
              <span>TOTAL</span>
              <span>${currency(receiptOrder.total_amount)}</span>
            </div>
            <p class="footer">Thank you for choosing ZATRO!</p>
          </main>
        </body>
      </html>`);
    printDocument.close();

    try {
      // Wait for the receipt logo to finish loading before opening the print dialog.
      const images = Array.from(printDocument.images);
      await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }));

      await new Promise((resolve) => window.setTimeout(resolve, 250));
      printWindow.focus();
      printWindow.print();
    } catch (printError) {
      cleanup();
      console.error("Receipt printing error:", printError);
      setError("Unable to print the receipt. Please check your printer settings and try again.");
    }
  };

  const printOrderReceipt = async () => {
    if (!selectedOrder) return;
    const qrSvg = document.querySelector(".print-order-qr svg")?.outerHTML ?? "";
    await printReceipt(selectedOrder, orderItems, qrSvg);
  };

  const printCreatedOrderReceipt = async () => {
    if (!creationNotice || printingCreatedReceipt) return;

    setPrintingCreatedReceipt(true);
    setError("");
    try {
      const qrSvg = document.querySelector(".creation-order-qr svg")?.outerHTML ?? "";
      if (!qrSvg) throw new Error("The order QR code is not ready. Please try again.");

      const { data, error: itemsError } = await supabase
        .from("order_items")
        .select("id, service_name, quantity, unit_price, subtotal")
        .eq("order_id", creationNotice.orderId)
        .order("created_at");

      if (itemsError) throw itemsError;

      const receiptItems: OrderItem[] = (data ?? []).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      }));

      await printReceipt({
        order_number: creationNotice.orderNumber,
        customer_name: creationNotice.customerName,
        created_at: creationNotice.createdAt,
        total_amount: creationNotice.totalAmount,
      }, receiptItems, qrSvg);
    } catch (err) {
      console.error("New order receipt printing error:", err);
      setError(getErrorMessage(err));
    } finally {
      setPrintingCreatedReceipt(false);
    }
  };


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>

      <div className="space-y-6">

      {/* PAGE HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Laundry Orders
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create, monitor, and manage customer laundry orders.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                refreshing ? "animate-spin" : ""
              }
            />
            Refresh
          </button>

          <button
            onClick={() => { setError(""); setShowScanner(true); }}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            <ScanLine size={17} />
            Scan Order QR
          </button>

          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setCreationNotice(null);
              setShowCreate(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={17} />
            Create Order
          </button>
        </div>
      </div>

      {/* CENTERED SYSTEM NOTIFICATION */}
      {(error || success) && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => { setError(""); setSuccess(""); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className={`relative w-full max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border bg-white p-6 text-center shadow-2xl duration-200 ${error ? "border-red-100" : "border-green-100"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setError(""); setSuccess(""); }}
              aria-label="Close notification"
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            {isAlreadyPickedUpNotice ? (
              <p className="px-2 py-5 text-base font-semibold leading-7 text-slate-800">
                {error}
              </p>
            ) : (
              <>
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${error ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                  {error ? <AlertCircle size={34} /> : <CheckCircle2 size={34} />}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {error ? "Unable to Complete Action" : "Success!"}
                </h3>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {error || success}
                </p>
                <p className="mt-4 text-xs text-slate-400">This message will close automatically.</p>
              </>
            )}
          </div>
        </div>
      )}

      {creationNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-created-title"
            className="w-full max-w-lg animate-in zoom-in-95 rounded-2xl border border-green-100 bg-white p-6 shadow-2xl duration-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 size={36} />
              </div>

              <h3
                id="order-created-title"
                className="mt-4 text-xl font-bold text-slate-900"
              >
                Laundry Order Created!
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                The order has been successfully saved.
              </p>
            </div>

            <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-left">
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-slate-500">Customer</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {creationNotice.customerName}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-slate-500">Order Number</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {creationNotice.orderNumber}
                </span>
              </div>

              <div className="creation-order-qr flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
                <QRCodeSVG value={`ZATRO:ORDER:${creationNotice.orderId}`} size={156} level="H" includeMargin />
                <p className="text-xs font-semibold text-slate-700">Order pickup QR code</p>
                <p className="text-center text-[11px] text-slate-500">Attach this QR code to the customer's laundry tag.</p>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-slate-500">Date</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {format(new Date(creationNotice.createdAt), "MMM dd, yyyy")}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-slate-500">Time</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {format(new Date(creationNotice.createdAt), "hh:mm:ss a")}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-600">Order Total</span>
                <span className="text-base font-bold text-green-700">
                  {currency(creationNotice.totalAmount)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              This confirmation will close automatically.
            </p>

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setCreationNotice(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void printCreatedOrderReceipt()}
                disabled={printingCreatedReceipt}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer size={17} />
                {printingCreatedReceipt ? "Preparing Receipt..." : "Print Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Orders",
            value: totalOrders,
            icon: ShoppingBasket,
            color: "bg-blue-100 text-blue-600",
          },
          {
            label: "In Shop",
            value: inShopOrders,
            icon: WashingMachine,
            color: "bg-cyan-100 text-cyan-600",
          },
          {
            label: "Completed",
            value: completedOrders,
            icon: CheckCircle2,
            color: "bg-green-100 text-green-600",
          },
        ].map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`rounded-xl p-3 ${card.color}`}
                >
                  <Icon size={22} />
                </div>
              </div>

              <p className="mt-5 text-sm text-slate-500">
                {card.label}
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                {card.value.toLocaleString("en-PH")}
              </p>
            </div>
          );
        })}
      </div>

      {/* SEARCH AND FILTER */}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search order number or customer..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="in_shop">In Shop</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* ORDERS TABLE */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-bold text-slate-900">
              All Laundry Orders
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filteredOrders.length} matching order(s)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">

            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">
                  Order Number
                </th>

                <th className="px-5 py-4">
                  Customer
                </th>

                <th className="px-5 py-4">
                  Order Date &amp; Time
                </th>

                <th className="px-5 py-4">
                  Pickup Date &amp; Time
                </th>

                <th className="px-5 py-4">
                  Amount
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center text-sm text-slate-500"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >
                    <Package
                      size={34}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 font-semibold text-slate-700">
                      No laundry orders found
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Create an order or change your search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-800">
                      {order.order_number}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-800">
                        {order.customer_name}
                      </p>

                      <p className="text-xs text-slate-400">
                        {order.customer_email ? `Contact: ${order.customer_email}` : "No contact number"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {format(new Date(order.created_at), "MMM dd, yyyy")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {format(new Date(order.created_at), "hh:mm:ss a")}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {order.status === "completed" && order.completed_at ? (
                        <>
                          <p className="text-sm font-semibold text-green-700">
                            {format(new Date(order.completed_at), "MMM dd, yyyy")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {format(new Date(order.completed_at), "hh:mm:ss a")}
                          </p>
                        </>
                      ) : (
                        <span className="text-sm text-slate-400">Not picked up yet</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-800">
                      {currency(order.total_amount)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                          statusStyles[order.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {readableStatus(order.status)}
                        {order.status === "completed" && (
                          <CheckCircle2 size={14} className="ml-1.5" />
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void viewOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        {order.status === "in_shop" && (
                          <button
                            onClick={() => openPickup(order)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            <CheckCircle2 size={14} />
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOrderToDelete(order)}
                          title="Permanently delete this order and its related records"
                          aria-label={`Delete ${order.order_number}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing {firstRow}–{lastRow} of {filteredOrders.length} orders · 10 rows per page</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15}/> Previous</button>
            <span className="px-2 text-xs font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={15}/></button>
          </div>
        </div>
      </div>

      {/* QR SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Scan Order QR</h2><p className="text-sm text-slate-500">Scan the QR code attached to the specific laundry order.</p></div><button onClick={() => setShowScanner(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div>
            <div id="zatro-customer-qr-reader" className="overflow-hidden rounded-xl" />
            <p className="mt-3 text-xs text-slate-500">Allow camera access when your browser asks. Use HTTPS or localhost for camera access.</p>
          </div>
        </div>
      )}

      {/* PICKUP AND COUNTER PAYMENT MODAL */}
      {pickupOrder && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">Confirm Laundry Pickup</h2><p className="mt-1 text-sm text-slate-500">{pickupOrder.order_number} · {pickupOrder.customer_name}</p></div><button disabled={pickupSaving} onClick={() => setPickupOrder(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div>
            <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Order total</span><strong>{currency(pickupOrder.total_amount)}</strong></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Previously paid</span><strong>{currency(pickupOrder.paid_amount)}</strong></div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-sm"><span className="font-semibold text-slate-700">Collect at pickup</span><strong className={pickupOrder.balance_due > 0 ? "text-amber-700" : "text-green-700"}>{currency(pickupOrder.balance_due)}</strong></div>
            </div>
            {pickupOrder.balance_due > 0 ? (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Payment Method
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-semibold text-slate-800">Cash</span>
                  <span className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    Cash Only
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  Confirm only after you have actually received{" "}
                  {currency(pickupOrder.balance_due)} in cash.
                </p>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
                This order is fully paid. You can confirm pickup.
              </p>
            )}
            <div className="mt-5 flex gap-3"><button disabled={pickupSaving} onClick={() => setPickupOrder(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={pickupSaving} onClick={() => void confirmPickup()} className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{pickupSaving ? "Processing..." : pickupOrder.balance_due > 0 ? "Payment Received & Picked Up" : "Confirm Pickup"}</button></div>
          </div>
        </div>
      )}

      {/* DELETE ORDER CONFIRMATION */}
      {orderToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-order-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 size={26} />
            </div>
            <h2 id="delete-order-title" className="mt-4 text-center text-lg font-bold text-slate-900">
              Delete Laundry Order?
            </h2>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600">
              Are you sure you want to permanently delete order{" "}
              <strong>{orderToDelete.order_number}</strong> for{" "}
              <strong>{orderToDelete.customer_name}</strong>?
            </p>
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">
              This permanently deletes the order, its service items, payment records, and status history. It will also change historical Daily Accounting totals and reports. This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={deletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingOrder}
                onClick={() => void deleteOrder()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingOrder ? "Deleting..." : "Yes, Delete Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">

          <div className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Create Laundry Order
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Enter customer and laundry service details.
                </p>
              </div>

              <button
                onClick={closeCreate}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close create order"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={createOrder}
              className="space-y-6 overflow-y-auto p-5 sm:p-6"
            >

              {/* CUSTOMER */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Customer Name *
                </label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value.toUpperCase())}
                  placeholder="ENTER CUSTOMER'S FULL NAME"
                  maxLength={120}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm uppercase outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Contact Number (OPTIONAL)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="E.G. 09XXXXXXXXX (OPTIONAL)"
                  maxLength={20}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm uppercase outline-none focus:border-blue-500"
                />
              </div>
            </div>

              {/* LAUNDRY SERVICES */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Laundry Services *
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={15} />
                    Add service
                  </button>
                </div>

                <div className="space-y-3">
                  {newItems.map((item, index) => {
                    const selectedService = laundryServices.find(
                      (service) => service.id === item.service_id
                    );

                    return (
                      <div
                        key={`service-${index}`}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_132px_40px] sm:items-end">
                          <div className="min-w-0">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Laundry service
                            </label>
                            <select
                              required
                              value={item.service_id}
                              onChange={(event) =>
                                updateItem(index, "service_id", event.target.value)
                              }
                              className="h-11 w-full min-w-0 appearance-none rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="">Choose a service</option>
                              {laundryServices.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.service_name} — {currency(service.price)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Quantity
                            </label>
                            <input
                              required
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(index, "quantity", Number(event.target.value))
                              }
                              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={newItems.length === 1}
                            onClick={() => removeItem(index)}
                            className="flex h-11 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Remove laundry service"
                            title="Remove service"
                          >
                            <X size={17} />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <span className="text-xs text-slate-500">
                            {selectedService
                              ? `${currency(selectedService.price)} per selected unit`
                              : "Select a service to view its price"}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">
                            Subtotal: {selectedService
                              ? currency(selectedService.price * item.quantity)
                              : currency(0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OPTIONAL ADD-ONS — SEPARATE FIELD */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Add-ons (Optional)
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Select additional soap or fabcon only when requested.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addAddon}
                    disabled={addonServices.length === 0}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Plus size={15} />
                    Add add-on
                  </button>
                </div>

                {newAddons.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-amber-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                    No add-ons selected.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {newAddons.map((item, index) => {
                      const selectedAddon = addonServices.find(
                        (addon) => addon.id === item.service_id
                      );

                      return (
                        <div
                          key={`addon-${index}`}
                          className="rounded-xl border border-amber-200 bg-white p-4"
                        >
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_132px_40px] sm:items-end">
                            <div className="min-w-0">
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Optional add-on
                              </label>
                              <select
                                value={item.service_id}
                                onChange={(event) =>
                                  updateAddon(index, "service_id", event.target.value)
                                }
                                className="h-11 w-full min-w-0 appearance-none rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                              >
                                <option value="">Choose an add-on</option>
                                {addonServices.map((addon) => (
                                  <option key={addon.id} value={addon.id}>
                                    {addon.service_name} — {currency(addon.price)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateAddon(index, "quantity", Number(event.target.value))
                                }
                                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeAddon(index)}
                              className="flex h-11 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove add-on"
                              title="Remove add-on"
                            >
                              <X size={17} />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <span className="text-xs text-slate-500">
                              {selectedAddon
                                ? `${currency(selectedAddon.price)} per item`
                                : "Select an add-on to view its price"}
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              Subtotal: {selectedAddon
                                ? currency(selectedAddon.price * item.quantity)
                                : currency(0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SPECIAL INSTRUCTIONS */}

              <div>
                <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Special Instructions
                </label>

                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(event) =>
                    setInstructions(event.target.value)
                  }
                  placeholder="Optional instructions..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* TOTAL */}

              <div className="flex items-center justify-between rounded-xl bg-blue-50 p-4">
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Estimated Order Total
                  </p>

                  <p className="text-xs text-blue-600">
                    Laundry services and optional add-ons × quantity
                  </p>
                </div>

                <p className="text-xl font-bold text-blue-800">
                  {currency(estimatedTotal)}
                </p>
              </div>

              {/* ACTIONS */}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    services.length === 0
                  }
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "Creating Order..."
                    : "Create Order"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* ORDER DETAILS MODAL */}

      {selectedOrder && (
        <div className="print-order-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">

          <div className="print-order-card my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/zatro.jpeg"
                  alt="ZATRO Laundry Shop"
                  className="h-12 w-12 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    ZATRO Laundry Shop
                  </p>
                  <p className="text-xs text-slate-500">
                    Order Details
                  </p>
                  <h2 className="truncate text-lg font-bold text-slate-900">
                    {selectedOrder.order_number}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close order details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">

              <div className="print-order-qr flex w-full justify-center rounded-xl border border-dashed border-slate-200 bg-white p-4">
                <div className="text-center">
                  <QRCodeSVG value={`ZATRO:ORDER:${selectedOrder.id}`} size={144} level="H" includeMargin />
                  <p className="mt-2 text-xs font-semibold text-slate-600">Scan this code to identify this exact order</p>
                </div>
              </div>

              {/* ORDER INFORMATION */}

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <p className="text-xs text-slate-400">
                    Customer
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedOrder.customer_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Order Date
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {format(
                      new Date(selectedOrder.created_at),
                      "MMM dd, yyyy · hh:mm:ss a"
                    )}
                  </p>
                </div>

              </div>

              {/* ORDER ITEMS */}

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">
                  Order Services
                </h3>

                {loadingDetails ? (
                  <p className="py-5 text-center text-sm text-slate-500">
                    Loading order items...
                  </p>
                ) : orderItems.length === 0 ? (
                  <p className="py-5 text-center text-sm text-slate-400">
                    No order items found.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-3 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {item.service_name}
                          </p>

                          <p className="text-xs text-slate-500">
                            {item.quantity} ×{" "}
                            {currency(item.unit_price)}
                          </p>
                        </div>

                        <p className="text-sm font-semibold text-slate-800">
                          {currency(item.subtotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* INSTRUCTIONS */}

              {selectedOrder.special_instructions && (
                <div>
                  <p className="text-xs text-slate-400">
                    Special Instructions
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {selectedOrder.special_instructions}
                  </p>
                </div>
              )}

              {/* TOTAL */}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="font-semibold text-slate-700">
                  Total Amount
                </span>

                <span className="text-xl font-bold text-slate-900">
                  {currency(selectedOrder.total_amount)}
                </span>
              </div>

              {/* PRINT */}

              <div className="print-order-actions flex justify-end">
                <button
                  type="button"
                  onClick={printOrderReceipt}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <Printer size={16} />
                  Print
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
