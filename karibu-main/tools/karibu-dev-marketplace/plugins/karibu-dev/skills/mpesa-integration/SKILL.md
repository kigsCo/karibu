---
name: mpesa-integration
description: Use when implementing or altering M-Pesa payments for Karibu subscriptions — the Daraja STK push (mpesa-stk-push) and the callback handler (mpesa-callback). Covers the Daraja OAuth token, sandbox base URL and shortcode, the STK push payload, the pending_payment -> active subscription transition on ResultCode 0, idempotent callbacks, and that MPESA_* secrets live in Supabase.
---

# M-Pesa (Daraja) STK push + callback

Karibu's `verified`/`recommended` tiers are paid via **M-Pesa STK push** (Safaricom Daraja API). Two edge functions: `mpesa-stk-push` (request-path, initiates payment) and `mpesa-callback` (Daraja calls it back with the result). All `MPESA_*` credentials live in **Supabase's secret store**, never in code or `VITE_*` (guardrail 4).

## When to use
Implementing/altering `supabase/functions/mpesa-stk-push` or `mpesa-callback`, or the subscription state machine around them.

## Secrets (from Deno.env, set in Supabase)
`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`, `MPESA_ENV` (`sandbox` | `production`). Read them with `Deno.env.get(...)`.

## Daraja base URLs and shortcode
- **Sandbox** base: `https://sandbox.safaricom.co.ke`
- **Production** base: `https://api.safaricom.co.ke`
- **Sandbox test shortcode:** `174379` (Lipa Na M-Pesa Online sandbox paybill) with the sandbox passkey from the Daraja portal. Production uses the real till/paybill in `MPESA_SHORTCODE`.

## Step 1 — OAuth token
Daraja requires a short-lived bearer token (Basic auth = base64 of `key:secret`):
```ts
async function getDarajaToken(base: string): Promise<string> {
  const key = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const secret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
  const basic = btoa(`${key}:${secret}`);
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  const data = await res.json();           // { access_token, expires_in }
  return data.access_token;
}
```

## Step 2 — STK push (mpesa-stk-push, request-path)
Validate input (amount, phone in `2547XXXXXXXX` form, the `business_id`/tier), create a `subscriptions` row as `status = 'pending_payment'`, then POST the STK push. `Timestamp` is `YYYYMMDDHHmmss`; `Password = base64(Shortcode + Passkey + Timestamp)`.
```ts
const ts = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
const password = btoa(`${shortcode}${passkey}${ts}`);
const payload = {
  BusinessShortCode: shortcode,
  Password: password,
  Timestamp: ts,
  TransactionType: "CustomerPayBillOnline",
  Amount: amountKes,                       // integer KES
  PartyA: phone,                           // 2547XXXXXXXX
  PartyB: shortcode,
  PhoneNumber: phone,
  CallBackURL: Deno.env.get("MPESA_CALLBACK_URL"),  // -> the mpesa-callback function
  AccountReference: businessSlug,          // ties the payment to a business
  TransactionDesc: `Karibu ${tier} subscription`,
};
const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
// Response includes CheckoutRequestID / MerchantRequestID — persist these on the
// pending subscription so the async callback can be matched back to this row.
```
Store the returned `CheckoutRequestID` on the pending subscription (e.g. in `mpesa_transaction_id` or a dedicated column added via a migration) so the callback can find it. `verify_jwt = true` (only a signed-in owner buys a tier).

## Step 3 — callback (mpesa-callback)
Daraja POSTs the result to `MPESA_CALLBACK_URL`. This function is invoked by Safaricom, not the browser, so `verify_jwt = false` (verify authenticity by the matched `CheckoutRequestID`, not a user JWT). The body nests under `Body.stkCallback`:
```ts
const { Body } = await req.json();
const cb = Body?.stkCallback;
const checkoutId = cb?.CheckoutRequestID;
const resultCode = cb?.ResultCode;         // 0 = success
```
- **`ResultCode === 0`** => payment succeeded. Find the matching `subscriptions` row by `CheckoutRequestID`, and (idempotently) transition it: `status = 'active'`, set `current_period_start`/`current_period_end`, store the M-Pesa receipt in `mpesa_transaction_id` (from `CallbackMetadata`). Then promote the business `tier` to the purchased tier (`verified`/`recommended`).
- **`ResultCode !== 0`** => failed/cancelled. Leave the subscription `pending_payment` (or mark `past_due`/`cancelled` per policy); do not activate.
- **Always return `200` quickly** with `{ "ResultCode": 0, "ResultDesc": "Accepted" }` so Daraja stops retrying — acknowledge receipt even when the payment itself failed.

## Idempotency (required)
Daraja **retries callbacks** and may deliver duplicates. The callback must be **idempotent**: key on `CheckoutRequestID` (and/or the M-Pesa receipt), and only flip `pending_payment -> active` once. Re-processing an already-`active` subscription must be a no-op, not a double activation / double period extension. Use a conditional update (`... WHERE status = 'pending_payment'`) or a uniqueness constraint on the transaction id.

## Common mistakes
- Putting `MPESA_*` in `VITE_*` or committed config — they are Supabase secrets.
- Hitting the production base URL with sandbox creds (or vice versa) — switch on `MPESA_ENV`.
- Activating the subscription from the STK push response — activation happens only on the **callback** `ResultCode 0`.
- Non-idempotent callback => duplicate Daraja retries double-activate or double-extend the period.
- Not returning a fast 200 to Daraja (it keeps retrying).
- Wrong `Timestamp`/`Password` encoding (must be `base64(Shortcode+Passkey+Timestamp)`, same `Timestamp`).

## Checklist
- [ ] OAuth token fetched with Basic `base64(key:secret)`; base URL switches on `MPESA_ENV` (sandbox `174379`).
- [ ] STK push creates a `pending_payment` subscription and stores `CheckoutRequestID`.
- [ ] `mpesa-stk-push` is `verify_jwt = true`; `mpesa-callback` is `verify_jwt = false`.
- [ ] Callback activates only on `ResultCode 0`, sets period + `mpesa_transaction_id`, promotes business tier.
- [ ] Callback is idempotent (keyed on `CheckoutRequestID`/receipt); duplicate retries are no-ops.
- [ ] Callback returns a fast 200 acknowledgement to Daraja.
- [ ] All `MPESA_*` read from `Deno.env`.
