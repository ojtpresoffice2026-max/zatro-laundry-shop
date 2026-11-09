
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

          <p className="mt-4 text-sm text-slate-500">
            Verifying administrator access...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (profile.role !== "admin" || profile.is_active !== true) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
