export type OrderStatus =
  | "pending"
  | "ready_for_pickup"
  | "completed";

export interface CustomerOrder {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  special_instructions: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
}

export interface CustomerNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}