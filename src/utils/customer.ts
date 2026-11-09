import type { OrderStatus } from "../types/customer";

export const money = (value: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
};

export const statusLabel = (status: OrderStatus): string => {
  switch (status) {
    case "pending":
      return "Pending";

    case "ready_for_pickup":
      return "Ready for Pickup";

    case "completed":
      return "Completed";

    default:
      return status;
  }
};

export const statusClasses = (status: OrderStatus): string => {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";

    case "ready_for_pickup":
      return "bg-green-100 text-green-700";

    case "completed":
      return "bg-blue-100 text-blue-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
};