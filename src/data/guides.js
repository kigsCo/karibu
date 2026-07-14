// src/data/guides.js
// Guides editorial fallback data extracted from src/KaribuApp.jsx (SP1
// architecture refactor, task 7b — pure code move, no behaviour change).
//
// `guides` (KAR-9) is the `fallback` passed to `useGuides`/`useGuideDetail` —
// first paint is identical, and the app still renders if Supabase is
// unreachable. `guideCategories` maps a guide's `category` key to its chip
// (icon/label/color); `GUIDE_CATEGORY_FALLBACK` is the PR #10 hardening fix
// that keeps that chip rendering instead of throwing when a DB-driven guide
// carries a category key not in the six above. All three are kept
// BYTE-FOR-BYTE identical to the literals they replaced.
import { Shield, Home, Car, Banknote, Lightbulb, HeartPulse, BookOpen } from "lucide-react";

// ---------- GUIDES DATA ----------
export const guideCategories = [
  { key: "safety", label: "Safety", Icon: Shield, color: "#B8472E", blurb: "Stay aware, stay relaxed" },
  { key: "areas", label: "Neighbourhoods", Icon: Home, color: "#2A3D2B", blurb: "Where to stay & why" },
  { key: "transport", label: "Transport", Icon: Car, color: "#D4A341", blurb: "Getting around Nairobi" },
  { key: "money", label: "Money & M-Pesa", Icon: Banknote, color: "#2A3D2B", blurb: "Cash, cards & mobile" },
  { key: "culture", label: "Culture & Etiquette", Icon: Lightbulb, color: "#B8472E", blurb: "Greetings, tipping, language" },
  { key: "health", label: "Health", Icon: HeartPulse, color: "#D4A341", blurb: "Vaccines, water, hospitals" },
];

// Guides are now DB-driven editorial content, so a row's `category` is not
// guaranteed to be one of the six keys above. Falling back keeps the category
// chip (icon + label) rendering instead of throwing on `cat.Icon` / `cat.label`
// when a guide carries an unmapped category.
export const GUIDE_CATEGORY_FALLBACK = { key: "", label: "Guide", Icon: BookOpen, color: "#6B7280", blurb: "" };

export const guides = [
  {
    id: "safety-nairobi",
    category: "safety",
    cityKey: "nairobi",
    title: "Staying safe in Nairobi — the honest visitor's guide",
    subtitle: "What locals actually do, what to avoid, and when to trust your gut.",
    readTime: 6,
    author: "Karibu Editorial",
    updated: "Updated April 2026",
    heroVariant: "default",
    featured: true,
    summary: "Nairobi is far safer than its reputation in international media suggests — but petty theft and opportunistic scams are real. Here's what to actually watch for, neighbourhood by neighbourhood.",
    body: [
      { type: "p", text: "Nairobi has a reputation problem that outpaces its reality. Most visitors have entirely uneventful trips — but that doesn't mean the city is consequence-free. Petty theft, opportunistic scams, and occasional muggings do happen, mostly in predictable places and at predictable times. Being a little informed removes 90% of the risk." },
      { type: "h", text: "The three rules locals live by" },
      { type: "p", text: "First: don't walk around with your phone out, especially near traffic. Phone snatchings from pedestrians and open car windows are the single most common incident. When using your phone on the street, step away from the road and into a doorway or shop." },
      { type: "p", text: "Second: avoid walking after dark in the CBD (downtown). Westlands, Karen, Kilimani, and Lavington all have safe pockets you can walk in at night, but in CBD, take a ride after about 7pm even for short distances." },
      { type: "p", text: "Third: don't carry more cash than you need. ATMs are plentiful and M-Pesa works everywhere. KSh 5,000–10,000 in your wallet is more than enough for most days." },
      { type: "callout", tone: "warning", text: "The scam to actually watch for: the \"helpful\" stranger at ATMs, and fake Uber drivers. Only get in a ride where the car plate matches your app exactly." },
      { type: "h", text: "Neighbourhood feel, in one line each" },
      { type: "list", items: [
        "Westlands — safe day and night, busy restaurants and malls, your likely home base.",
        "Karen & Lavington — leafy, residential, very safe, quieter.",
        "Kilimani — modern apartments, safe, lots of coffee and restaurants.",
        "CBD — fine in the day with normal awareness, not for an after-dark stroll.",
        "Eastleigh — fascinating food scene but go with a local or via trusted tour.",
        "Kibera — visit with a community-led tour operator only; don't wander.",
      ]},
      { type: "h", text: "If something does happen" },
      { type: "p", text: "Snatchings are almost never violent — they're grab-and-run. Let the phone go. The police emergency number is 999 or 112, but honestly the most useful first call is your hotel or Airbnb host, who can point you to the nearest police post and help translate if needed." },
      { type: "p", text: "The overwhelming pattern is this: visitors who follow the three rules above have trip-of-a-lifetime experiences. The city is welcoming, the food is extraordinary, and the people are patient with first-timers. Relax — just stay aware." },
    ],
    relatedBusinesses: ["posh", "artcaffe"],
    askPrompts: [
      "What neighbourhoods are safest for a solo traveller?",
      "Is it okay to walk from Westlands to Parklands at night?",
      "Which ATMs are safest in Nairobi?",
    ],
  },
  {
    id: "areas-nairobi",
    category: "areas",
    cityKey: "nairobi",
    title: "Where should you stay in Nairobi?",
    subtitle: "A neighbourhood-by-neighbourhood breakdown for first-time visitors.",
    readTime: 5,
    author: "Karibu Editorial",
    updated: "Updated April 2026",
    heroVariant: "artcaffe",
    featured: true,
    summary: "Nairobi is a city of neighbourhoods, each with its own vibe. Where you stay shapes your entire trip more than you'd expect.",
    body: [
      { type: "p", text: "Nairobi sprawls. It's bigger than most first-time visitors expect, and your choice of neighbourhood will shape whether you spend 20 minutes or 90 minutes in traffic getting anywhere. Here's the honest breakdown." },
      { type: "h", text: "Westlands — the default pick, and for good reason" },
      { type: "p", text: "Westlands is where most visitors end up, and it's a solid choice. You're 15 minutes from the National Museum, 20 minutes from Karen, and near three major malls (Sarit Centre, Westgate, The Oval). Nightlife is within walking distance. Hotels range from budget ($40) to luxury ($300+). The airport is about 45 minutes in light traffic, 90 in rush hour." },
      { type: "h", text: "Karen — leafy, calm, a world away" },
      { type: "p", text: "Karen feels like countryside inside the city. It's where you'll find the Giraffe Centre, Karen Blixen Museum, and Sheldrick Elephant Orphanage. The restaurants are excellent (Talisman, Cultiva, Hemingways). Downside: you'll Uber everywhere, and it can feel isolated if you want nightlife. Best for: families, repeat visitors, and people who want a slower pace." },
      { type: "h", text: "Kilimani — modern and central" },
      { type: "p", text: "Kilimani has exploded with mid-century apartment buildings and cafe culture. It's well-positioned between the CBD and the quieter west-side neighbourhoods. Lots of Airbnbs here. Great for a 3-5 day trip if you want to feel local." },
      { type: "callout", tone: "tip", text: "If it's your first trip under 4 nights, stay in Westlands. You'll thank us for the location." },
      { type: "h", text: "Gigiri — near the UN" },
      { type: "p", text: "Gigiri is where the UN complex and most embassies are. Quiet, secure, a bit removed. Good if you're here on business. Village Market mall is the social centre." },
      { type: "h", text: "Lavington — residential sweet spot" },
      { type: "p", text: "Between Kilimani and Karen in both geography and vibe. Very safe, good restaurants, fewer hotels but plenty of Airbnbs. The choice of people who've visited Nairobi before." },
      { type: "h", text: "CBD — skip it unless you have a reason" },
      { type: "p", text: "The CBD is where old colonial Nairobi meets modern commerce. Interesting to visit during the day, not somewhere to stay. Hotels here are either business travel (Sarova Stanley) or backpacker basic. Better neighbourhoods for almost any budget." },
    ],
    relatedBusinesses: ["posh", "talisman"],
    askPrompts: [
      "Which neighbourhood is best for a 3-night first visit?",
      "Where should I stay if I want to be near nightlife?",
      "What's the best area for families with kids?",
    ],
  },
  {
    id: "transport-nairobi",
    category: "transport",
    cityKey: "nairobi",
    title: "Getting around Nairobi without losing your mind",
    subtitle: "Uber, Bolt, matatus, and the art of timing traffic.",
    readTime: 4,
    author: "Karibu Editorial",
    updated: "Updated April 2026",
    heroVariant: "talisman",
    summary: "Nairobi traffic is legendary, and not in a good way. Here's how to move through the city like a local.",
    body: [
      { type: "p", text: "Nairobi traffic is a full contact sport. A 6-kilometre journey can take 20 minutes or 90 minutes depending entirely on when you leave. The good news: once you understand the patterns, you can work around them." },
      { type: "h", text: "Rideshare: Uber and Bolt, not taxis" },
      { type: "p", text: "Both apps work well and are cheap by international standards — a cross-town trip is typically KSh 400–900. Bolt is often 10-15% cheaper; Uber has more cars available. Always verify the plate number before getting in, and pay via the app rather than cash where possible." },
      { type: "h", text: "The traffic rules" },
      { type: "list", items: [
        "Morning peak: 7:00–10:00am — avoid any trip crossing Waiyaki Way or Thika Road.",
        "Evening peak: 4:30–7:30pm — exponentially worse than morning.",
        "Saturday lunch: strangely busy around malls.",
        "Sunday before 11am: empty roads, your window to see the city.",
      ]},
      { type: "callout", tone: "tip", text: "The Nairobi Expressway (toll road) turns a 90-minute airport trip into 25 minutes. Your driver will ask — say yes. Costs about KSh 300-400." },
      { type: "h", text: "Matatus — the local experience" },
      { type: "p", text: "Matatus are privately-run minibuses that form the backbone of Nairobi's public transit. They are cheap (KSh 50-100 per trip), loud, and an experience in themselves. They're also not really built for visitors — routes are poorly documented and they stop wherever they want. Take one once for the story, then go back to Uber." },
      { type: "h", text: "Boda bodas (motorbike taxis)" },
      { type: "p", text: "Fastest way through traffic, but skip them unless you're experienced. Accidents are common. If you must, use the Bolt app's Boda service so at least there's a trace, and always ask for a helmet." },
    ],
    relatedBusinesses: [],
    askPrompts: [
      "How long does it take to get from Westlands to the airport?",
      "Is it safe to use matatus as a visitor?",
      "When's the best time to avoid traffic?",
    ],
  },
  {
    id: "money-kenya",
    category: "money",
    cityKey: "nairobi",
    title: "M-Pesa, cash, and the one payment system that rules everything",
    subtitle: "How Kenyans actually pay for things — and how you should too.",
    readTime: 3,
    author: "Karibu Editorial",
    updated: "Updated April 2026",
    heroVariant: "default",
    summary: "Kenya runs on M-Pesa — mobile money so pervasive that even street vendors prefer it to cash. Here's how to use it as a visitor.",
    body: [
      { type: "p", text: "You haven't really experienced modern Kenya until you've paid a boda boda driver by phone. M-Pesa is Safaricom's mobile money service, and it handles an astonishing share of daily transactions — small shops, ride payments, restaurant bills, utility bills, rent. Some businesses accept M-Pesa and nothing else." },
      { type: "h", text: "Getting set up as a visitor" },
      { type: "p", text: "Buy a Safaricom SIM on arrival (airport or any Safaricom shop, ~KSh 100). You'll need your passport. Load it with airtime and data, then register for M-Pesa at the same shop — it takes 10 minutes." },
      { type: "h", text: "Cash vs card vs M-Pesa" },
      { type: "list", items: [
        "M-Pesa: accepted almost everywhere, even small stalls.",
        "Cash (KSh): always works, carry small notes.",
        "Visa/Mastercard: accepted at hotels, malls, and mid-to-upscale restaurants. Not at small businesses.",
        "USD: accepted by some hotels and safari operators but at poor rates. Convert to KSh.",
      ]},
      { type: "callout", tone: "tip", text: "When paying by M-Pesa, the business gives you a \"Till number\" or \"Paybill number.\" You enter this in the M-Pesa menu, enter the amount, and confirm. Takes about 15 seconds." },
      { type: "h", text: "Forex: rates and where to change" },
      { type: "p", text: "ATMs give decent rates and are everywhere. Forex bureaus in Westlands and at malls give slightly better rates than hotels or banks. Never change money on the street." },
    ],
    relatedBusinesses: [],
    askPrompts: [
      "How do I set up M-Pesa as a tourist?",
      "What's the best forex rate in Nairobi right now?",
      "Can I use my foreign credit card everywhere?",
    ],
  },
  {
    id: "culture-kenya",
    category: "culture",
    cityKey: "nairobi",
    title: "Greetings, tipping, and not being that tourist",
    subtitle: "Small things that matter. Big things that really matter.",
    readTime: 3,
    author: "Karibu Editorial",
    updated: "Updated April 2026",
    heroVariant: "talisman",
    summary: "Kenyans are generally patient with visitors, but a few small adjustments will transform how warmly people respond to you.",
    body: [
      { type: "p", text: "Kenya is a warm, social culture where how you greet someone matters more than what you ask them. The single biggest adjustment foreigners need to make is slowing down — transactions start with a greeting, not a request." },
      { type: "h", text: "The greeting is the whole thing" },
      { type: "p", text: "Don't walk into a shop and say \"How much is this?\" Walk in, make eye contact, say \"Habari\" (how are you) or \"Sasa\" (informal hi), wait for a response, then ask. This is true at shops, with your driver, at the hotel. The 15 seconds you spend on greeting pays back tenfold." },
      { type: "h", text: "Tipping" },
      { type: "list", items: [
        "Restaurants: 10% if service isn't already included. Many add a service charge — check the bill.",
        "Safari guides: KSh 1,000-2,000 per day is standard.",
        "Hotel porters: KSh 100-200 per bag.",
        "Uber/Bolt: not expected but appreciated — round up or add KSh 100.",
        "Tour guides on half-day trips: KSh 500-1,000.",
      ]},
      { type: "callout", tone: "tip", text: "\"Asante\" means thank you — use it generously. \"Karibu\" is the response (\"you're welcome\") and also means welcome when you first meet someone." },
      { type: "h", text: "Photography and people" },
      { type: "p", text: "Always ask before photographing people. This is true in markets, in Maasai villages, and on the street. Many people will happily say yes; some will ask for a small tip. Taking photos without asking is considered rude." },
      { type: "h", text: "Dress and behaviour" },
      { type: "p", text: "Nairobi is a cosmopolitan city — standard smart-casual is fine everywhere. More modest dress is appreciated in religious sites and older neighbourhoods like Old Town Mombasa. At the coast, swimwear on the beach only." },
    ],
    relatedBusinesses: [],
    askPrompts: [
      "How much should I tip a safari guide?",
      "What should I wear at the Kenyan coast?",
      "Is it okay to photograph Maasai warriors?",
    ],
  },
  {
    id: "health-kenya",
    category: "health",
    cityKey: "nairobi",
    title: "Health, water, and the malaria question",
    subtitle: "What to worry about, what to ignore, and where to go if something happens.",
    readTime: 4,
    author: "Karibu Editorial",
    updated: "Updated April 2026",
    heroVariant: "artcaffe",
    summary: "Nairobi's health infrastructure is strong, and most visitors never need to use it. Here's the 80/20 on staying healthy.",
    body: [
      { type: "p", text: "Most visits to Kenya are entirely uneventful health-wise. Nairobi sits at 1,795 metres elevation, which kills mosquitoes — there is essentially no malaria risk in the city itself. The coast and lowland areas are a different story." },
      { type: "h", text: "Before you come" },
      { type: "list", items: [
        "Yellow fever: required for entry if coming from a risk country; otherwise recommended.",
        "Hepatitis A and Typhoid: recommended.",
        "Routine vaccines up to date (MMR, Tdap, etc.).",
        "Malaria prophylaxis: needed for coast, safaris, and Kisumu — not for Nairobi itself. Talk to a travel clinic.",
      ]},
      { type: "callout", tone: "tip", text: "Water: bottled water is the safe bet for visitors. Ice in restaurants is usually fine (it's almost always made from filtered water), but ask if you're unsure. Most hotels and Airbnbs provide filtered or bottled water." },
      { type: "h", text: "If you get sick" },
      { type: "p", text: "Nairobi Hospital, Aga Khan Hospital, and Karen Hospital are all excellent, international-standard facilities. Most doctors speak English. Travel insurance is strongly recommended — not because healthcare is expensive (it's not), but because evacuation for serious cases can be." },
      { type: "h", text: "Common visitor issues" },
      { type: "p", text: "Mild stomach upset in the first few days is common and usually self-limiting. Carry oral rehydration salts. Sunburn at altitude is underestimated — the sun in Nairobi is fierce even when it's cool. Bring SPF 50+." },
    ],
    relatedBusinesses: [],
    askPrompts: [
      "Do I need malaria meds for a Nairobi-only trip?",
      "What's the best hospital in Nairobi for tourists?",
      "Can I drink the water in my hotel?",
    ],
  },
];
