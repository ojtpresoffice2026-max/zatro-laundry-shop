
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment configuration.");
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify the requesting user's session.
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: "Invalid authentication. Please sign in again." },
        401
      );
    }

    // Verify that the requesting user is an active administrator.
    const { data: callerProfile, error: callerError } =
      await supabaseAdmin
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (callerError || !callerProfile) {
      console.error("Caller profile verification failed:", callerError);

      return jsonResponse(
        { error: "Unable to verify administrator permissions." },
        403
      );
    }

    if (
      callerProfile.role !== "admin" ||
      callerProfile.is_active !== true
    ) {
      return jsonResponse(
        { error: "Only active administrators can delete administrators." },
        403
      );
    }

    const body = await req.json();
    const targetUserId = String(body.user_id ?? "").trim();

    if (!targetUserId) {
      return jsonResponse(
        { error: "Administrator user ID is required." },
        400
      );
    }

    // Prevent an administrator from deleting their own account.
    if (targetUserId === user.id) {
      return jsonResponse(
        { error: "You cannot delete your own administrator account." },
        403
      );
    }

    // Verify that the target exists and is an administrator.
    const { data: targetProfile, error: targetError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", targetUserId)
        .single();

    if (targetError || !targetProfile) {
      return jsonResponse(
        { error: "Administrator account was not found." },
        404
      );
    }

    if (targetProfile.role !== "admin") {
      return jsonResponse(
        { error: "The selected account is not an administrator." },
        400
      );
    }

    // Count the remaining active administrators.
    const { data: activeAdmins, error: countError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true);

    if (countError) {
      console.error("Administrator count failed:", countError);

      return jsonResponse(
        {
          error: "Unable to verify the remaining administrator accounts.",
          details: countError.message,
        },
        500
      );
    }

    const activeAdminCount = activeAdmins?.length ?? 0;

    // Do not allow deletion of the last active administrator.
    if (targetProfile.is_active === true && activeAdminCount <= 1) {
      return jsonResponse(
        {
          error: "Cannot delete the last active administrator. At least one active administrator must remain.",
        },
        400
      );
    }

    // Delete the Supabase Auth user.
    // The profiles.id foreign key should use ON DELETE CASCADE.
    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error("Administrator deletion failed:", deleteError);

      return jsonResponse(
        {
          error: "Unable to delete administrator account.",
          details: deleteError.message,
          code: deleteError.code ?? null,
        },
        400
      );
    }

    return jsonResponse({
      message: "Administrator deleted successfully.",
      deleted_user_id: targetUserId,
      deleted_name: targetProfile.full_name,
    });
  } catch (error: unknown) {
    console.error("admin-delete-user failed:", error);

    const errorObject =
      typeof error === "object" && error !== null
        ? (error as Record<string, unknown>)
        : {};

    const message =
      typeof errorObject.message === "string"
        ? errorObject.message
        : error instanceof Error
          ? error.message
          : String(error);

    return jsonResponse(
      {
        error: message,
        code: errorObject.code ?? null,
        details: errorObject.details ?? null,
        hint: errorObject.hint ?? null,
      },
      400
    );
  }
});
