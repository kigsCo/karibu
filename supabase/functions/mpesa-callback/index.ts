// mpesa-callback — Safaricom Daraja STK push result webhook.
//
// Daraja POSTs the outcome of an STK push here. We match the CheckoutRequestID
// to the pending subscription created in mpesa-stk-push and settle it:
//   ResultCode === 0  -> activate the subscription + promote the business tier
//   otherwise         -> mark past_due / cancelled
//
// verify_jwt = false — Safaricom cannot send a Supabase JWT. We validate the
// payload shape ourselves. ALWAYS return ResultCode 0 / "Accepted" so Daraja
// does not retry; reconciliation of odd cases happens out of band.
//
// Daraja callback shape:
//   { Body: { stkCallback: {
//       MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc,
//       CallbackMetadata?: { Item: [{ Name, Value }, ...] } } } }

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { json } from "../_shared/response.ts";

const PERIOD_DAYS = 30;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  // We acknowledge everything (see header). Wrap all work so a parse/DB error
  // still returns the Accepted ack and never triggers a Daraja retry storm.
  try {
    const payload = await req.json();
    const cb = payload?.Body?.stkCallback;
    const checkoutRequestId: string | undefined = cb?.CheckoutRequestID;
    const resultCode = cb?.ResultCode;

    if (!checkoutRequestId) {
      console.error("mpesa-callback: missing CheckoutRequestID", payload);
      return json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const supabase = createServiceClient();

    // Locate the pending subscription we created at STK-push time.
    const { data: sub, error: findErr } = await supabase
      .from("subscriptions")
      .select("id, business_id, tier")
      .eq("mpesa_transaction_id", checkoutRequestId)
      .maybeSingle();

    if (findErr || !sub) {
      console.error(
        "mpesa-callback: no subscription for",
        checkoutRequestId,
        findErr?.message,
      );
      return json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (resultCode === 0) {
      // Success — activate for a 30-day period and promote the business tier.
      const now = new Date();
      const end = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
        })
        .eq("id", sub.id);
      if (subErr) console.error("subscription activate failed:", subErr.message);

      const { error: bizErr } = await supabase
        .from("businesses")
        .update({ tier: sub.tier, verified_at: now.toISOString() })
        .eq("id", sub.business_id);
      if (bizErr) console.error("business tier update failed:", bizErr.message);
    } else {
      // Failure / cancellation — mark accordingly. ResultCode 1032 == user
      // cancelled; treat that as cancelled, everything else as past_due.
      const status = resultCode === 1032 ? "cancelled" : "past_due";
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({
          status,
          cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
        })
        .eq("id", sub.id);
      if (subErr) console.error("subscription fail update failed:", subErr.message);
    }
  } catch (e) {
    console.error("mpesa-callback unexpected error:", e);
  }

  // Always acknowledge.
  return json({ ResultCode: 0, ResultDesc: "Accepted" });
});
