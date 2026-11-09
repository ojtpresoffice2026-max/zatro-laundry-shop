import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  UserPlus,
  Users,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

type AdminProfile = {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

async function invokeFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message || `The ${name} function request failed.`;

    try {
      const context = (error as { context?: unknown }).context;

      if (context instanceof Response) {
        const response = context.clone();
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const payload = await response.json();

          const details = [
            payload.error,
            payload.details,
            payload.hint,
            payload.code ? `Code: ${payload.code}` : null,
          ]
            .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
            .map(String);

          if (details.length > 0) {
            message = details.join(" | ");
          }
        } else {
          const responseText = await response.text();
          if (responseText.trim()) message = responseText;
        }
      }
    } catch {
      // Retain the original Supabase Functions error if its response cannot be read.
    }

    throw new Error(message);
  }

  if (data?.error) {
    const details = [
      data.error,
      data.details,
      data.hint,
      data.code ? `Code: ${data.code}` : null,
    ]
      .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
      .map(String);

    throw new Error(details.join(" | ") || "The Edge Function returned an error.");
  }

  return data ?? {};
}

export default function AdminManagement() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProfile | null>(null);

  const loadAdmins = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, full_name, role, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;
      setAdmins((data ?? []) as AdminProfile[]);
    } catch (loadError) {
      setError(
        `Unable to load administrator accounts. ${getErrorMessage(loadError)}`,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setError("Complete all fields before creating the administrator.");
      return;
    }
    if (password.length < 8) {
      setError("The password must contain at least 8 characters.");
      return;
    }

    setCreating(true);
    try {
      await invokeFunction("admin-create-user", {
        full_name: cleanName,
        email: cleanEmail,
        password,
      });

      setSuccess(`Administrator account for ${cleanName} was created.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setCreateOpen(false);
      await loadAdmins(true);
    } catch (createError) {
      setError(`Unable to create administrator. ${getErrorMessage(createError)}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;

    const cleanName = editName.trim();
    if (!cleanName) {
      setError("Administrator name cannot be empty.");
      return;
    }

    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: cleanName })
        .eq("id", editTarget.id)
        .eq("role", "admin");

      if (updateError) throw updateError;

      setSuccess("Administrator information updated successfully.");
      setEditTarget(null);
      setEditName("");
      await loadAdmins(true);
    } catch (saveError) {
      setError(`Unable to update administrator. ${getErrorMessage(saveError)}`);
    } finally {
      setSavingEdit(false);
    }
  }

  function openDeleteModal(admin: AdminProfile) {
    if (!user?.id) {
      setError("Your session could not be verified. Please sign in again.");
      return;
    }

    if (admin.id === user.id) {
      setError("You cannot delete the administrator account currently signed in.");
      return;
    }

    setError("");
    setSuccess("");
    setDeleteTarget(admin);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const target = deleteTarget;

    if (target.id === user?.id) {
      setError("You cannot delete your own administrator account.");
      setDeleteTarget(null);
      return;
    }

    setDeletingId(target.id);
    setError("");
    setSuccess("");

    try {
      await invokeFunction("admin-delete-user", { user_id: target.id });

      setDeleteTarget(null);
      setSuccess(
        `Administrator ${target.full_name || ""} was permanently deleted successfully.`,
      );

      await loadAdmins(true);
    } catch (deleteError) {
      setError(
        `Unable to delete administrator. ${getErrorMessage(deleteError)}`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Workspace / Management
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Admin Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage administrator accounts for Zatro Laundry Shop.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadAdmins(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <UserPlus size={17} />
            Add Administrator
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button type="button" className="ml-auto" onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
          <button type="button" className="ml-auto" onClick={() => setSuccess("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Administrator Accounts</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {loading ? "—" : admins.length}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users size={23} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Single account role</p>
              <p className="mt-1 text-sm text-slate-500">
                All registered accounts have Admin access.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Registered Administrators</h2>
          <p className="text-xs text-slate-500">
            Accounts with the admin role in the profiles table.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading administrator accounts...
          </div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 font-semibold text-slate-800">No administrators found</p>
            <p className="mt-1 text-sm text-slate-500">
              Check the profiles table and administrator access policies.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Date Created</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((admin) => {
                  const isCurrentUser = admin.id === user?.id;
                  return (
                    <tr key={admin.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                            {admin.full_name?.charAt(0).toUpperCase() || "A"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">
                              {admin.full_name || "Unnamed Administrator"}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs font-normal text-blue-600">(You)</span>
                              )}
                            </p>
                            <p className="max-w-[290px] truncate text-xs text-slate-400">
                              ID: {admin.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <ShieldCheck size={13} />
                          Admin
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {admin.created_at
                          ? new Date(admin.created_at).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setSuccess("");
                              setEditTarget(admin);
                              setEditName(admin.full_name || "");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(admin)}
                            disabled={isCurrentUser || deletingId === admin.id}
                            title={isCurrentUser ? "You cannot delete your own account" : "Delete administrator"}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                            {deletingId === admin.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {admins.length} administrator account(s).
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Add Administrator</h2>
                <p className="mt-0.5 text-xs text-slate-500">Create a new Admin login account.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} disabled={creating} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X size={19} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-6">
              <label className="block text-sm font-medium text-slate-700">
                Full Name *
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Enter administrator name"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email Address *
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@example.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Password *
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <p className="text-xs text-slate-500">
                The new administrator can sign in immediately using this email and password.
              </p>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setCreateOpen(false)} disabled={creating} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  <UserPlus size={16} />
                  {creating ? "Creating..." : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Edit Administrator</h2>
                <p className="mt-0.5 text-xs text-slate-500">Update the account's display name.</p>
              </div>
              <button type="button" onClick={() => setEditTarget(null)} disabled={savingEdit} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X size={19} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4 p-6">
              <label className="block text-sm font-medium text-slate-700">
                Full Name *
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setEditTarget(null)} disabled={savingEdit} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CENTERED DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              deletingId !== deleteTarget.id
            ) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-admin-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Trash2 size={21} />
                </div>
                <div>
                  <h2 id="delete-admin-title" className="text-lg font-bold text-slate-900">
                    Delete Administrator
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Confirm account deletion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close confirmation"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                  {deleteTarget.full_name?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {deleteTarget.full_name || "Unnamed Administrator"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Administrator account
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Admin
                </span>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={19} className="mt-0.5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Permanently delete this account?
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-red-700">
                      This administrator will lose access to ZATRO Laundry Shop.
                      Their authentication account will be permanently deleted.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Make sure you selected the correct administrator before proceeding.
              </p>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingId === deleteTarget.id}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deletingId === deleteTarget.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === deleteTarget.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Administrator
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
