
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

import AdminDashboard from "./pages/admin/AdminDashboard";
import LaundryOrders from "./pages/admin/LaundryOrders";
import LaundryServices from "./pages/admin/LaundryServices";
import CustomerManagement from "./pages/admin/CustomerManagement";
import DailyAccounting from "./pages/admin/DailyAccounting";
import InventoryManagement from "./pages/admin/InventoryManagement";
import ReportsManagement from "./pages/admin/ReportsManagement";
import AdminManagement from "./pages/admin/AdminManagement";

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
      {/* Login */}
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

      {/* Protected administrator routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route
            index
            element={<Navigate to="dashboard" replace />}
          />

          <Route
            path="dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="orders"
            element={<LaundryOrders />}
          />

          <Route
            path="services"
            element={<LaundryServices />}
          />

          <Route
            path="customers"
            element={<CustomerManagement />}
          />

          <Route
            path="daily-accounting"
            element={<DailyAccounting />}
          />

          <Route
            path="inventory"
            element={<InventoryManagement />}
          />

          <Route
            path="reports"
            element={<ReportsManagement />}
          />

          <Route
            path="admin-management"
            element={<AdminManagement />}
          />
        </Route>
      </Route>

      {/* Home */}
      <Route
        path="/"
        element={
          <Navigate
            to={isActiveAdmin ? "/admin/dashboard" : "/login"}
            replace
          />
        }
      />

      {/* Unknown routes */}
      <Route
        path="*"
        element={
          <Navigate
            to={isActiveAdmin ? "/admin/dashboard" : "/login"}
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
