// mpesa-callback — Safaricom Daraja STK push result webhook.
//
// Daraja POSTs the outcome of an STK push here. We match the CheckoutRequestID
// to the pending subscription created in mpesa-stk-push and settle it:
//   ResultCode === 0  -> activate the subscription + promote the business tier
//   otherwise         -> mark past_due / cancelled
//
// verify_jwt = false — Safaricom cannot send a Supabase JWT. Authentication is
// therefore a shared secret (MPESA_CALLBACK_SECRET) that mpesa-stk-push bakes
// into the CallBackURL it registers, and that we compare here in constant time.
// Without it, anyone who learned this URL could POST `ResultCode: 0` for a
// CheckoutRequestID they minted themselves and be promoted to a paid tier for
// free. Three checks stand between a request and a tier change:
//
//   1. the shared secret must match          (is this really Safaricom?)
//   2. the paid Amount must equal amount_kes (did they actually pay the price?)
//   3. the subscription must be pending      (is this a replay of a settled one?)
//
// Anything that fails 2 or 3 is acknowledged but changes nothing, so Daraja
// stops retrying and a human reconciles. A request that fails 1 is rejected
// outright with 401 — we do not acknowledge unauthenticated callers.
//
// Daraja callback shape:
//   { Body: { stkCallback: {
//       MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc,
//       CallbackMetadata?: { Item: [{ Name, Value }, ...] } } } }

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { extractCallbackToken, timingSafeEqual } from "../_shared/security.ts";

const PERIOD_DAYS = 30;

/** Flatten Daraja's `CallbackMetadata.Item` array into a plain lookup. */
function readCallbackMetadata(
  cb: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const items = (cb?.CallbackMetadata as { Item?: unknown[] } | undefined)?.Item;
  if (!Array.isArray(items)) return {};

  const out: Record<string, unknown> = {};
  for (const item of items) {
    const entry = item as { Name?: unknown; Value?: unknown };
    if (typeof entry?.Name === "string") out[entry.Name] = entry.Value;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  // --- 1. Authenticate the caller ------------------------------------------
  // Fail closed: with no secret configured we cannot tell Safaricom from anyone
  // else, so we refuse to touch the subscription rather than trust the payload.
  const expectedToken = Deno.env.get("MPESA_CALLBACK_SECRET");
  if (!expectedToken) {
    console.error("mpesa-callback: MPESA_CALLBACK_SECRET is not set; refusing");
    return errorResponse("Server misconfigured", 503);
  }

  const presentedToken = extractCallbackToken(req.url);
  if (!presentedToken || !timingSafeEqual(presentedToken, expectedToken)) {
    console.error("mpesa-callback: rejected a callback with a bad token");
    return errorResponse("Unauthorized", 401);
  }

  // Past this point the caller is Safaricom. Everything else is a data problem,
  // so we acknowledge (ResultCode 0 / "Accepted") to stop Daraja retrying and
  // let a human reconcile out of band.
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
      .select("id, business_id, tier, status, amount_kes")
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

    // --- 3. Replay guard ----------------------------------------------------
    // Daraja retries on any non-2xx, and a replayed success would otherwise
    // extend the period and re-promote the tier every time it landed.
    if (sub.status !== "pending_payment") {
      console.warn(
        `mpesa-callback: ignoring callback for already-settled subscription ${sub.id} (status=${sub.status})`,
      );
      return json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (resultCode === 0) {
      // --- 2. Verify the customer actually paid the tier price --------------
      const metadata = readCallbackMetadata(cb);
      const paidAmount = Number(metadata.Amount);
      const receiptNumber = metadata.MpesaReceiptNumber;

      if (!Number.isFinite(paidAmount) || Math.round(paidAmount) !== sub.amount_kes) {
        console.error(
          `mpesa-callback: amount mismatch for subscription ${sub.id} — ` +
            `callback says ${metadata.Amount}, subscription expects ${sub.amount_kes}. Not activating.`,
        );
        return json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      const now = new Date();
      const end = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

      // `.eq("status", "pending_payment")` makes the transition atomic: two
      // callbacks racing each other cannot both activate the subscription.
      const { data: activated, error: subErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          mpesa_receipt_number: typeof receiptNumber === "string" ? receiptNumber : null,
        })
        .eq("id", sub.id)
        .eq("status", "pending_payment")
        .select("id");

      if (subErr) {
        console.error("subscription activate failed:", subErr.message);
        return json({ ResultCode: 0, ResultDesc: "Accepted" });
      }
      if (!activated?.length) {
        // Another callback won the race. It already promoted the tier.
        console.warn(`mpesa-callback: subscription ${sub.id} was settled concurrently`);
        return json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      // Only ever promote the tier off the back of a verified, first-time payment.
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
        .eq("id", sub.id)
        .eq("status", "pending_payment");
      if (subErr) console.error("subscription fail update failed:", subErr.message);
    }
  } catch (e) {
    console.error("mpesa-callback unexpected error:", e);
  }

  // Always acknowledge an authenticated caller.
  return json({ ResultCode: 0, ResultDesc: "Accepted" });
});
