-- 20260601000001_core_schema.sql
-- Karibu core schema: extensions, reference data, businesses, reviews, guides,
-- subscriptions, saved places, AI conversation logs, and all hot-path indexes.
-- Source of truth for the data model. See docs/DATA_MODEL.md.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;     -- geospatial queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy text search

-- ---------------------------------------------------------------------------
-- Reference data: cities, categories, sub_types
-- Small, read-only, fetched once on app load and held in client Context.
-- ---------------------------------------------------------------------------
CREATE TABLE cities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        text UNIQUE NOT NULL,                  -- 'nairobi', 'mombasa'
  name        text NOT NULL,
  country     text NOT NULL DEFAULT 'KE',
  tagline     text,
  hoods       text[] NOT NULL DEFAULT '{}',          -- neighbourhoods
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        text UNIQUE NOT NULL,                  -- 'hotels', 'transport'
  label       text NOT NULL,
  blurb       text,
  icon        text NOT NULL,                         -- lucide icon name
  sort_order  int NOT NULL,                          -- drives grid position
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE sub_types (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id  uuid NOT NULL REFERENCES categories(id),
  slug         text NOT NULL,
  label        text NOT NULL,
  icon         text NOT NULL,
  sort_order   int NOT NULL,
  UNIQUE (category_id, slug)
);
CREATE INDEX idx_sub_types_category ON sub_types(category_id);

-- ---------------------------------------------------------------------------
-- Businesses: the core listing
-- ---------------------------------------------------------------------------
CREATE TABLE businesses (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  category_id   uuid NOT NULL REFERENCES categories(id),
  sub_type_id   uuid REFERENCES sub_types(id),
  cuisine_type  text,                                -- only when category = 'restaurants'

  -- Location
  city_id       uuid NOT NULL REFERENCES cities(id),
  hood          text NOT NULL,
  address       text,
  location      geography(POINT, 4326),              -- WGS84

  -- Listing content
  about         text,
  price_range   text,                                -- 'KSh 1,500-6,000'
  tags          text[] DEFAULT '{}',
  hours_json    jsonb,                               -- structured opening hours
  services_json jsonb,                               -- [{name, price}]

  -- Contact
  phone         text,
  whatsapp      text,
  email         text,
  website       text,
  mpesa_till    text,
  mpesa_paybill text,

  -- Media
  hero_image_url    text,
  gallery_image_urls text[] DEFAULT '{}',

  -- Tier & status
  tier          text NOT NULL DEFAULT 'free',        -- 'free' | 'verified' | 'recommended'
  status        text NOT NULL DEFAULT 'pending',     -- 'pending' | 'active' | 'suspended' | 'unlisted'
  verified_at   timestamptz,
  improvement_until timestamptz,                      -- if in 60-day improvement window

  -- Ownership
  owner_id      uuid REFERENCES auth.users(id),

  -- Cached ranking fields (maintained by trigger / nightly job — never client-written)
  rating                  numeric(3,2) DEFAULT 0,
  review_count            int DEFAULT 0,
  recent_review_count_30d int DEFAULT 0,
  ranking_score           numeric DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT businesses_tier_chk   CHECK (tier   IN ('free','verified','recommended')),
  CONSTRAINT businesses_status_chk CHECK (status IN ('pending','active','suspended','unlisted'))
);

-- Hot-path indexes
CREATE INDEX idx_businesses_category ON businesses(category_id, sub_type_id);
CREATE INDEX idx_businesses_city     ON businesses(city_id);
CREATE INDEX idx_businesses_ranking  ON businesses(ranking_score DESC) WHERE status = 'active';
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);
CREATE INDEX idx_businesses_name_trgm ON businesses USING GIN(name gin_trgm_ops);
CREATE INDEX idx_businesses_owner    ON businesses(owner_id);
-- Keyset pagination of active listings by ranking (see db-performance skill)
CREATE INDEX idx_businesses_active_rank_id ON businesses(ranking_score DESC, id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Reviews: the heart of the ranking system
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reviewer_id   uuid REFERENCES auth.users(id),

  -- Reviewer context (denormalized for guest reviews)
  reviewer_name    text NOT NULL,
  reviewer_country text,                             -- 'United States'
  reviewer_type    text,                             -- 'tourist' | 'expat' | 'resident'

  -- The review itself
  rating         int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body           text NOT NULL CHECK (length(body) >= 40),
  service_used   text,
  recommendation text,                               -- 'yes' | 'caveats' | 'no'

  -- Moderation
  status          text NOT NULL DEFAULT 'pending_moderation',
                  -- 'pending_moderation' | 'published' | 'rejected' | 'flagged'
  moderation_notes text,
  flagged_at      timestamptz,
  rejected_reason text,

  -- Anti-abuse
  reviewer_ip          inet,
  reviewer_fingerprint text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,

  CONSTRAINT reviews_status_chk CHECK (status IN ('pending_moderation','published','rejected','flagged'))
);
CREATE INDEX idx_reviews_business ON reviews(business_id, status);
CREATE INDEX idx_reviews_recent   ON reviews(business_id, created_at DESC) WHERE status = 'published';
CREATE INDEX idx_reviews_moderation ON reviews(status) WHERE status = 'pending_moderation';

-- ---------------------------------------------------------------------------
-- Editorial guides
-- ---------------------------------------------------------------------------
CREATE TABLE guides (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         text UNIQUE NOT NULL,
  category     text NOT NULL,                        -- 'safety' | 'areas' | ...
  city_id      uuid REFERENCES cities(id),
  title        text NOT NULL,
  subtitle     text,
  summary      text,
  read_time    int,
  author       text,
  hero_image_url text,
  featured     boolean DEFAULT false,
  body_json    jsonb NOT NULL,                       -- block-based content
  related_businesses uuid[] DEFAULT '{}',
  ask_prompts  text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  published_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guides_published ON guides(is_published, featured) WHERE is_published = true;
CREATE INDEX idx_guides_city ON guides(city_id);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid NOT NULL REFERENCES businesses(id),
  tier          text NOT NULL,                       -- 'verified' | 'recommended'
  status        text NOT NULL,                       -- 'active' | 'past_due' | 'cancelled' | 'pending_payment'
  current_period_start timestamptz NOT NULL,
  current_period_end   timestamptz NOT NULL,
  amount_kes    int NOT NULL,
  mpesa_transaction_id text,
  cancelled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_tier_chk   CHECK (tier   IN ('verified','recommended')),
  CONSTRAINT subscriptions_status_chk CHECK (status IN ('active','past_due','cancelled','pending_payment'))
);
CREATE INDEX idx_subscriptions_business ON subscriptions(business_id, status);

-- ---------------------------------------------------------------------------
-- Saved places (per-user favorites)
-- ---------------------------------------------------------------------------
CREATE TABLE saved_places (
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  saved_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- ---------------------------------------------------------------------------
-- AI conversation logs (Ask Karibu analysis + improvement)
-- ---------------------------------------------------------------------------
CREATE TABLE ai_conversations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id),
  session_id  text NOT NULL,
  city_slug   text NOT NULL,
  messages_json jsonb NOT NULL,
  business_ids_returned uuid[],
  user_clicked_business_id uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX idx_ai_conversations_created ON ai_conversations(created_at DESC);
