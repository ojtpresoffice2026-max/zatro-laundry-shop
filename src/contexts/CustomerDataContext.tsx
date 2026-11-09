import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

import type {
  CustomerOrder,
  CustomerNotification,
  Payment,
  OrderStatus,
} from "../types/customer";

interface CustomerDataValue {
  orders: CustomerOrder[];
  payments: Payment[];
  notifications: CustomerNotification[];

  loading: boolean;
  refreshing: boolean;
  error: string;

  activeAlert: CustomerNotification | null;

  unreadCount: number;
  totalPaid: number;
  pendingOrders: number;
  readyOrders: number;

  refresh: () => Promise<void>;
  clearError: () => void;

  acknowledgeNotification: (
    item: CustomerNotification
  ) => Promise<void>;

  acknowledgeAll: () => Promise<void>;
}

const CustomerDataContext =
  createContext<CustomerDataValue | null>(null);

export function CustomerDataProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<
    CustomerNotification[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeAlert, setActiveAlert] =
    useState<CustomerNotification | null>(null);

  const knownIds = useRef(new Set<string>());
  const initialPickupCheck = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [ordersResult, paymentsResult, notificationsResult] =
          await Promise.all([
            supabase
              .from("laundry_orders")
              .select(
                "id, order_number, customer_id, status, total_amount, created_at, completed_at, special_instructions"
              )
              .eq("customer_id", user.id)
              .order("created_at", { ascending: false }),

            supabase
              .from("payments")
              .select(
                "id, order_id, amount, payment_method, payment_status, paid_at, created_at, laundry_orders!inner(customer_id)"
              )
              .eq("laundry_orders.customer_id", user.id)
              .order("created_at", { ascending: false }),

            supabase
              .from("notifications")
              .select(
                "id, user_id, title, message, notification_type, is_read, created_at"
              )
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(30),
          ]);

        if (ordersResult.error) throw ordersResult.error;
        if (paymentsResult.error) throw paymentsResult.error;
        if (notificationsResult.error)
          throw notificationsResult.error;

        const nextOrders: CustomerOrder[] = (
          ordersResult.data ?? []
        ).map((order) => ({
          ...order,
          status: order.status as OrderStatus,
          total_amount: Number(order.total_amount),
        }));

        const nextPayments: Payment[] = (
          paymentsResult.data ?? []
        ).map((payment) => ({
          id: payment.id,
          order_id: payment.order_id,
          amount: Number(payment.amount),
          payment_method: payment.payment_method,
          payment_status: payment.payment_status,
          paid_at: payment.paid_at,
          created_at: payment.created_at,
        }));

        const nextNotifications = (
          notificationsResult.data ?? []
        ) as CustomerNotification[];

        setOrders(nextOrders);
        setPayments(nextPayments);
        setNotifications(nextNotifications);

        const readyOrder = nextOrders.find(
          (order) => order.status === "ready_for_pickup"
        );

        if (!readyOrder) {
          setActiveAlert(null);
        }

        if (!initialPickupCheck.current) {
          initialPickupCheck.current = true;

          if (readyOrder) {
            const existingNotification =
              nextNotifications.find(
                (notification) =>
                  notification.notification_type === "pickup_ready" &&
                  notification.message.includes(
                    readyOrder.order_number
                  )
              );

            setActiveAlert(
              existingNotification ?? {
                id: `active-pickup-${readyOrder.id}`,
                user_id: user.id,
                title: "Your Laundry Is Ready!",
                message: `Your laundry order ${readyOrder.order_number} is ready for pickup. Please visit ZATRO Laundry Shop.`,
                notification_type: "pickup_ready",
                is_read: false,
                created_at: readyOrder.created_at,
              }
            );
          }
        }

        nextNotifications.forEach((notification) => {
          knownIds.current.add(notification.id);
        });
      } catch (err) {
        console.error("Customer data loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your customer data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    void load();

    if (!user?.id) return;

    const channel = supabase
      .channel(`customer-portal-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming =
              payload.new as CustomerNotification;

            const isNew = !knownIds.current.has(incoming.id);

            knownIds.current.add(incoming.id);

            setNotifications((current) => [
              incoming,
              ...current.filter(
                (item) => item.id !== incoming.id
              ),
            ]);

            if (
              isNew &&
              incoming.notification_type === "pickup_ready" &&
              !incoming.is_read
            ) {
              setActiveAlert(incoming);
            }
          } else {
            void load(true);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "laundry_orders",
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          void load(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          void load(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const acknowledgeNotification = useCallback(
    async (item: CustomerNotification) => {
      if (!user?.id) return;

      if (!item.id.startsWith("active-pickup-")) {
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", item.id)
          .eq("user_id", user.id);

        if (updateError) {
          setError(updateError.message);
          return;
        }

        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, is_read: true }
              : notification
          )
        );
      }

      setActiveAlert((current) =>
        current?.id === item.id ? null : current
      );
    },
    [user?.id]
  );

  const acknowledgeAll = useCallback(async () => {
    if (!user?.id) return;

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  }, [user?.id]);

  const value = useMemo<CustomerDataValue>(
    () => ({
      orders,
      payments,
      notifications,

      loading,
      refreshing,
      error,

      activeAlert,

      unreadCount: notifications.filter(
        (notification) => !notification.is_read
      ).length,

      totalPaid: payments
        .filter(
          (payment) => payment.payment_status === "verified"
        )
        .reduce(
          (total, payment) => total + payment.amount,
          0
        ),

      pendingOrders: orders.filter(
        (order) => order.status === "pending"
      ).length,

      readyOrders: orders.filter(
        (order) => order.status === "ready_for_pickup"
      ).length,

      refresh: () => load(true),
      clearError: () => setError(""),

      acknowledgeNotification,
      acknowledgeAll,
    }),
    [
      orders,
      payments,
      notifications,
      loading,
      refreshing,
      error,
      activeAlert,
      load,
      acknowledgeNotification,
      acknowledgeAll,
    ]
  );

  return (
    <CustomerDataContext.Provider value={value}>
      {children}
    </CustomerDataContext.Provider>
  );
}

export function useCustomerData() {
  const value = useContext(CustomerDataContext);

  if (!value) {
    throw new Error(
      "useCustomerData must be used inside CustomerDataProvider"
    );
  }

  return value;
}