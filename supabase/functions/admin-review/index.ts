// admin-review — the staff-only onboarding queue: list pending registrations
// and claims, approve or reject each, log every decision, and fire the
// welcome email on approval.
//
// verify_jwt = true authenticates "some user"; AUTHORIZATION is the
// profiles.is_staff flag read here with the service role. A valid JWT without
// the flag buys exactly a 403.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { INTERNAL_SECRET_HEADER } from "../_shared/internal-auth.ts";

const SIGNED_URL_SECONDS = 600; // 10 minutes: long enough to review, not to share
const QUEUE_PAGE = 20;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return errorResponse("Not authenticated", 401);
  const staffId = userData.user.id;

  const service = createServiceClient();
  const { data: me } = await service
    .from("profiles").select("is_staff").eq("id", staffId).maybeSingle();
  if (!me?.is_staff) return errorResponse("Staff only", 403);

  switch (body.action) {
    case "queue":
      return await queue(service, body);
    case "approve":
      return await decide(service, staffId, body, "approved");
    case "reject":
      return await decide(service, staffId, body, "rejected");
    default:
      return errorResponse("`action` must be queue|approve|reject", 400);
  }
});

// deno-lint-ignore no-explicit-any
async function signDoc(service: any, path: string): Promise<string | null> {
  const { data } = await service.storage
    .from("verification-docs")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

// deno-lint-ignore no-explicit-any
async function queue(service: any, body: Record<string, unknown>) {
  const cursor = typeof body.cursor === "string" ? body.cursor : null;

  let regQuery = service
    .from("businesses")
    .select(
      "id, slug, name, hood, created_at, city:cities(name), category:categories(label), " +
        "verification:business_verifications(kra_pin, contact_phone, id_document_path, applicant_note)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_PAGE);
  if (cursor) regQuery = regQuery.gt("created_at", cursor);
  const { data: registrations, error: regError } = await regQuery;
  if (regError) {
    console.error("admin-review queue (registrations):", regError.message);
    return errorResponse("Could not load the queue", 500);
  }

  let claimQuery = service
    .from("business_claims")
    .select(
      "id, business_id, claimant_id, role_title, kra_pin, contact_phone, " +
        "id_document_path, note, created_at, business:businesses(name, slug)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_PAGE);
  if (cursor) claimQuery = claimQuery.gt("created_at", cursor);
  const { data: claims, error: claimError } = await claimQuery;
  if (claimError) {
    console.error("admin-review queue (claims):", claimError.message);
    return errorResponse("Could not load the queue", 500);
  }

  // Attach short-lived signed URLs so staff can view private ID docs.
  // deno-lint-ignore no-explicit-any
  const withDocUrl = async (row: any, path: string | undefined) => ({
    ...row,
    id_document_url: path ? await signDoc(service, path) : null,
  });
  const regsOut = await Promise.all(
    (registrations ?? []).map((r: Record<string, unknown>) =>
      // deno-lint-ignore no-explicit-any
      withDocUrl(r, (r.verification as any)?.id_document_path)
    ),
  );
  const claimsOut = await Promise.all(
    (claims ?? []).map((c: Record<string, unknown>) =>
      withDocUrl(c, c.id_document_path as string)
    ),
  );

  return json({ registrations: regsOut, claims: claimsOut });
}

// deno-lint-ignore no-explicit-any
async function decide(
  service: any,
  staffId: string,
  body: Record<string, unknown>,
  action: "approved" | "rejected",
) {
  const kind = body.kind;
  const id = typeof body.id === "string" ? body.id : null;
  if ((kind !== "registration" && kind !== "claim") || !id) {
    return errorResponse("`kind` (registration|claim) and `id` are required", 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (action === "rejected" && (reason.length < 3 || reason.length > 2000)) {
    return errorResponse("`reason` is required to reject (3-2000 chars)", 400);
  }

  let emailTo: string | null = null;
  let emailBusinessName = "";
  let emailTier = "free";

  if (kind === "registration") {
    if (action === "approved") {
      const { data: rows, error } = await service
        .from("businesses")
        .update({ status: "active", verified_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("id, name, tier, owner_id");
      if (error) return errorResponse("Could not approve", 500);
      const biz = rows?.[0];
      if (!biz) return errorResponse("Already decided or not found", 409);
      emailBusinessName = biz.name;
      emailTier = biz.tier;
      emailTo = await ownerEmail(service, biz.owner_id);
    } else {
      const { data: rows, error } = await service
        .from("businesses")
        .update({ status: "unlisted" })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) return errorResponse("Could not reject", 500);
      if (!rows?.[0]) return errorResponse("Already decided or not found", 409);
    }
  } else {
    // Claims: read the pending claim first so we know business + claimant.
    const { data: claimRows } = await service
      .from("business_claims")
      .select("id, business_id, claimant_id, status, business:businesses(name, tier)")
      .eq("id", id)
      .eq("status", "pending");
    const claimRow = claimRows?.[0];
    if (!claimRow) return errorResponse("Already decided or not found", 409);

    if (action === "approved") {
      const { data: rows, error } = await service
        .from("businesses")
        .update({ owner_id: claimRow.claimant_id })
        .eq("id", claimRow.business_id)
        .is("owner_id", null)
        .select("id, name, tier");
      if (error) return errorResponse("Could not approve", 500);
      if (!rows?.[0]) {
        // Owner appeared since (another claim won the race). Leave this claim
        // pending so a human rejects it with a real reason.
        return errorResponse("This listing already has an owner", 409);
      }
      emailBusinessName = rows[0].name;
      emailTier = rows[0].tier;
      emailTo = await ownerEmail(service, claimRow.claimant_id);
    }

    const { error: claimUpdateError } = await service
      .from("business_claims")
      .update({ status: action, decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (claimUpdateError) return errorResponse("Could not record the decision", 500);
  }

  const { error: logError } = await service.from("admin_decisions").insert({
    subject_type: kind,
    subject_id: id,
    action,
    reason: reason || null,
    decided_by: staffId,
  });
  if (logError) console.error("admin-review: decision log failed:", logError.message);

  // Welcome email on approval — fire-and-forget: a mail failure is logged,
  // never surfaced, and never rolls back the decision.
  if (action === "approved" && emailTo) {
    try {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-onboarding-email`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [INTERNAL_SECRET_HEADER]: Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "",
          },
          body: JSON.stringify({ to: emailTo, businessName: emailBusinessName, tier: emailTier }),
        },
      );
      if (!res.ok) console.error("admin-review: welcome email failed:", res.status);
    } catch (e) {
      console.error("admin-review: welcome email failed:", e);
    }
  }

  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function ownerEmail(service: any, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await service
    .from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}
