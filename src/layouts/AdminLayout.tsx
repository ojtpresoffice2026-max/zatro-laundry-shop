import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBasket,
  Shirt,
  Package,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const navigation = [
  {
    title: "MAIN MENU",
    items: [
      { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Laundry Orders", path: "/admin/orders", icon: ShoppingBasket },
      { name: "Laundry Services", path: "/admin/services", icon: Shirt },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { name: "Daily Accounting", path: "/admin/daily-accounting", icon: ClipboardList },
      { name: "Inventory", path: "/admin/inventory", icon: Package },
      { name: "Reports", path: "/admin/reports", icon: BarChart3 },
      { name: "Admin Management", path: "/admin/admin-management", icon: Users },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Admin Dashboard",
  "/admin/orders": "Laundry Orders",
  "/admin/customers": "Customer Management",
  "/admin/services": "Laundry Services",
  "/admin/daily-accounting": "Daily Accounting",
  "/admin/inventory": "Inventory Management",
  "/admin/reports": "Reports",
  "/admin/admin-management": "Admin Management",
};

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const currentTitle = pageTitles[location.pathname] || "Admin Dashboard";

  const handleLogout = async () => {
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
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#142B4A] text-white transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <img
            src="/zatro.jpeg"
            alt="Zatro Laundry Shop Logo"
            className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-wide">ZATRO</h1>
            <p className="text-xs text-blue-200">Laundry Shop</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-slate-300 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={21} />
          </button>
        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.15em] text-slate-400">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                          isActive
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`
                      }
                    >
                      <Icon size={19} />
                      <span className="flex-1">{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 font-bold">
              {profile?.full_name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {profile?.full_name || "Administrator"}
              </p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            <LogOut size={18} />
            {loggingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="text-slate-600 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className="font-bold text-slate-800">{currentTitle}</h2>
              <p className="text-xs text-slate-400">
                Zatro Laundry Shop Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell size={21} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {profile?.full_name || "Administrator"}
                </p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                {profile?.full_name?.charAt(0).toUpperCase() || "A"}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
