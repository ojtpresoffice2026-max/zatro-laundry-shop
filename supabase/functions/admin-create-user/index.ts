
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

  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error(
        "Missing Supabase environment configuration. Check Edge Function secrets."
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        {
          error: "Invalid authentication.",
          details: authError?.message ?? null,
        },
        401
      );
    }

    // Verify that the requesting user is an active administrator.
    const { data: callerProfile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError) {
      console.error("Administrator profile lookup failed:", profileError);

      return jsonResponse(
        {
          error: "Unable to verify administrator permissions.",
          details: profileError.message,
          code: profileError.code,
        },
        403
      );
    }

    if (
      callerProfile?.role !== "admin" ||
      callerProfile?.is_active !== true
    ) {
      return jsonResponse(
        {
          error: "Only active administrators can create administrators.",
        },
        403
      );
    }

    // Read and validate the submitted information.
    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? "").trim();

    if (!email || !password || !fullName) {
      return jsonResponse(
        {
          error: "Email, password, and full name are required.",
        },
        400
      );
    }

    if (password.length < 8) {
      return jsonResponse(
        {
          error: "Password must contain at least 8 characters.",
        },
        400
      );
    }

    // Create the Supabase Auth account.
    const {
      data: createdUser,
      error: createError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError || !createdUser.user) {
      console.error("Auth account creation failed:", createError);

      return jsonResponse(
        {
          error:
            createError?.message ??
            "Unable to create administrator account.",
          code: createError?.code ?? null,
        },
        400
      );
    }

    const createdUserId = createdUser.user.id;
    const createdEmail = createdUser.user.email ?? email;

    // Create the administrator profile.
    // IMPORTANT: email is required by the profiles table.
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
          email: createdEmail,
          full_name: fullName,
          role: "admin",
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (insertError) {
      console.error("Administrator profile insertion failed:", insertError);

      // Remove the Auth account if profile creation fails.
      const { error: cleanupError } =
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);

      if (cleanupError) {
        console.error(
          "Failed to clean up newly created Auth account:",
          cleanupError
        );
      }

      return jsonResponse(
        {
          error: "Unable to create administrator profile.",
          details: insertError.message,
          code: insertError.code,
          hint: insertError.hint,
          cleanup_error: cleanupError?.message ?? null,
        },
        400
      );
    }

    return jsonResponse({
      message: "Administrator created successfully.",
      user: {
        id: createdUserId,
        email: createdEmail,
        full_name: fullName,
      },
    });
  } catch (error: unknown) {
    console.error("admin-create-user failed:", error);

    const errorObject =
      typeof error === "object" && error !== null
        ? (error as Record<string, unknown>)
        : {};

    const errorMessage =
      typeof errorObject.message === "string"
        ? errorObject.message
        : error instanceof Error
          ? error.message
          : String(error);

    return jsonResponse(
      {
        error: errorMessage,
        code: errorObject.code ?? null,
        details: errorObject.details ?? null,
        hint: errorObject.hint ?? null,
      },
      400
    );
  }
});
