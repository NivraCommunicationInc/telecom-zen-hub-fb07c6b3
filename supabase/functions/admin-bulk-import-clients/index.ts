import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface ClientToImport {
  name: string;
  email: string | null;
  phone: string;
}

interface BulkImportRequest {
  clients: ClientToImport[];
}

interface ImportResult {
  success: boolean;
  name: string;
  email: string | null;
  phone: string;
  user_id?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé - Aucun jeton fourni" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Non autorisé - Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Accès refusé - Rôle administrateur requis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${callingUser.email} starting bulk import`);

    // Parse request body
    const body: BulkImportRequest = await req.json();

    if (!body.clients || !Array.isArray(body.clients) || body.clients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Liste de clients requise" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Generate secure password
    const generateSecurePassword = (length = 16): string => {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let password = "";
      for (let i = 0; i < length; i++) {
        password += chars[array[i] % chars.length];
      }
      return password;
    };

    // Clean and validate email
    const cleanEmail = (email: string | null): string | null => {
      if (!email) return null;
      // Remove markdown links and clean the email
      let cleaned = email.replace(/<([^>]+)>/g, "$1").trim();
      cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
      
      // Check for invalid/placeholder emails
      const invalidPatterns = [
        /^x@/i,
        /^noemail@/i,
        /^no\.email@/i,
        /^nomail@/i,
        /^email@telus/i,
        /^noemial@/i,
        /^normail@/i,
        /^no2mail@/i,
        /^xemail@/i,
        /^moemail@/i,
        /^x\.@/i,
        /^\.@/i,
        /1111111111/,
      ];

      for (const pattern of invalidPatterns) {
        if (pattern.test(cleaned)) {
          return null;
        }
      }

      // Basic email validation
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      if (!emailRegex.test(cleaned)) {
        return null;
      }

      return cleaned.toLowerCase();
    };

    // Clean phone number
    const cleanPhone = (phone: string): string => {
      return phone.replace(/\D/g, "");
    };

    // Process each client
    for (const client of body.clients) {
      const cleanedEmail = cleanEmail(client.email);
      const cleanedPhone = cleanPhone(client.phone);
      const name = client.name.trim();

      // Skip invalid entries
      if (!name || name === "x" || name.length < 2) {
        results.push({
          success: false,
          name: client.name,
          email: client.email,
          phone: client.phone,
          error: "Nom invalide",
        });
        errorCount++;
        continue;
      }

      if (!cleanedPhone || cleanedPhone.length < 10 || cleanedPhone === "1111111111") {
        results.push({
          success: false,
          name: client.name,
          email: client.email,
          phone: client.phone,
          error: "Numéro de téléphone invalide",
        });
        errorCount++;
        continue;
      }

      // Generate a unique email if none provided
      const emailToUse = cleanedEmail || `client.${cleanedPhone}@nivra.temp`;
      
      try {
        // Check if email already exists
        const { data: existingUser } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .eq("email", emailToUse)
          .maybeSingle();

        if (existingUser) {
          results.push({
            success: false,
            name: name,
            email: cleanedEmail,
            phone: cleanedPhone,
            error: "Email déjà utilisé",
          });
          errorCount++;
          continue;
        }

        // Check if phone already exists
        const { data: existingPhone } = await supabaseAdmin
          .from("profiles")
          .select("id, phone")
          .eq("phone", cleanedPhone)
          .maybeSingle();

        if (existingPhone) {
          results.push({
            success: false,
            name: name,
            email: cleanedEmail,
            phone: cleanedPhone,
            error: "Téléphone déjà utilisé",
          });
          errorCount++;
          continue;
        }

        // Generate password
        const password = generateSecurePassword(16);

        // Create the user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: emailToUse,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            phone: cleanedPhone,
          },
        });

        if (createError || !newUser.user) {
          results.push({
            success: false,
            name: name,
            email: cleanedEmail,
            phone: cleanedPhone,
            error: createError?.message || "Erreur création utilisateur",
          });
          errorCount++;
          continue;
        }

        // Update profile with additional info
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            full_name: name,
            first_name: name.split(" ")[0] || name,
            last_name: name.split(" ").slice(1).join(" ") || null,
            phone: cleanedPhone,
            email: cleanedEmail, // Use the original cleaned email (null if invalid)
            account_status: "active",
            service_province: "QC",
          })
          .eq("user_id", newUser.user.id);

        if (profileError) {
          console.error(`Profile update error for ${name}:`, profileError);
        }

        // Assign client role
        await supabaseAdmin
          .from("user_roles")
          .upsert({
            user_id: newUser.user.id,
            role: "client",
          }, { onConflict: "user_id" });

        results.push({
          success: true,
          name: name,
          email: cleanedEmail,
          phone: cleanedPhone,
          user_id: newUser.user.id,
        });
        successCount++;
      } catch (err) {
        console.error(`Error importing ${name}:`, err);
        results.push({
          success: false,
          name: name,
          email: cleanedEmail,
          phone: cleanedPhone,
          error: err instanceof Error ? err.message : "Erreur inconnue",
        });
        errorCount++;
      }
    }

    // Log the activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: callingUser.id,
      action: "bulk_import_clients",
      entity_type: "profiles",
      actor_email: callingUser.email,
      actor_role: "admin",
      details: {
        total: body.clients.length,
        success: successCount,
        errors: errorCount,
      },
    });

    console.log(`Bulk import completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: body.clients.length,
        imported: successCount,
        errors: errorCount,
        results: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bulk import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
