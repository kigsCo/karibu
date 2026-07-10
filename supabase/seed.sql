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
-- GUIDES (all 6 editorial guides, ported from the prototype constant)
--
-- GENERATED from the `guides` array in src/KaribuApp.jsx. Do not hand-edit the
-- bodies here; regenerate instead, so the live copy can never drift from the
-- prototype's. Blocks are stored as {"blocks": [...]} under body_json.
--
-- `updated_at` is pinned to April 2026 because the UI renders "Updated April
-- 2026" from this column. The `guides_set_updated_at` trigger only fires BEFORE
-- UPDATE, so the value inserted here survives.
--
-- related_businesses resolves slugs to UUIDs by subquery -- never a hardcoded
-- UUID, since PKs differ per environment.
-- ===========================================================================
INSERT INTO guides
  (slug, category, city_id, title, subtitle, summary, read_time, author,
   hero_variant, featured, body_json, related_businesses, ask_prompts,
   is_published, published_at, updated_at)
VALUES
  (
    'safety-nairobi', 'safety',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $g$Staying safe in Nairobi — the honest visitor's guide$g$,
    $g$What locals actually do, what to avoid, and when to trust your gut.$g$,
    $g$Nairobi is far safer than its reputation in international media suggests — but petty theft and opportunistic scams are real. Here's what to actually watch for, neighbourhood by neighbourhood.$g$,
    6, $g$Karibu Editorial$g$, 'default',
    true,
    $g${"blocks": [{"type": "p", "text": "Nairobi has a reputation problem that outpaces its reality. Most visitors have entirely uneventful trips — but that doesn't mean the city is consequence-free. Petty theft, opportunistic scams, and occasional muggings do happen, mostly in predictable places and at predictable times. Being a little informed removes 90% of the risk."}, {"type": "h", "text": "The three rules locals live by"}, {"type": "p", "text": "First: don't walk around with your phone out, especially near traffic. Phone snatchings from pedestrians and open car windows are the single most common incident. When using your phone on the street, step away from the road and into a doorway or shop."}, {"type": "p", "text": "Second: avoid walking after dark in the CBD (downtown). Westlands, Karen, Kilimani, and Lavington all have safe pockets you can walk in at night, but in CBD, take a ride after about 7pm even for short distances."}, {"type": "p", "text": "Third: don't carry more cash than you need. ATMs are plentiful and M-Pesa works everywhere. KSh 5,000–10,000 in your wallet is more than enough for most days."}, {"type": "callout", "tone": "warning", "text": "The scam to actually watch for: the \"helpful\" stranger at ATMs, and fake Uber drivers. Only get in a ride where the car plate matches your app exactly."}, {"type": "h", "text": "Neighbourhood feel, in one line each"}, {"type": "list", "items": ["Westlands — safe day and night, busy restaurants and malls, your likely home base.", "Karen & Lavington — leafy, residential, very safe, quieter.", "Kilimani — modern apartments, safe, lots of coffee and restaurants.", "CBD — fine in the day with normal awareness, not for an after-dark stroll.", "Eastleigh — fascinating food scene but go with a local or via trusted tour.", "Kibera — visit with a community-led tour operator only; don't wander."]}, {"type": "h", "text": "If something does happen"}, {"type": "p", "text": "Snatchings are almost never violent — they're grab-and-run. Let the phone go. The police emergency number is 999 or 112, but honestly the most useful first call is your hotel or Airbnb host, who can point you to the nearest police post and help translate if needed."}, {"type": "p", "text": "The overwhelming pattern is this: visitors who follow the three rules above have trip-of-a-lifetime experiences. The city is welcoming, the food is extraordinary, and the people are patient with first-timers. Relax — just stay aware."}]}$g$::jsonb,
    ARRAY[
      (SELECT id FROM businesses WHERE slug = 'posh-palace-salon'),
      (SELECT id FROM businesses WHERE slug = 'artcaffe-westgate')
    ]::uuid[],
    ARRAY[
      $g$What neighbourhoods are safest for a solo traveller?$g$,
      $g$Is it okay to walk from Westlands to Parklands at night?$g$,
      $g$Which ATMs are safest in Nairobi?$g$
    ],
    true, TIMESTAMPTZ '2026-04-01 00:00:00+00', TIMESTAMPTZ '2026-04-01 00:00:00+00'
  ),
  (
    'areas-nairobi', 'areas',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $g$Where should you stay in Nairobi?$g$,
    $g$A neighbourhood-by-neighbourhood breakdown for first-time visitors.$g$,
    $g$Nairobi is a city of neighbourhoods, each with its own vibe. Where you stay shapes your entire trip more than you'd expect.$g$,
    5, $g$Karibu Editorial$g$, 'artcaffe',
    true,
    $g${"blocks": [{"type": "p", "text": "Nairobi sprawls. It's bigger than most first-time visitors expect, and your choice of neighbourhood will shape whether you spend 20 minutes or 90 minutes in traffic getting anywhere. Here's the honest breakdown."}, {"type": "h", "text": "Westlands — the default pick, and for good reason"}, {"type": "p", "text": "Westlands is where most visitors end up, and it's a solid choice. You're 15 minutes from the National Museum, 20 minutes from Karen, and near three major malls (Sarit Centre, Westgate, The Oval). Nightlife is within walking distance. Hotels range from budget ($40) to luxury ($300+). The airport is about 45 minutes in light traffic, 90 in rush hour."}, {"type": "h", "text": "Karen — leafy, calm, a world away"}, {"type": "p", "text": "Karen feels like countryside inside the city. It's where you'll find the Giraffe Centre, Karen Blixen Museum, and Sheldrick Elephant Orphanage. The restaurants are excellent (Talisman, Cultiva, Hemingways). Downside: you'll Uber everywhere, and it can feel isolated if you want nightlife. Best for: families, repeat visitors, and people who want a slower pace."}, {"type": "h", "text": "Kilimani — modern and central"}, {"type": "p", "text": "Kilimani has exploded with mid-century apartment buildings and cafe culture. It's well-positioned between the CBD and the quieter west-side neighbourhoods. Lots of Airbnbs here. Great for a 3-5 day trip if you want to feel local."}, {"type": "callout", "tone": "tip", "text": "If it's your first trip under 4 nights, stay in Westlands. You'll thank us for the location."}, {"type": "h", "text": "Gigiri — near the UN"}, {"type": "p", "text": "Gigiri is where the UN complex and most embassies are. Quiet, secure, a bit removed. Good if you're here on business. Village Market mall is the social centre."}, {"type": "h", "text": "Lavington — residential sweet spot"}, {"type": "p", "text": "Between Kilimani and Karen in both geography and vibe. Very safe, good restaurants, fewer hotels but plenty of Airbnbs. The choice of people who've visited Nairobi before."}, {"type": "h", "text": "CBD — skip it unless you have a reason"}, {"type": "p", "text": "The CBD is where old colonial Nairobi meets modern commerce. Interesting to visit during the day, not somewhere to stay. Hotels here are either business travel (Sarova Stanley) or backpacker basic. Better neighbourhoods for almost any budget."}]}$g$::jsonb,
    ARRAY[
      (SELECT id FROM businesses WHERE slug = 'posh-palace-salon'),
      (SELECT id FROM businesses WHERE slug = 'the-talisman')
    ]::uuid[],
    ARRAY[
      $g$Which neighbourhood is best for a 3-night first visit?$g$,
      $g$Where should I stay if I want to be near nightlife?$g$,
      $g$What's the best area for families with kids?$g$
    ],
    true, TIMESTAMPTZ '2026-04-01 00:00:00+00', TIMESTAMPTZ '2026-04-01 00:00:00+00'
  ),
  (
    'transport-nairobi', 'transport',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $g$Getting around Nairobi without losing your mind$g$,
    $g$Uber, Bolt, matatus, and the art of timing traffic.$g$,
    $g$Nairobi traffic is legendary, and not in a good way. Here's how to move through the city like a local.$g$,
    4, $g$Karibu Editorial$g$, 'talisman',
    false,
    $g${"blocks": [{"type": "p", "text": "Nairobi traffic is a full contact sport. A 6-kilometre journey can take 20 minutes or 90 minutes depending entirely on when you leave. The good news: once you understand the patterns, you can work around them."}, {"type": "h", "text": "Rideshare: Uber and Bolt, not taxis"}, {"type": "p", "text": "Both apps work well and are cheap by international standards — a cross-town trip is typically KSh 400–900. Bolt is often 10-15% cheaper; Uber has more cars available. Always verify the plate number before getting in, and pay via the app rather than cash where possible."}, {"type": "h", "text": "The traffic rules"}, {"type": "list", "items": ["Morning peak: 7:00–10:00am — avoid any trip crossing Waiyaki Way or Thika Road.", "Evening peak: 4:30–7:30pm — exponentially worse than morning.", "Saturday lunch: strangely busy around malls.", "Sunday before 11am: empty roads, your window to see the city."]}, {"type": "callout", "tone": "tip", "text": "The Nairobi Expressway (toll road) turns a 90-minute airport trip into 25 minutes. Your driver will ask — say yes. Costs about KSh 300-400."}, {"type": "h", "text": "Matatus — the local experience"}, {"type": "p", "text": "Matatus are privately-run minibuses that form the backbone of Nairobi's public transit. They are cheap (KSh 50-100 per trip), loud, and an experience in themselves. They're also not really built for visitors — routes are poorly documented and they stop wherever they want. Take one once for the story, then go back to Uber."}, {"type": "h", "text": "Boda bodas (motorbike taxis)"}, {"type": "p", "text": "Fastest way through traffic, but skip them unless you're experienced. Accidents are common. If you must, use the Bolt app's Boda service so at least there's a trace, and always ask for a helmet."}]}$g$::jsonb,
    '{}'::uuid[],
    ARRAY[
      $g$How long does it take to get from Westlands to the airport?$g$,
      $g$Is it safe to use matatus as a visitor?$g$,
      $g$When's the best time to avoid traffic?$g$
    ],
    true, TIMESTAMPTZ '2026-04-01 00:00:00+00', TIMESTAMPTZ '2026-04-01 00:00:00+00'
  ),
  (
    'money-kenya', 'money',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $g$M-Pesa, cash, and the one payment system that rules everything$g$,
    $g$How Kenyans actually pay for things — and how you should too.$g$,
    $g$Kenya runs on M-Pesa — mobile money so pervasive that even street vendors prefer it to cash. Here's how to use it as a visitor.$g$,
    3, $g$Karibu Editorial$g$, 'default',
    false,
    $g${"blocks": [{"type": "p", "text": "You haven't really experienced modern Kenya until you've paid a boda boda driver by phone. M-Pesa is Safaricom's mobile money service, and it handles an astonishing share of daily transactions — small shops, ride payments, restaurant bills, utility bills, rent. Some businesses accept M-Pesa and nothing else."}, {"type": "h", "text": "Getting set up as a visitor"}, {"type": "p", "text": "Buy a Safaricom SIM on arrival (airport or any Safaricom shop, ~KSh 100). You'll need your passport. Load it with airtime and data, then register for M-Pesa at the same shop — it takes 10 minutes."}, {"type": "h", "text": "Cash vs card vs M-Pesa"}, {"type": "list", "items": ["M-Pesa: accepted almost everywhere, even small stalls.", "Cash (KSh): always works, carry small notes.", "Visa/Mastercard: accepted at hotels, malls, and mid-to-upscale restaurants. Not at small businesses.", "USD: accepted by some hotels and safari operators but at poor rates. Convert to KSh."]}, {"type": "callout", "tone": "tip", "text": "When paying by M-Pesa, the business gives you a \"Till number\" or \"Paybill number.\" You enter this in the M-Pesa menu, enter the amount, and confirm. Takes about 15 seconds."}, {"type": "h", "text": "Forex: rates and where to change"}, {"type": "p", "text": "ATMs give decent rates and are everywhere. Forex bureaus in Westlands and at malls give slightly better rates than hotels or banks. Never change money on the street."}]}$g$::jsonb,
    '{}'::uuid[],
    ARRAY[
      $g$How do I set up M-Pesa as a tourist?$g$,
      $g$What's the best forex rate in Nairobi right now?$g$,
      $g$Can I use my foreign credit card everywhere?$g$
    ],
    true, TIMESTAMPTZ '2026-04-01 00:00:00+00', TIMESTAMPTZ '2026-04-01 00:00:00+00'
  ),
  (
    'culture-kenya', 'culture',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $g$Greetings, tipping, and not being that tourist$g$,
    $g$Small things that matter. Big things that really matter.$g$,
    $g$Kenyans are generally patient with visitors, but a few small adjustments will transform how warmly people respond to you.$g$,
    3, $g$Karibu Editorial$g$, 'talisman',
    false,
    $g${"blocks": [{"type": "p", "text": "Kenya is a warm, social culture where how you greet someone matters more than what you ask them. The single biggest adjustment foreigners need to make is slowing down — transactions start with a greeting, not a request."}, {"type": "h", "text": "The greeting is the whole thing"}, {"type": "p", "text": "Don't walk into a shop and say \"How much is this?\" Walk in, make eye contact, say \"Habari\" (how are you) or \"Sasa\" (informal hi), wait for a response, then ask. This is true at shops, with your driver, at the hotel. The 15 seconds you spend on greeting pays back tenfold."}, {"type": "h", "text": "Tipping"}, {"type": "list", "items": ["Restaurants: 10% if service isn't already included. Many add a service charge — check the bill.", "Safari guides: KSh 1,000-2,000 per day is standard.", "Hotel porters: KSh 100-200 per bag.", "Uber/Bolt: not expected but appreciated — round up or add KSh 100.", "Tour guides on half-day trips: KSh 500-1,000."]}, {"type": "callout", "tone": "tip", "text": "\"Asante\" means thank you — use it generously. \"Karibu\" is the response (\"you're welcome\") and also means welcome when you first meet someone."}, {"type": "h", "text": "Photography and people"}, {"type": "p", "text": "Always ask before photographing people. This is true in markets, in Maasai villages, and on the street. Many people will happily say yes; some will ask for a small tip. Taking photos without asking is considered rude."}, {"type": "h", "text": "Dress and behaviour"}, {"type": "p", "text": "Nairobi is a cosmopolitan city — standard smart-casual is fine everywhere. More modest dress is appreciated in religious sites and older neighbourhoods like Old Town Mombasa. At the coast, swimwear on the beach only."}]}$g$::jsonb,
    '{}'::uuid[],
    ARRAY[
      $g$How much should I tip a safari guide?$g$,
      $g$What should I wear at the Kenyan coast?$g$,
      $g$Is it okay to photograph Maasai warriors?$g$
    ],
    true, TIMESTAMPTZ '2026-04-01 00:00:00+00', TIMESTAMPTZ '2026-04-01 00:00:00+00'
  ),
  (
    'health-kenya', 'health',
    (SELECT id FROM cities WHERE slug = 'nairobi'),
    $g$Health, water, and the malaria question$g$,
    $g$What to worry about, what to ignore, and where to go if something happens.$g$,
    $g$Nairobi's health infrastructure is strong, and most visitors never need to use it. Here's the 80/20 on staying healthy.$g$,
    4, $g$Karibu Editorial$g$, 'artcaffe',
    false,
    $g${"blocks": [{"type": "p", "text": "Most visits to Kenya are entirely uneventful health-wise. Nairobi sits at 1,795 metres elevation, which kills mosquitoes — there is essentially no malaria risk in the city itself. The coast and lowland areas are a different story."}, {"type": "h", "text": "Before you come"}, {"type": "list", "items": ["Yellow fever: required for entry if coming from a risk country; otherwise recommended.", "Hepatitis A and Typhoid: recommended.", "Routine vaccines up to date (MMR, Tdap, etc.).", "Malaria prophylaxis: needed for coast, safaris, and Kisumu — not for Nairobi itself. Talk to a travel clinic."]}, {"type": "callout", "tone": "tip", "text": "Water: bottled water is the safe bet for visitors. Ice in restaurants is usually fine (it's almost always made from filtered water), but ask if you're unsure. Most hotels and Airbnbs provide filtered or bottled water."}, {"type": "h", "text": "If you get sick"}, {"type": "p", "text": "Nairobi Hospital, Aga Khan Hospital, and Karen Hospital are all excellent, international-standard facilities. Most doctors speak English. Travel insurance is strongly recommended — not because healthcare is expensive (it's not), but because evacuation for serious cases can be."}, {"type": "h", "text": "Common visitor issues"}, {"type": "p", "text": "Mild stomach upset in the first few days is common and usually self-limiting. Carry oral rehydration salts. Sunburn at altitude is underestimated — the sun in Nairobi is fierce even when it's cool. Bring SPF 50+."}]}$g$::jsonb,
    '{}'::uuid[],
    ARRAY[
      $g$Do I need malaria meds for a Nairobi-only trip?$g$,
      $g$What's the best hospital in Nairobi for tourists?$g$,
      $g$Can I drink the water in my hotel?$g$
    ],
    true, TIMESTAMPTZ '2026-04-01 00:00:00+00', TIMESTAMPTZ '2026-04-01 00:00:00+00'
  )
ON CONFLICT (slug) DO NOTHING;
