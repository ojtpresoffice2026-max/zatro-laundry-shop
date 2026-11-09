import { supabase } from "../lib/supabase";
import type { LoginData, UserProfile } from "../types/auth";

export async function loginUser(data: LoginData) {
  const { data: result, error } =
    await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

  if (error) throw error;

  return result;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

export async function getUserProfile(
  userId: string
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("This account is not authorized to access ZATRO.");
  }

  if (data.role !== "admin" || !data.is_active) {
    throw new Error("Access denied. An active administrator account is required.");
  }

  return data as UserProfile;
}