// business-intake — a signed-in user registers a new business or claims an
// existing listing. This is the only door into `status='pending'` rows and
// `business_claims`; there are no client INSERT policies on either table.
//
// verify_jwt = true (the platform guarantees a valid JWT; we read the uid via
// the user client). All writes use the service role — validation here IS the
// gate, so validate everything and trust nothing from the payload.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { checkGlobalRateLimit, checkIpRateLimit } from "../_shared/ratelimit.ts";
import { clientIpFromXff } from "../_shared/security.ts";
import {
  isInKenya,
  isValidKenyanPhone,
  isValidKraPin,
  newBusinessSlug,
  ownsPath,
} from "../_shared/onboarding.ts";

const DAY_SECONDS = 24 * 60 * 60;
const IP_MAX_PER_DAY = 10;          // both actions share the per-IP bucket
const REGISTER_MAX_PER_DAY = 3;     // per authenticated user
const CLAIM_MAX_PER_DAY = 5;        // per authenticated user
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const optStr = (v: unknown, max: number): string | null => {
  const s = str(v);
  return s && s.length <= max ? s : null;
};

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

  const action = body.action;
  if (action !== "register" && action !== "claim") {
    return errorResponse("`action` must be register|claim", 400);
  }

  // --- Who is asking (verified JWT) --------------------------------------
  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return errorResponse("Not authenticated", 401);
  const uid = userData.user.id;

  const service = createServiceClient();
  const ip = clientIpFromXff(req.headers.get("x-forwarded-for"));

  // --- Per-IP rate limit only, up front (record-first helper; RLS-independent).
  // The per-USER budget is spent inside register()/claim(), only once a
  // submission has passed full field validation — see the note there.
  if (!(await checkIpRateLimit(service, ip, "business-intake", IP_MAX_PER_DAY, DAY_SECONDS))) {
    return errorResponse("Rate limit", 429);
  }

  return action === "register"
    ? await register(service, uid, body)
    : await claim(service, uid, body);
});

// deno-lint-ignore no-explicit-any
async function register(service: any, uid: string, body: Record<string, unknown>) {
  // --- Validate every field before any write ------------------------------
  const name = optStr(body.name, 120);
  if (!name || name.length < 2) return errorResponse("`name` is required (2-120 chars)", 400);

  const about = optStr(body.about, 2000);
  if (!about || about.length < 20) {
    return errorResponse("`about` is required (20-2000 chars)", 400);
  }

  const categorySlug = str(body.category_slug);
  const citySlug = str(body.city_slug);
  const hood = optStr(body.hood, 80);
  if (!categorySlug || !citySlug || !hood) {
    return errorResponse("`category_slug`, `city_slug` and `hood` are required", 400);
  }

  const phone = str(body.phone);
  if (!isValidKenyanPhone(phone)) return errorResponse("`phone` must be a Kenyan number", 400);

  const hoursDisplay = optStr(body.hours_display, 200);
  if (!hoursDisplay) return errorResponse("`hours_display` is required", 400);

  if (!isValidKraPin(body.kra_pin)) {
    return errorResponse("`kra_pin` must match the KRA PIN format (e.g. A123456789Z)", 400);
  }

  const photoPaths = body.photo_paths;
  if (
    !Array.isArray(photoPaths) ||
    photoPaths.length < MIN_PHOTOS ||
    photoPaths.length > MAX_PHOTOS ||
    !photoPaths.every((p) => ownsPath(p, uid))
  ) {
    return errorResponse(
      `\`photo_paths\` must be ${MIN_PHOTOS}-${MAX_PHOTOS} uploads in your own folder`,
      400,
    );
  }
  if (!ownsPath(body.id_document_path, uid)) {
    return errorResponse("`id_document_path` must be an upload in your own folder", 400);
  }

  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;
  if ((lat === null) !== (lng === null)) {
    return errorResponse("`lat` and `lng` must be provided together", 400);
  }
  if (lat !== null && lng !== null && !isInKenya(lat, lng)) {
    return errorResponse("Location pin must be inside Kenya", 400);
  }

  // --- Spend the per-user daily budget only now that the submission is valid.
  // A malformed request (bad KRA PIN, too few photos, ...) must not cost the
  // merchant one of their 3 real attempts for the day.
  const userKey = `business-intake:register:${uid}`;
  if (!(await checkGlobalRateLimit(service, userKey, REGISTER_MAX_PER_DAY, DAY_SECONDS))) {
    return errorResponse("Rate limit", 429);
  }

  // --- Resolve reference slugs (service role; anon could read these anyway)
  const { data: city } = await service
    .from("cities").select("id, hoods").eq("slug", citySlug).eq("is_active", true)
    .maybeSingle();
  if (!city) return errorResponse("Unknown city", 400);
  if (!Array.isArray(city.hoods) || !city.hoods.includes(hood)) {
    return errorResponse("Unknown hood for that city", 400);
  }

  const { data: category } = await service
    .from("categories").select("id").eq("slug", categorySlug).maybeSingle();
  if (!category) return errorResponse("Unknown category", 400);

  let subTypeId: string | null = null;
  const subTypeSlug = str(body.sub_type_slug);
  if (subTypeSlug) {
    const { data: subType } = await service
      .from("sub_types").select("id").eq("slug", subTypeSlug)
      .eq("category_id", category.id).maybeSingle();
    if (!subType) return errorResponse("Unknown sub-type for that category", 400);
    subTypeId = subType.id;
  }

  // --- Insert the pending listing -----------------------------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publicPhotoUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/public/business-photos/${path}`;
  const photos = (photoPaths as string[]).map(publicPhotoUrl);

  // NOTE: .select() without .single() — PostgREST returns an array for
  // insert-with-representation, and the test stubs mirror that shape.
  const { data: createdRows, error: bizError } = await service
    .from("businesses")
    .insert({
      slug: newBusinessSlug(name),
      name,
      category_id: category.id,
      sub_type_id: subTypeId,
      city_id: city.id,
      hood,
      address: optStr(body.address, 200),
      about,
      price_range: optStr(body.price_range, 60),
      phone,
      whatsapp: isValidKenyanPhone(body.whatsapp) ? str(body.whatsapp) : null,
      email: optStr(body.email, 200),
      website: optStr(body.website, 300),
      // A plain string value: jsonb stores it as a JSON string, and
      // useBusinessDetail already accepts that shape. Do NOT JSON.stringify
      // here — supabase-js serializes the body; stringifying would double-encode.
      hours_json: hoursDisplay,
      hero_image_url: photos[0],
      gallery_image_urls: photos.slice(1),
      location: lat !== null ? `SRID=4326;POINT(${lng} ${lat})` : null,
      status: "pending",
      tier: "free",
      owner_id: uid,
    })
    .select("id, slug");

  const created = createdRows?.[0];
  if (bizError || !created) {
    console.error("business-intake: business insert failed:", bizError?.message);
    return errorResponse("Could not save your application", 500);
  }

  // --- Evidence row; compensate if it fails so no partial application lives
  const { error: verError } = await service.from("business_verifications").insert({
    business_id: created.id,
    submitted_by: uid,
    kra_pin: body.kra_pin,
    contact_phone: phone,
    id_document_path: body.id_document_path,
    applicant_note: optStr(body.applicant_note, 2000),
  });

  if (verError) {
    console.error("business-intake: verification insert failed:", verError.message);
    const { error: deleteError } = await service.from("businesses").delete().eq("id", created.id);
    if (deleteError) {
      // An orphaned pending business with no evidence row would otherwise be
      // silently undetectable — surface it so it can be cleaned up by hand.
      console.error(
        `business-intake: compensating delete of business ${created.id} ALSO failed:`,
        deleteError.message,
      );
    }
    return errorResponse("Could not save your application", 500);
  }

  return json({ id: created.id, slug: created.slug });
}

// deno-lint-ignore no-explicit-any
async function claim(service: any, uid: string, body: Record<string, unknown>) {
  const businessId = str(body.business_id);
  if (!businessId) return errorResponse("`business_id` is required", 400);
  if (!isValidKraPin(body.kra_pin)) {
    return errorResponse("`kra_pin` must match the KRA PIN format (e.g. A123456789Z)", 400);
  }
  const contactPhone = str(body.contact_phone);
  if (!isValidKenyanPhone(contactPhone)) {
    return errorResponse("`contact_phone` must be a Kenyan number", 400);
  }
  if (!ownsPath(body.id_document_path, uid)) {
    return errorResponse("`id_document_path` must be an upload in your own folder", 400);
  }

  // --- Spend the per-user daily budget only now that the submission is valid.
  const userKey = `business-intake:claim:${uid}`;
  if (!(await checkGlobalRateLimit(service, userKey, CLAIM_MAX_PER_DAY, DAY_SECONDS))) {
    return errorResponse("Rate limit", 429);
  }

  const { data: biz } = await service
    .from("businesses").select("id, status, owner_id").eq("id", businessId).maybeSingle();
  if (!biz) return errorResponse("Business not found", 404);
  if (biz.status !== "active") return errorResponse("This listing cannot be claimed", 409);
  if (biz.owner_id) return errorResponse("This listing is already managed", 409);

  const { count: openClaims } = await service
    .from("business_claims")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("claimant_id", uid)
    .eq("status", "pending");
  if ((openClaims ?? 0) > 0) {
    return errorResponse("You already have a claim under review for this listing", 409);
  }

  const { data: createdRows, error: insertError } = await service
    .from("business_claims")
    .insert({
      business_id: businessId,
      claimant_id: uid,
      role_title: optStr(body.role_title, 80),
      kra_pin: body.kra_pin,
      contact_phone: contactPhone,
      id_document_path: body.id_document_path,
      note: optStr(body.note, 2000),
    })
    .select("id, status");

  const created = createdRows?.[0];
  if (insertError || !created) {
    // 23505 = the partial unique index caught a race on the pending claim.
    const conflict = insertError?.code === "23505";
    if (!conflict) console.error("business-intake: claim insert failed:", insertError?.message);
    return conflict
      ? errorResponse("You already have a claim under review for this listing", 409)
      : errorResponse("Could not save your claim", 500);
  }

  return json({ id: created.id, status: created.status });
}
