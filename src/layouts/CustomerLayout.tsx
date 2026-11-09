import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

import CustomerSidebar from "../components/customer/CustomerSidebar";
import CustomerHeader from "../components/customer/CustomerHeader";
import PickupAlertModal from "../components/customer/PickupAlertModal";

import {
  CustomerDataProvider,
  useCustomerData,
} from "../contexts/CustomerDataContext";

function CustomerLayoutContent() {
  const { profile, signOut } = useAuth();
  const data = useCustomerData();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const location = useLocation();

  const titles: Record<string, string> = {
    "/customer/dashboard": "Customer Dashboard",
    "/customer/orders": "My Laundry Orders",
    "/customer/notifications": "Notifications",
    "/customer/payments": "My Payments",
  };

  const title =
    titles[location.pathname] ?? "Customer Portal";

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut();
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 shadow-xl md:block">
        <CustomerSidebar
          fullName={profile?.full_name || "Customer"}
          unreadCount={data.unreadCount}
          loggingOut={loggingOut}
          onLogout={() => void logout()}
        />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/60"
          />

          <aside className="absolute inset-y-0 left-0 w-[min(84vw,290px)] max-w-[290px] shadow-2xl">
            <CustomerSidebar
              fullName={profile?.full_name || "Customer"}
              unreadCount={data.unreadCount}
              loggingOut={loggingOut}
              onLogout={() => void logout()}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="min-h-screen min-w-0 md:ml-64">
        <CustomerHeader
          title={title}
          fullName={profile?.full_name || "Customer"}
          refreshing={data.refreshing}
          onMenu={() => setSidebarOpen(true)}
          onRefresh={data.refresh}
        />

        <main className="mx-auto w-full max-w-screen-2xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {data.error && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span>{data.error}</span>

              <button
                onClick={data.clearError}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          <Outlet />

          <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-6 sm:flex-row sm:px-1">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} ZATRO Laundry Shop
            </p>
          </footer>
        </main>
      </div>

      <PickupAlertModal
        notification={data.activeAlert}
        onDismiss={() =>
          data.activeAlert &&
          void data.acknowledgeNotification(data.activeAlert)
        }
      />
    </div>
  );
}

export default function CustomerLayout() {
  return (
    <CustomerDataProvider>
      <CustomerLayoutContent />
    </CustomerDataProvider>
  );
}