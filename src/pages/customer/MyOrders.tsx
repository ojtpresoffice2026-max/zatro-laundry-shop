import OrdersSection from "../../components/customer/OrdersSection";
import { useCustomerData } from "../../contexts/CustomerDataContext";

export default function MyOrders() {
  const { orders, loading } = useCustomerData();

  return (
    <OrdersSection
      orders={orders}
      loading={loading}
    />
  );
}