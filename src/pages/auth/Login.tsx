
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Mail,
  LockKeyhole,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { useAuth } from "../../hooks/useAuth";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signIn({
        email: email.trim(),
        password,
      });

      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061b50] px-4 py-10">

      {/* BACKGROUND IMAGE */}
      <div className="absolute inset-0 overflow-hidden">

        {/* Blurred ZATRO logo */}
        <img
          src="/zatro.jpeg"
          alt=""
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 scale-150 object-contain opacity-[0.12] blur-[12px] sm:h-[850px] sm:w-[850px]"
        />

        {/* Blue gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#061b50]/90 via-[#103c9a]/85 to-[#0758d5]/90" />

        {/* Decorative circles */}
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full border-[70px] border-white/[0.04]" />

        <div className="absolute -bottom-48 -right-40 h-[600px] w-[600px] rounded-full border-[90px] border-sky-300/[0.06]" />

        <div className="absolute right-[12%] top-[12%] h-72 w-72 rounded-full bg-blue-400/10 blur-[100px]" />

        <div className="absolute bottom-[10%] left-[10%] h-80 w-80 rounded-full bg-cyan-400/10 blur-[100px]" />
      </div>

      {/* LOGIN CARD */}
      <div className="relative z-10 w-full max-w-[440px]">

        {/* Glow behind card */}
        <div className="absolute -inset-3 rounded-[35px] bg-cyan-400/20 blur-2xl" />

        <div className="relative overflow-hidden rounded-[30px] border border-white/30 bg-white/[0.13] p-7 shadow-[0_25px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-10">

          {/* Decorative top glow */}
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />

          {/* Decorative bottom waves */}
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-[140%] rotate-[-5deg] rounded-[50%] bg-blue-400/10 blur-xl" />

          {/* LOGO AND BRANDING */}
          <div className="relative z-10 mb-8 text-center">

            <div className="relative mx-auto mb-5 flex h-32 w-32 items-center justify-center">

              {/* Logo glow */}
              <div className="absolute inset-0 rounded-[35px] bg-cyan-300/30 blur-2xl" />

              {/* Logo container */}
              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-white/70 bg-white p-2 shadow-[0_10px_35px_rgba(0,0,0,0.25)]">
                <img
                  src="/zatro.jpeg"
                  alt="ZATRO Laundry Shop Logo"
                  className="h-full w-full rounded-[20px] object-contain"
                />
              </div>

              <Sparkles
                size={24}
                className="absolute -right-1 -top-1 text-cyan-300"
              />
            </div>

            <h1 className="text-4xl font-black tracking-[0.18em] text-white drop-shadow-lg">
              ZATRO
            </h1>

            <p className="mt-1 text-xs font-bold uppercase tracking-[0.4em] text-cyan-200">
              Laundry Shop
            </p>

            <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-sky-300 to-cyan-400" />

            <p className="mt-4 text-sm text-blue-100">
              Laundry Shop Management System
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-blue-400/20 px-5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
              <ShieldCheck size={16} className="text-cyan-300" />
              Administrator Access
            </div>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div
              role="alert"
              className="relative z-10 mb-5 rounded-xl border border-red-300/30 bg-red-500/15 p-4 text-sm text-red-100 backdrop-blur-md"
            >
              {error}
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">

            {/* EMAIL */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Administrator Email
              </label>

              <div className="relative">
                <Mail
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200"
                />

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter administrator email"
                  disabled={loading}
                  className="w-full rounded-xl border border-white/30 bg-white/10 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-blue-100/60 hover:border-cyan-200/60 focus:border-cyan-300 focus:bg-white/15 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-60"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  className="w-full rounded-xl border border-white/30 bg-white/10 py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-blue-100/60 hover:border-cyan-200/60 focus:border-cyan-300 focus:bg-white/15 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200 transition hover:text-white disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* SIGN IN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-cyan-300/50 bg-gradient-to-r from-cyan-400 via-blue-500 to-blue-600 py-4 font-bold text-white shadow-[0_8px_30px_rgba(0,153,255,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,200,255,0.45)] focus:outline-none focus:ring-4 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <LoaderCircle size={20} className="animate-spin" />
                  Verifying administrator...
                </>
              ) : (
                <>
                  <span>Administrator Sign In</span>
                  <ArrowRight
                    size={20}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          {/* FOOTER */}
          <div className="relative z-10 mt-8 border-t border-white/20 pt-6 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs text-blue-100/80">
              <LockKeyhole size={13} />
              Authorized administrators only
            </div>

            <p className="text-xs text-blue-100/70">
              © 2026 ZATRO Laundry Shop. All rights reserved.
            </p>
          </div>
        </div>

        <p className="relative z-10 mt-6 text-center text-xs tracking-wide text-blue-100/60">
          POWERED BY ZATRO LAUNDRY SHOP MANAGEMENT SYSTEM
        </p>
      </div>
    </main>
  );
}
