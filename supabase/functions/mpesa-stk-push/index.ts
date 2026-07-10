// mpesa-stk-push — initiate an M-Pesa STK push for a subscription payment.
//
// Flow: get a Daraja OAuth token -> POST an STK push -> the customer approves
// on their phone -> Safaricom calls our mpesa-callback webhook with the result.
// Here we only START the payment and record a 'pending_payment' subscription
// keyed by the CheckoutRequestID; the callback flips it to active/failed.
//
// verify_jwt = false (called from the public checkout flow). SANDBOX values are
// used below — swap base URL + shortcode for production credentials at go-live.
//
// Env (Supabase secrets): MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
//   MPESA_PASSKEY, MPESA_CALLBACK_SECRET, and optionally MPESA_CALLBACK_URL.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { withCallbackToken } from "../_shared/security.ts";

// Daraja SANDBOX. Production base is https://api.safaricom.co.ke
const DARAJA_BASE = "https://sandbox.safaricom.co.ke";
// Sandbox Lipa Na M-Pesa Online shortcode (PayBill) used for STK push testing.
const SANDBOX_SHORTCODE = "174379";

// Subscription pricing (KES/month). Mirror in seed/docs when finalised.
const TIER_PRICING: Record<string, number> = {
  verified: 2500,
  recommended: 7500,
};

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: { business_id?: string; tier?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { business_id, tier, phone } = body;
  if (!business_id) return errorResponse("`business_id` is required", 400);
  if (!tier || !(tier in TIER_PRICING)) {
    return errorResponse("`tier` must be one of verified|recommended", 400);
  }
  // Phone in 2547XXXXXXXX format (Daraja requirement).
  if (!phone || !/^2547\d{8}$/.test(phone)) {
    return errorResponse("`phone` must be in 2547XXXXXXXX format", 400);
  }

  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  // mpesa-callback authenticates itself with this secret. Without it here, the
  // CallBackURL we register would carry no token and every real payment result
  // would be rejected — so refuse to start a payment we cannot settle.
  const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET");
  if (!consumerKey || !consumerSecret || !passkey || !callbackSecret) {
    return errorResponse("Server misconfigured (M-Pesa secrets missing)", 500);
  }

  const amount = TIER_PRICING[tier];

  // 1) OAuth token (Basic auth: base64(key:secret)).
  const basic = btoa(`${consumerKey}:${consumerSecret}`);
  const tokenRes = await fetch(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${basic}` } },
  );
  if (!tokenRes.ok) {
    console.error("Daraja OAuth failed:", tokenRes.status, await tokenRes.text());
    return errorResponse("Could not authenticate with M-Pesa", 502);
  }
  const { access_token } = await tokenRes.json();

  // 2) Build the STK push payload.
  //    Timestamp: YYYYMMDDHHmmss. Password: base64(shortcode + passkey + timestamp).
  const timestamp = darajaTimestamp(new Date());
  const password = btoa(`${SANDBOX_SHORTCODE}${passkey}${timestamp}`);
  // The shared secret rides on the URL: Daraja lets us register any CallBackURL
  // but never lets us set a request header on the callback it sends back.
  const callbackBase = Deno.env.get("MPESA_CALLBACK_URL") ??
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;
  const callbackUrl = withCallbackToken(callbackBase, callbackSecret);

  const stkRes = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: SANDBOX_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: SANDBOX_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: `KARIBU-${tier}`,
      TransactionDesc: `Karibu ${tier} subscription`,
    }),
  });

  if (!stkRes.ok) {
    console.error("Daraja STK push failed:", stkRes.status, await stkRes.text());
    return errorResponse("M-Pesa request failed", 502);
  }

  const stk = await stkRes.json();
  const checkoutRequestId: string | undefined = stk?.CheckoutRequestID;
  if (!checkoutRequestId) {
    console.error("No CheckoutRequestID in Daraja response:", stk);
    return errorResponse("M-Pesa did not return a checkout id", 502);
  }

  // 3) Record a pending subscription keyed by CheckoutRequestID. The callback
  //    matches on this id (stored in mpesa_transaction_id) to confirm/settle.
  const supabase = createServiceClient();
  const now = new Date();
  const { error: insertError } = await supabase.from("subscriptions").insert({
    business_id,
    tier,
    status: "pending_payment",
    // Placeholder window; the callback sets the real period on success.
    current_period_start: now.toISOString(),
    current_period_end: now.toISOString(),
    amount_kes: amount,
    mpesa_transaction_id: checkoutRequestId,
  });
  if (insertError) {
    console.error("subscription insert failed:", insertError.message);
    // Payment was initiated on the customer's phone; surface a soft error but
    // don't claim total failure — the callback can still reconcile.
    return errorResponse("Payment started but could not be recorded", 500);
  }

  return json({ CheckoutRequestID: checkoutRequestId });
});

/** Daraja timestamp: YYYYMMDDHHmmss in server local time. */
function darajaTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    String(d.getFullYear()) +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}
