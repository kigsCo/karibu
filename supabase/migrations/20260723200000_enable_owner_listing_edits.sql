-- 20260723200000_enable_owner_listing_edits.sql
-- Cycle 2 (merchant dashboard): activate owner self-editing.
--
-- The RLS policy "Owner updates own business" has existed since
-- 20260601000002 but is inert: 20260710160000 grants authenticated
-- SELECT-only on businesses. This grant is column-scoped to operational
-- fields; identity (name, category, city/hood, location), status, tier,
-- owner_id, and the cached ranking columns stay ungranted — Postgres, not
-- the UI, refuses those edits (42501).
GRANT UPDATE (hours_json, phone, whatsapp, email, website, about,
              price_range, address, hero_image_url, gallery_image_urls)
  ON public.businesses TO authenticated;

-- Bounds for the newly client-writable columns, following the profiles
-- precedent ("a client cannot store megabytes in a row"). The intake edge
-- function enforces the same or tighter limits; these CHECKs are the
-- backstop for the direct-UPDATE path.
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_about_chk
    CHECK (about IS NULL OR char_length(about) <= 2000),
  ADD CONSTRAINT businesses_address_chk
    CHECK (address IS NULL OR char_length(address) <= 200),
  ADD CONSTRAINT businesses_price_range_chk
    CHECK (price_range IS NULL OR char_length(price_range) <= 60),
  ADD CONSTRAINT businesses_phone_chk
    CHECK (phone IS NULL OR char_length(phone) <= 20),
  ADD CONSTRAINT businesses_whatsapp_chk
    CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 20),
  ADD CONSTRAINT businesses_email_chk
    CHECK (email IS NULL OR char_length(email) <= 200),
  ADD CONSTRAINT businesses_website_chk
    CHECK (website IS NULL OR char_length(website) <= 300),
  ADD CONSTRAINT businesses_hero_chk
    CHECK (hero_image_url IS NULL OR char_length(hero_image_url) <= 2048),
  -- "Up to 15 photos" per the tier copy.
  ADD CONSTRAINT businesses_gallery_chk
    CHECK (gallery_image_urls IS NULL
           OR array_length(gallery_image_urls, 1) IS NULL
           OR array_length(gallery_image_urls, 1) <= 15),
  ADD CONSTRAINT businesses_hours_json_chk
    CHECK (hours_json IS NULL OR pg_column_size(hours_json) <= 4096);
