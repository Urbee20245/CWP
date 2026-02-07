export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { sendPublicFormEmail } from "../_shared/publicEmailService.ts";

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Debug logging for environment variables
  console.log("[send-magic-link] Environment check:", {
    hasResendKey: !!Deno.env.get("RESEND_API_KEY"),
    fromEmail: Deno.env.get("SMTP_FROM_EMAIL"),
    fromName: Deno.env.get("SMTP_FROM_NAME"),
    supabaseUrl: !!Deno.env.get("SUPABASE_URL"),
    serviceRoleKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    siteUrl: Deno.env.get("SITE_URL"),
  });

  try {
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const redirectTo = (body?.redirect_to || `${Deno.env.get("SITE_URL") || "https://customwebsitesplus.com"}/back-office`).toString().trim();

    console.log("[send-magic-link] Request received", { email, redirectTo });

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ success: true }); // Avoid enumeration
    }

    // Generate magic link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error("[send-magic-link] generateLink failed", { message: error.message });
      return jsonResponse({ success: true });
    }

    const actionLink = (data as any)?.properties?.action_link;
    if (!actionLink) {
      console.error("[send-magic-link] missing action_link");
      return jsonResponse({ success: true });
    }

    const subject = "Your Magic Login Link — Custom Websites Plus";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0EA5E9; margin-bottom: 8px;">Your Magic Login Link</h2>
        <p style="color:#334155;">Click the link below to sign in to your Custom Websites Plus account:</p>
        
        <div style="margin: 18px 0;">
          <a href="${actionLink}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
            Sign In Instantly
          </a>
        </div>
        
        <p style="color:#64748b;font-size:14px;">This link will expire in 24 hours.</p>
        <p style="color:#64748b;font-size:12px; word-break: break-all; margin-top: 16px;">
          Or copy/paste this link into your browser:<br />
          ${actionLink}
        </p>
      </div>
    `;

    try {
      await sendPublicFormEmail(email, subject, html, "support@customwebsitesplus.com");
      console.log("[send-magic-link] magic link email sent via Resend", { email });
    } catch (e: any) {
      console.error("[send-magic-link] Resend failed, using Supabase fallback", { message: e?.message });
      
      // Fallback to Supabase's built-in magic link
      const { error: supabaseError } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      
      if (supabaseError) {
        console.error("[send-magic-link] Supabase fallback also failed", { message: supabaseError.message });
      } else {
        console.log("[send-magic-link] magic link sent via Supabase", { email });
      }
    }

    return jsonResponse({ success: true });
  } catch (e: any) {
    console.error("[send-magic-link] Error", { message: e?.message });
    return jsonResponse({ success: true });
  }
});