-- seed.sql — Karibu launch seed data.
-- Run via `supabase db reset` (applies migrations/ then this file).
--
-- Derived from the prototype constants in src/KaribuApp.jsx (cities, categories,
-- recommended, salonsList, reviewsSample, guides). Regenerate with the
-- `seed-data` skill if those constants change.
--
-- Idempotency: reference tables use ON CONFLICT (slug) DO NOTHING so re-running
-- against a non-reset DB won't duplicate them. Businesses/guides likewise key on
-- their UNIQUE slug. Reviews/subscriptions are not slug-keyed; this file is meant
-- to run on a FRESH `db reset`, so they are plain INSERTs.
--
-- FKs are resolved via subqueries on slug — NO hardcoded UUIDs (PKs are
-- uuid_generate_v4() and differ per environment).

-- ===========================================================================
-- CITIES (all 5 launch cities, active, with hoods)
-- ===========================================================================
INSERT INTO cities (slug, name, tagline, hoods, is_active, sort_order) VALUES
  ('nairobi',  'Nairobi',  'The capital',     ARRAY['Westlands','Karen','Kilimani','Lavington','CBD','Parklands'], true, 1),
  ('mombasa',  'Mombasa',  'Coastal',         ARRAY['Nyali','Diani','Bamburi','Old Town','CBD','Shanzu'],          true, 2),
  ('naivasha', 'Naivasha', 'Lake & wildlife', ARRAY['Town','Lakeshore',$$Hell's Gate$$],                          true, 3),
  ('kisumu',   'Kisumu',   'Lake Victoria',   ARRAY['Milimani','CBD','Riat Hills'],                               true, 4),
  ('nakuru',   'Nakuru',   'Rift Valley',     ARRAY['Milimani','Section 58','CBD'],                               true, 5)
ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- CATEGORIES (all 13 from the `categories` constant; blurb carried over,
-- icon = lucide name, sort_order = array position)
-- ===========================================================================
INSERT INTO categories (slug, label, blurb, icon, sort_order, is_active) VALUES
  ('hotels',      'Hotels & Housing',       'Stays for every length',          'Hotel',            1, true),
  ('transport',   'Transportation',         'Get around with ease',            'Car',              2, true),
  ('money',       'Money & Banking',        'Cash, forex, ATMs',               'Banknote',         3, true),
  ('health',      'Hospital & Pharmacy',    'Urgent and routine care',         'HeartPulse',       4, true),
  ('safari',      'Safaris & Attractions',  'Wildlife & day trips',            'Mountain',         5, true),
  ('beauty',      'Health & Beauty',        'Salons, spas, fitness',           'Sparkle',          6, true),
  ('restaurants', 'Restaurants',            'Cuisines from around the world',  'UtensilsCrossed',  7, true),
  ('cafes',       'Cafés & Coffee',         'Brunch and good coffee',          'Coffee',           8, true),
  ('laundry',     'Laundry & Dry Cleaning', 'Wash, fold, pressed',             'Shirt',            9, true),
  ('grocery',     'Groceries & Markets',    'Food shopping made easy',         'ShoppingCart',    10, true),
  ('nightlife',   'Nightlife',              'Bars, clubs, sports',             'Wine',            11, true),
  ('shopping',    'Shopping',               'Boutiques & souvenirs',           'ShoppingBag',     12, true),
  ('real_estate', 'Real Estate',            'Buy land, homes & more',          'Building2',       13, true)
ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- SUB_TYPES (full set, mirrors every categories[].subTypes in the prototype.
-- Restaurant cuisines are modelled here as sub_types of the `restaurants`
-- category; the frontend maps them into the `cuisineTags` shape.)
-- ===========================================================================
INSERT INTO sub_types (category_id, slug, label, icon, sort_order)
SELECT c.id, v.slug, v.label, v.icon, v.sort_order
FROM (VALUES
  -- Hotels & Housing
  ('hotels',     'hotels',          'Hotels',                    'Hotel',        1),
  ('hotels',     'resorts',         'Resorts',                   'Palmtree',     2),
  ('hotels',     'airbnb',          'Airbnb',                    'Home',         3),
  ('hotels',     'bnb',             'Bed & Breakfast',           'Bed',          4),
  ('hotels',     'vacation',        'Vacation Homes',            'Building',     5),
  ('hotels',     'short_rentals',   'Short-term Rentals',        'Building2',    6),
  ('hotels',     'long_rentals',    'Long-term Rentals',         'Building2',    7),
  -- Transportation
  ('transport',  'airport',         'Airport Transfers',         'Plane',        1),
  ('transport',  'taxi',            'Taxi Cabs',                 'Car',          2),
  ('transport',  'private_taxi',    'Private Taxis',             'Car',          3),
  ('transport',  'uber',            'Uber',                      'Car',          4),
  ('transport',  'bolt',            'Bolt',                      'Car',          5),
  ('transport',  'matatu',          'Matatu & Public Transport', 'Users',        6),
  -- Money & Banking
  ('money',      'forex',           'Currency Exchange',         'Banknote',     1),
  ('money',      'banks',           'Banks',                     'Landmark',     2),
  ('money',      'atms',            'ATMs',                      'Landmark',     3),
  -- Hospital & Pharmacy
  ('health',     'urgent',          'Urgent Care',               'Activity',     1),
  ('health',     'emergency',       'Emergency Room',            'Hospital',     2),
  ('health',     'clinics',         'Clinics',                   'Stethoscope',  3),
  ('health',     'chemists',        'Chemists & Pharmacy',       'Pill',         4),
  -- Health & Beauty
  ('beauty',     'hair',            'Hair Salons',               'Scissors',     1),
  ('beauty',     'nails',           'Nail Salons',               'Sparkle',      2),
  ('beauty',     'spa',             'Spas',                      'Sparkle',      3),
  ('beauty',     'massage',         'Massage',                   'Sparkle',      4),
  ('beauty',     'gym',             'Gyms',                      'Dumbbell',     5),
  -- Restaurants (cuisine tags modelled as sub_types; UI maps these to cuisineTags)
  ('restaurants','steak',           'Steakhouse',                'Beef',         1),
  ('restaurants','chinese',         'Chinese',                   'ChefHat',      2),
  ('restaurants','italian',         'Italian',                   'ChefHat',      3),
  ('restaurants','seafood',         'Seafood',                   'ChefHat',      4),
  ('restaurants','nyama_choma',     'Nyama Choma',               'Beef',         5),
  ('restaurants','kenyan',          'Kenyan Local',              'ChefHat',      6),
  ('restaurants','international',    'International',              'ChefHat',      7),
  -- Groceries & Markets
  ('grocery',    'supermarket',     'Supermarkets',              'ShoppingCart', 1),
  ('grocery',    'butchery',        'Butchery',                  'Beef',         2),
  ('grocery',    'farmers',         'Farmer''s Market',          'Carrot',       3),
  ('grocery',    'bakery',          'Bakery',                    'Cake',         4),
  -- Nightlife
  ('nightlife',  'sports_bar',      'Sports Bars',               'Beer',         1),
  ('nightlife',  'clubs',           'Clubs',                     'Music',        2),
  -- Shopping
  ('shopping',   'boutiques',       'Local Boutiques',           'Store',        1),
  ('shopping',   'souvenirs',       'Souvenirs',                 'Gift',         2),
  -- Real Estate
  ('real_estate','homes_sale',      'Homes for Sale',            'Home',         1),
  ('real_estate','apartments_sale', 'Apartments for Sale',       'Building',     2),
  ('real_estate','land_sale',       'Land for Sale',             'Trees',        3),
  ('real_estate','commercial',      'Commercial Property',       'Warehouse',    4),
  ('real_estate','agents',          'Real Estate Agents',        'Key',          5),
  ('real_estate','lawyers',         'Property Lawyers',          'Scale',        6),
  ('real_estate','surveyors',       'Surveyors',                 'Ruler',        7)
) AS v(cat_slug, slug, label, icon, sort_order)
JOIN categories c ON c.slug = v.cat_slug
ON CONFLICT (category_id, slug) DO NOTHING;

-- ===========================================================================
-- BUSINESSES (10 — the 6 salons from `salonsList` + 3 from `recommended`
-- (Posh dedup'd into the salons) + Talisman + Artcaffe. All Nairobi, active.
-- tier mapping: "Karibu Recommended" -> recommended, "Verified" -> verified,
-- null badge -> free. rating/review_count seeded from the prototype so the UI
-- looks alive; calculate-rankings will recompute ranking_score nightly.)
-- ===========================================================================
INSERT INTO businesses
  (slug, name, category_id, sub_type_id, cuisine_type, city_id, hood, about,
   price_range, tags, tier, status, rating, review_count)
SELECT
  v.slug, v.name,
  (SELECT id FROM categories WHERE slug = v.cat_slug),
  (SELECT st.id FROM sub_types st
     JOIN categories c ON c.id = st.category_id
    WHERE c.slug = v.cat_slug AND st.slug = v.subtype_slug),
  v.cuisine_type,
  (SELECT id FROM cities WHERE slug = 'nairobi'),
  v.hood, v.about, v.price_range, v.tags, v.tier, 'active', v.rating, v.review_count
FROM (VALUES
  -- slug, name, cat_slug, subtype_slug, cuisine, hood, about, price_range, tags, tier, rating, review_count
  ('posh-palace-salon', 'Posh Palace Salon', 'beauty', 'nails', NULL::text, 'Westlands',
   'A Westlands favourite for 12 years — known for meticulous gel work, warm hospitality, and a team of senior stylists who understand all hair textures. English, Swahili, and French spoken.',
   'KSh 1,500-6,000', ARRAY['Gel nails','Braids','Pedicure'], 'recommended', 4.8, 412),

  ('ashleys', 'Ashleys', 'beauty', 'hair', NULL, 'Lavington',
   'Full-service salon, kids welcome. A long-standing Lavington institution.',
   'KSh 1,200-5,500', ARRAY['Full-service','Kids welcome'], 'recommended', 4.6, 891),

  ('la-beaute', 'La Beauté', 'beauty', 'hair', NULL, 'Kilimani',
   'Brazilian blowout and nail artistry in the heart of Kilimani.',
   'KSh 2,000-7,000', ARRAY['Brazilian blowout','Nail artistry'], 'verified', 4.5, 287),

  ('sayuri-nail-bar', 'Sayuri Nail Bar', 'beauty', 'nails', NULL, 'Westlands',
   'Nails only, appointment preferred. A precise, modern nail bar in Westlands.',
   'KSh 2,500-4,500', ARRAY['Nails only','Appointment'], 'verified', 4.9, 163),

  ('zuri-beauty-lounge', 'Zuri Beauty Lounge', 'beauty', 'hair', NULL, 'Karen',
   'Walk-ins welcome and affordable. A relaxed Karen beauty lounge.',
   'KSh 1,000-4,000', ARRAY['Walk-ins','Affordable'], 'free', 4.3, 512),

  ('golden-scissors', 'Golden Scissors', 'beauty', 'hair', NULL, 'CBD',
   'Budget-friendly and central. A dependable CBD salon for a quick cut.',
   'KSh 800-3,000', ARRAY['Budget-friendly','Central'], 'free', 4.1, 734),

  ('the-talisman', 'The Talisman', 'restaurants', NULL, 'Pan-Asian', 'Karen',
   'A Karen institution — pan-Asian plates, a leafy garden, and a date-night atmosphere that has drawn Nairobi diners for years.',
   'KSh 2,500-5,000 pp', ARRAY['Pan-Asian','Garden seating','Date night'], 'recommended', 4.7, 1284),

  ('artcaffe-westgate', 'Artcaffe Westgate', 'cafes', NULL, NULL, 'Westlands',
   'All-day brunch, reliable Wi-Fi, and fresh pastries inside Westgate Mall — a dependable Westlands work-and-coffee spot.',
   'KSh 500-1,800', ARRAY['All-day brunch','Wi-Fi','Pastries'], 'free', 4.4, 2103),

  -- Two more representative listings to round out categories.
  ('nairobi-serena-hotel', 'Nairobi Serena Hotel', 'hotels', 'hotels', NULL, 'CBD',
   'A landmark five-star hotel set in garden grounds near the city centre, a longtime base for visiting dignitaries and leisure travellers alike.',
   'KSh 18,000-35,000', ARRAY['Five-star','Pool','City centre'], 'verified', 4.6, 938),

  ('yaya-forex-bureau', 'Yaya Forex Bureau', 'money', NULL, NULL, 'Kilimani',
   'Competitive currency-exchange rates at the Yaya Centre. Major currencies stocked; quick, transparent service for visitors.',
   'No fee', ARRAY['Currency exchange','Major currencies'], 'free', 4.2, 156)
) AS v(slug, name, cat_slug, subtype_slug, cuisine_type, hood, about, price_range, tags, tier, rating, review_count)
ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- REVIEWS (6 published — the 3 from `reviewsSample` attached to Posh Palace,
-- plus 3 more in the same voice across other businesses. status='published'
-- so they're publicly visible and feed ranking. published_at backdated.
-- NB: the AFTER INSERT trigger recomputes each business's cached rating from
-- its published reviews — these seeded rows update those caches on insert.)
-- ===========================================================================
INSERT INTO reviews
  (business_id, reviewer_name, reviewer_country, reviewer_type, rating, body,
   service_used, recommendation, status, published_at, created_at)
SELECT
  (SELECT id FROM businesses WHERE slug = v.biz_slug),
  v.reviewer_name, v.reviewer_country, v.reviewer_type, v.rating, v.body,
  v.service_used, v.recommendation, 'published',
  now() - (v.age_days || ' days')::interval,
  now() - (v.age_days || ' days')::interval
FROM (VALUES
  ('posh-palace-salon', 'Sarah M.', 'Germany', 'tourist', 5,
   $$Absolutely the best nail salon experience I've had in Nairobi. Booked via WhatsApp, they confirmed in 2 minutes. Agnes did my gel set — it's now 3 weeks old and no chips. They'll be my place every time I'm back.$$,
   'Gel manicure with art', 'yes', 3),

  ('posh-palace-salon', 'Jon A.', 'United States', 'tourist', 5,
   $$Came here on the recommendation of my AirBnB host. Secure parking, clean, and the staff walked me through every step since it was my first time getting a proper pedicure. Paid with M-Pesa, done in 45 minutes.$$,
   'Spa pedicure', 'yes', 7),

  ('posh-palace-salon', 'Priya R.', 'Kenya', 'resident', 4,
   $$Consistent quality over the 4 years I've been coming here. The newer stylist still learning but the senior team is world-class. A bit pricey but worth it for special occasions.$$,
   'Blow-dry & style', 'caveats', 14),

  ('the-talisman', 'Mark T.', 'United Kingdom', 'expat', 5,
   $$The garden setting at dusk is unbeatable and the pan-Asian menu genuinely delivers. We came for a birthday and the team made it special. Book ahead on weekends — it fills up fast.$$,
   'Dinner for two', 'yes', 9),

  ('artcaffe-westgate', 'Lena K.', 'Netherlands', 'tourist', 4,
   $$My reliable work-from-cafe spot for the week. Strong Wi-Fi, good flat white, and the brunch is solid. Gets busy mid-morning so come early if you want a quiet table.$$,
   'Brunch', 'caveats', 5),

  ('nairobi-serena-hotel', 'David O.', 'United States', 'tourist', 5,
   $$Stayed four nights and the service was flawless. Beautiful gardens, central location, and an easy base for day trips. The staff arranged airport transfers without any fuss.$$,
   'Deluxe room', 'yes', 11)
) AS v(biz_slug, reviewer_name, reviewer_country, reviewer_type, rating, body, service_used, recommendation, age_days);

-- ===========================================================================
-- GUIDES (2 from the `guides` constant — block-based body_json, published)
-- ===========================================================================
INSERT INTO guides
  (slug, category, city_id, title, subtitle, summary, read_time, author,
   featured, body_json, ask_prompts, is_published, published_at)
VALUES
  (
    'safety-nairobi', 'safety',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $$Staying safe in Nairobi — the honest visitor's guide$$,
    $$What locals actually do, what to avoid, and when to trust your gut.$$,
    $$Nairobi is far safer than its reputation in international media suggests — but petty theft and opportunistic scams are real. Here's what to actually watch for, neighbourhood by neighbourhood.$$,
    6, 'Karibu Editorial', true,
    $${
      "blocks": [
        {"type":"p","text":"Nairobi has a reputation problem that outpaces its reality. Most visitors have entirely uneventful trips — but that doesn't mean the city is consequence-free. Petty theft, opportunistic scams, and occasional muggings do happen, mostly in predictable places and at predictable times. Being a little informed removes 90% of the risk."},
        {"type":"h","text":"The three rules locals live by"},
        {"type":"p","text":"First: don't walk around with your phone out, especially near traffic. Phone snatchings from pedestrians and open car windows are the single most common incident."},
        {"type":"p","text":"Second: avoid walking after dark in the CBD. Westlands, Karen, Kilimani, and Lavington all have safe pockets at night, but in CBD take a ride after about 7pm."},
        {"type":"p","text":"Third: don't carry more cash than you need. ATMs are plentiful and M-Pesa works everywhere."},
        {"type":"callout","tone":"warning","text":"The scam to actually watch for: the helpful stranger at ATMs, and fake Uber drivers. Only get in a ride where the car plate matches your app exactly."},
        {"type":"list","items":["Westlands — safe day and night, your likely home base.","Karen & Lavington — leafy, residential, very safe.","Kilimani — modern apartments, safe, lots of cafes.","CBD — fine in the day, not for an after-dark stroll."]}
      ]
    }$$::jsonb,
    ARRAY[
      'What neighbourhoods are safest for a solo traveller?',
      $$Is it okay to walk from Westlands to Parklands at night?$$,
      'Which ATMs are safest in Nairobi?'
    ],
    true, now() - interval '60 days'
  ),
  (
    'areas-nairobi', 'areas',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    'Where should you stay in Nairobi?',
    'A neighbourhood-by-neighbourhood breakdown for first-time visitors.',
    $$Nairobi is a city of neighbourhoods, each with its own vibe. Where you stay shapes your entire trip more than you'd expect.$$,
    5, 'Karibu Editorial', true,
    $${
      "blocks": [
        {"type":"p","text":"Nairobi sprawls. Your choice of neighbourhood will shape whether you spend 20 minutes or 90 minutes in traffic getting anywhere. Here's the honest breakdown."},
        {"type":"h","text":"Westlands — the default pick, and for good reason"},
        {"type":"p","text":"Westlands is where most visitors end up. You're near three major malls and nightlife is within walking distance. The airport is about 45 minutes in light traffic."},
        {"type":"h","text":"Karen — leafy, calm, a world away"},
        {"type":"p","text":"Karen feels like countryside inside the city — the Giraffe Centre, Karen Blixen Museum, and excellent restaurants. You'll Uber everywhere."},
        {"type":"h","text":"Kilimani — modern and central"},
        {"type":"p","text":"Kilimani has exploded with apartment buildings and cafe culture, well-positioned between the CBD and the quieter west-side neighbourhoods."},
        {"type":"callout","tone":"tip","text":"If it's your first trip under 4 nights, stay in Westlands. You'll thank us for the location."}
      ]
    }$$::jsonb,
    ARRAY[
      'Which neighbourhood is best for a 3-night first visit?',
      'Where should I stay if I want to be near nightlife?',
      'What''s the best area for families with kids?'
    ],
    true, now() - interval '60 days'
  )
ON CONFLICT (slug) DO NOTHING;
