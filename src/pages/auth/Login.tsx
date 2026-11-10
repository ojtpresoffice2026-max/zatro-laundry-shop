
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  LockKeyhole,
  ArrowRight,
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#102c55] px-4 py-10">

      {/* BLURRED BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/zatro.jpeg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
        />

        {/* Dark blue overlay */}
        <div className="absolute inset-0 bg-[#102c55]/65" />

        {/* Soft blue lighting */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400/20 blur-[100px]" />

        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-[100px]" />
      </div>

      {/* MAIN LOGIN CARD */}
      <div className="relative z-10 grid w-full max-w-[1000px] overflow-hidden rounded-xl bg-white shadow-[0_15px_50px_rgba(0,0,0,0.25)] md:min-h-[590px] md:grid-cols-2">

        {/* LEFT BRANDING PANEL */}
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-[#102c55] px-8 py-12 text-center text-white md:px-12">

          {/* WATER WAVES */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 overflow-hidden">
            <svg
              viewBox="0 0 800 200"
              preserveAspectRatio="none"
              className="absolute bottom-0 h-full w-full"
              aria-hidden="true"
            >
              <path
                d="M0 75 C150 25 250 140 400 105 S650 20 800 80 L800 200 L0 200Z"
                fill="#0878bd"
                opacity="0.55"
              />

              <path
                d="M0 112 C160 65 260 160 420 125 S650 65 800 105 L800 200 L0 200Z"
                fill="#159bd6"
                opacity="0.65"
              />

              <path
                d="M0 150 C180 105 290 185 450 150 S680 100 800 135 L800 200 L0 200Z"
                fill="#55bce9"
                opacity="0.48"
              />
            </svg>

            {/* SOAP BUBBLES */}
            <div className="absolute bottom-16 left-[12%] h-9 w-9 rounded-full border-2 border-sky-200/80 bg-sky-200/10 shadow-[inset_-5px_-5px_8px_rgba(0,120,200,0.4)]">
              <div className="absolute left-2 top-1 h-2 w-3 rounded-full bg-white/70 blur-[1px]" />
            </div>

            <div className="absolute bottom-8 left-[22%] h-6 w-6 rounded-full border border-sky-100/80 bg-sky-100/20">
              <div className="absolute left-1 top-1 h-1.5 w-2 rounded-full bg-white/70" />
            </div>

            <div className="absolute bottom-12 right-[15%] h-10 w-10 rounded-full border-2 border-sky-100/80 bg-sky-100/10">
              <div className="absolute left-2 top-1.5 h-2 w-3 rounded-full bg-white/70" />
            </div>

            <div className="absolute bottom-7 right-[27%] h-5 w-5 rounded-full border border-white/70 bg-white/10" />
          </div>

          {/* LOGO */}
          <div className="relative z-10 mb-7 flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl bg-white p-3 shadow-lg">
            <img
              src="/zatro.jpeg"
              alt="ZATRO Laundry Shop Logo"
              className="h-full w-full object-contain"
            />
          </div>

          {/* BRAND NAME */}
          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold tracking-[0.12em]">
              ZATRO
            </h1>

            <p className="mt-2 text-sm font-semibold tracking-[0.35em] text-sky-300">
              LAUNDRY SHOP
            </p>

            <div className="mx-auto my-7 h-1 w-20 rounded-full bg-sky-400" />

            <h2 className="text-xl font-bold leading-snug">
              Laundry Shop
              <br />
              Management System
            </h2>

            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-blue-100/90">
              Manage laundry orders, customers, services, inventory, and
              daily business operations in one place.
            </p>
          </div>
        </section>

        {/* RIGHT LOGIN PANEL */}
        <section className="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-[370px]">

            {/* HEADING */}
            <div className="mb-9">
              <p className="text-sm font-medium text-[#64748b]">
                Welcome back
              </p>

              <h2 className="mt-2 text-2xl font-bold text-[#172b4d]">
                Administrator Login
              </h2>

              <p className="mt-2 text-sm text-[#64748b]">
                Sign in to access your management dashboard.
              </p>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* LOGIN FORM */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-[#334155]"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                  />

                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    disabled={loading}
                    className="h-12 w-full rounded-md border border-[#dbe1ea] bg-white pl-11 pr-4 text-sm text-[#172b4d] outline-none transition focus:border-[#244d80] focus:ring-2 focus:ring-[#244d80]/10 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-[#334155]"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
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
                    className="h-12 w-full rounded-md border border-[#dbe1ea] bg-white pl-11 pr-12 text-sm text-[#172b4d] outline-none transition focus:border-[#244d80] focus:ring-2 focus:ring-[#244d80]/10 disabled:bg-gray-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#244d80]"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* SIGN IN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#173b69] px-4 text-sm font-semibold text-white transition hover:bg-[#102c55] focus:outline-none focus:ring-2 focus:ring-[#173b69]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* FOOTER */}
            <div className="mt-10 border-t border-[#e8edf3] pt-5 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-[#64748b]">
                <LockKeyhole size={13} />
                Restricted to authorized administrators
              </div>

              <p className="mt-3 text-xs text-[#94a3b8]">
                © 2026 ZATRO Laundry Shop. All rights reserved.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
