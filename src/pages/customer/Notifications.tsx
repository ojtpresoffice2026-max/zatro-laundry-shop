import NotificationsSection from "../../components/customer/NotificationsSection";

import { useCustomerData } from "../../contexts/CustomerDataContext";

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    acknowledgeNotification,
    acknowledgeAll,
  } = useCustomerData();

  return (
    <NotificationsSection
      notifications={notifications}
      unreadCount={unreadCount}
      onAcknowledge={(item) =>
        void acknowledgeNotification(item)
      }
      onAcknowledgeAll={() => void acknowledgeAll()}
    />
  );
}