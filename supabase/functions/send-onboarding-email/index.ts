// send-onboarding-email — warm welcome email to a newly onboarded business.
//
// Sent via Resend after a business is created / a subscription activates.
//
// verify_jwt = false (called from server-side flows, which carry no user JWT).
// It authenticates with the `x-karibu-internal-secret` header instead; see
// _shared/internal-auth.ts. Without that gate this is an open mail relay: any
// stranger could POST a recipient and an attacker-chosen `businessName` and
// have it delivered, signed and aligned, from our own verified sending domain.
// The cost is not the email — it is the domain reputation, and the phish that
// arrives looking exactly like us.
//
// RESEND_API_KEY is a Supabase secret.

import { handleOptions } from "../_shared/cors.ts";
import { requireInternalSecret } from "../_shared/internal-auth.ts";
import { errorResponse, json } from "../_shared/response.ts";

const RESEND_URL = "https://api.resend.com/emails";
// Update to a verified Resend sender domain before go-live.
const FROM_ADDRESS = "Karibu <hello@karibu.co.ke>";

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { to?: string; businessName?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { to, businessName, tier } = body;
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return errorResponse("`to` must be a valid email", 400);
  }
  if (!businessName) return errorResponse("`businessName` is required", 400);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return errorResponse("Server misconfigured (RESEND_API_KEY)", 500);

  const tierLine = tier
    ? `You're set up on the <strong>${escapeHtml(tier)}</strong> tier.`
    : "";

  const html = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color:#2A3D2B; max-width:560px; margin:0 auto;">
      <h1 style="font-family: 'Instrument Serif', Georgia, serif; font-weight:400; color:#B8472E;">Karibu sana, ${escapeHtml(businessName)}!</h1>
      <p>Welcome to Karibu — the local guide that newcomers to Kenya actually trust. You're now part of a directory built on verification and honest reviews, not ad spend.</p>
      ${tierLine ? `<p>${tierLine}</p>` : ""}
      <p>Next steps: complete your profile, add a few photos, and make sure your hours and contact details are current. The more complete your listing, the better it performs.</p>
      <p style="margin-top:24px;">Asante,<br/>The Karibu team</p>
    </div>
  `;

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: `Karibu sana — welcome, ${businessName}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", res.status, await res.text());
    return errorResponse("Could not send email", 502);
  }

  return json({ ok: true });
});

/** Minimal HTML escaping for interpolated user values. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
