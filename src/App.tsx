
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";

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
          Loading Zatro Laundry Shop...
        </p>
      </div>
    </div>
  );
}

function AdminOnlyRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout />;
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={
          user && profile?.role === "admin" ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminOnlyRoute />}>
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

      {/* Default Route */}
      <Route
        path="/"
        element={
          user && profile?.role === "admin" ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Invalid Routes */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
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
