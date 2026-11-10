
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";

import ProtectedRoute from "./components/shared/ProtectedRoute";

import Login from "./pages/auth/Login";
import AdminLayout from "./layouts/AdminLayout";
import ExpenseManagement from "./pages/admin/ExpenseManagement";
import AdminDashboard from "./pages/admin/AdminDashboard";
import LaundryOrders from "./pages/admin/LaundryOrders";
import LaundryServices from "./pages/admin/LaundryServices";
import CustomerManagement from "./pages/admin/CustomerManagement";
import DailyAccounting from "./pages/admin/DailyAccounting";
import InventoryManagement from "./pages/admin/InventoryManagement";
import ReportsManagement from "./pages/admin/ReportsManagement";
import AdminManagement from "./pages/admin/AdminManagement";
import ActivityLogs from "./pages/admin/ActivityLogs";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

        <p className="mt-4 text-sm text-slate-500">
          Verifying ZATRO administrator access...
        </p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  const isActiveAdmin =
    !!user &&
    !!profile &&
    profile.role === "admin" &&
    profile.is_active === true;

  return (
    <Routes>
      {/* LOGIN */}
      <Route
        path="/login"
        element={
          isActiveAdmin ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* PROTECTED ADMINISTRATOR ROUTES */}
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          {/* DEFAULT ADMIN PAGE */}
          <Route
            index
            element={<Navigate to="dashboard" replace />}
          />

          {/* DASHBOARD */}
          <Route
            path="dashboard"
            element={<AdminDashboard />}
          />

          {/* LAUNDRY ORDERS */}
          <Route
            path="orders"
            element={<LaundryOrders />}
          />

          {/* LAUNDRY SERVICES */}
          <Route
            path="services"
            element={<LaundryServices />}
          />

          {/* CUSTOMER MANAGEMENT */}
          <Route
            path="customers"
            element={<CustomerManagement />}
          />
          <Route path="expenses" element={<ExpenseManagement />} />

          {/* DAILY ACCOUNTING */}
          <Route
            path="daily-accounting"
            element={<DailyAccounting />}
          />

          {/* INVENTORY */}
          <Route
            path="inventory"
            element={<InventoryManagement />}
          />

          {/* REPORTS */}
          <Route
            path="reports"
            element={<ReportsManagement />}
          />

          {/* ADMIN MANAGEMENT */}
          <Route
            path="admin-management"
            element={<AdminManagement />}
          />

          {/* ACTIVITY LOGS */}
          <Route
            path="activity-logs"
            element={<ActivityLogs />}
          />
        </Route>
      </Route>

      {/* HOME */}
      <Route
        path="/"
        element={
          <Navigate
            to={
              isActiveAdmin
                ? "/admin/dashboard"
                : "/login"
            }
            replace
          />
        }
      />

      {/* UNKNOWN ROUTES */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              isActiveAdmin
                ? "/admin/dashboard"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
