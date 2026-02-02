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

  try {
    const body = await req.json();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const redirectTo = (body?.redirect_to || "").toString().trim();

    if (!email || !isValidEmail(email)) {
      // Do not reveal whether an email exists; still return success.
      return jsonResponse({ success: true });
    }

    // Generate a password recovery link server-side (bypasses Supabase SMTP)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) {
      console.error("[send-password-reset] generateLink failed", { message: error.message });
      // Still return success to avoid enumeration
      return jsonResponse({ success: true });
    }

    const actionLink = (data as any)?.properties?.action_link as string | undefined;
    if (!actionLink) {
      console.error("[send-password-reset] missing action_link in generateLink response");
      return jsonResponse({ success: true });
    }

    const subject = "Reset your password — Custom Websites Plus";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0EA5E9; margin-bottom: 8px;">Password reset request</h2>
        <p style="color:#334155;">We received a request to reset your password for your Custom Websites Plus account.</p>

        <div style="margin: 18px 0;">
          <a href="${actionLink}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
            Reset Password
          </a>
        </div>

        <p style="color:#64748b;font-size:14px;">If you didn’t request this, you can safely ignore this email.</p>
        <p style="color:#64748b;font-size:12px; word-break: break-all; margin-top: 16px;">
          Or copy/paste this link into your browser:<br />
          ${actionLink}
        </p>
      </div>
    `;

    try {
      await sendPublicFormEmail(email, subject, html, "support@customwebsiteplus.com");
      console.log("[send-password-reset] recovery email sent", { email });
    } catch (e: any) {
      console.error("[send-password-reset] sendPublicFormEmail failed", { message: e?.message });
      // Still return success to avoid enumeration
    }

    return jsonResponse({ success: true });
  } catch (e: any) {
    console.error("[send-password-reset] Error", { message: e?.message });
    // Still return success to avoid enumeration
    return jsonResponse({ success: true });
  }
});
