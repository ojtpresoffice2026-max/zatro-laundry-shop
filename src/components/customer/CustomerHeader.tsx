import { Menu, RefreshCw } from "lucide-react";

interface Props {
  title: string;
  fullName: string;
  refreshing: boolean;
  onMenu: () => void;
  onRefresh: () => void;
}

export default function CustomerHeader({
  title,
  fullName,
  refreshing,
  onMenu,
  onRefresh,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={21} />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#142B4A] sm:text-base">
              {title}
            </p>

            <p className="hidden text-xs text-slate-500 sm:block">
              Welcome, {fullName || "Customer"}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          aria-label="Refresh page"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "animate-spin" : ""}
          />

          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}