import React, { useState, useEffect, useMemo } from "react";
import {
  Search, MapPin, Bell, Heart, ChevronRight, ChevronLeft, Star,
  Phone, MessageCircle, Navigation, Globe, Clock, Check,
  Compass, Bookmark, Briefcase, User, Sparkles, Filter,
  Scissors, UtensilsCrossed, Car, Coffee, Shirt, Pill,
  Dumbbell, Landmark, ShoppingBag, Wine, ShoppingCart, Stethoscope,
  Wifi, Banknote, Plane, Mountain, ArrowUpRight, Shield, TrendingUp,
  Trophy, Camera, X, ThumbsUp, AlertCircle, Award,
  Send, Loader2, LogOut, BarChart3, Eye, MessageSquare, ArrowDown, ArrowUp,
  LayoutDashboard, Users, CircleDollarSign,
  BookOpen, Home, Lightbulb, HeartPulse, Building2, MoreHorizontal,
  Hotel, Bed, Palmtree, Building, Beer, Cookie, Hospital,
  ShoppingBasket, Beef, Wheat, Cake, Receipt, Sparkle, Music,
  Gift, Store, Croissant, ChefHat, Activity, Carrot,
  Trees, Key, Scale, Ruler, Warehouse,
} from "lucide-react";
import { supabase } from "./lib/supabase";
// KAR-5: `cities` and `categories` now come from Supabase (fetched once on app
// load) via the ReferenceDataProvider in App.jsx; read them inside each screen
// with `useReferenceData()`. The byte-identical prototype literals live in
// src/data/referenceData.js as the initial/fallback value (identical first
// paint, and the app still renders if Supabase is unreachable).
import { useReferenceData } from "./context/ReferenceDataContext.jsx";
// KAR-6: `recommended` + `salonsList` now come from Supabase via the
// keyset-paginated useBusinesses hook; the prototype constants below remain as
// the initial/fallback value (identical first paint, and the app still renders
// if Supabase is unreachable).
import { useBusinesses } from "./hooks/useBusinesses.js";
import { useBusinessDetail } from "./hooks/useBusinessDetail.js";

// ---------- DATA ----------
const visitorEssentials = [
  { label: "SIM & Data", sub: "Safaricom, Airtel", Icon: Wifi },
  { label: "Forex", sub: "Best rates today", Icon: Banknote },
  { label: "Safaris", sub: "Day trips & multi-day", Icon: Mountain },
  { label: "Airport", sub: "JKIA transfers", Icon: Plane },
];

const recommended = [
  {
    id: "posh",
    name: "Posh Palace Salon",
    category: "Salons & Nails",
    hood: "Westlands",
    rating: 4.8,
    reviews: 412,
    price: "KSh 1,500–6,000",
    openNow: true,
    badge: "Karibu Recommended",
    tags: ["Gel nails", "Braids", "Pedicure"],
    distanceKm: 2.3,
    image: "posh",
    about:
      "A Westlands favourite for 12 years — known for meticulous gel work, warm hospitality, and a team of senior stylists who understand all hair textures. English, Swahili, and French spoken.",
    services: [
      { name: "Classic manicure", price: "KSh 1,500" },
      { name: "Gel manicure with art", price: "KSh 3,500" },
      { name: "Spa pedicure", price: "KSh 2,800" },
      { name: "Box braids (medium)", price: "KSh 6,000" },
      { name: "Blow-dry & style", price: "KSh 2,200" },
    ],
    hours: "Mon–Sat 8:30am – 8:00pm · Sun 10am – 6pm",
    phone: "+254 722 000 000",
    whatsapp: "+254 722 000 000",
    mpesa: "Till 5589007",
  },
  {
    id: "talisman",
    name: "The Talisman",
    category: "Restaurants",
    hood: "Karen",
    rating: 4.7,
    reviews: 1284,
    price: "KSh 2,500–5,000 pp",
    openNow: true,
    badge: "Karibu Recommended",
    tags: ["Pan-Asian", "Garden seating", "Date night"],
    distanceKm: 11.4,
    image: "talisman",
  },
  {
    id: "artcaffe",
    name: "Artcaffe Westgate",
    category: "Coffee & Cafés",
    hood: "Westlands",
    rating: 4.4,
    reviews: 2103,
    price: "KSh 500–1,800",
    openNow: true,
    badge: null,
    tags: ["All-day brunch", "Wi-Fi", "Pastries"],
    distanceKm: 2.1,
    image: "artcaffe",
  },
];

const salonsList = [
  {
    id: "posh",
    name: "Posh Palace Salon",
    hood: "Westlands",
    rating: 4.8,
    reviews: 412,
    price: "KSh 1,500–6,000",
    openNow: true,
    badge: "Karibu Recommended",
    distanceKm: 2.3,
    tagline: "Gel specialists · multilingual team",
  },
  {
    id: "ashleys",
    name: "Ashleys",
    hood: "Lavington",
    rating: 4.6,
    reviews: 891,
    price: "KSh 1,200–5,500",
    openNow: true,
    badge: "Karibu Recommended",
    distanceKm: 4.7,
    tagline: "Full-service · kids welcome",
  },
  {
    id: "labeaute",
    name: "La Beauté",
    hood: "Kilimani",
    rating: 4.5,
    reviews: 287,
    price: "KSh 2,000–7,000",
    openNow: true,
    badge: "Verified",
    distanceKm: 3.2,
    tagline: "Brazilian blowout · nail artistry",
  },
  {
    id: "sayuri",
    name: "Sayuri Nail Bar",
    hood: "Westlands",
    rating: 4.9,
    reviews: 163,
    price: "KSh 2,500–4,500",
    openNow: false,
    badge: "Verified",
    distanceKm: 1.8,
    tagline: "Nails only · appointment preferred",
  },
  {
    id: "zuri",
    name: "Zuri Beauty Lounge",
    hood: "Karen",
    rating: 4.3,
    reviews: 512,
    price: "KSh 1,000–4,000",
    openNow: true,
    badge: null,
    distanceKm: 9.8,
    tagline: "Walk-ins · affordable",
  },
  {
    id: "goldenscissors",
    name: "Golden Scissors",
    hood: "CBD",
    rating: 4.1,
    reviews: 734,
    price: "KSh 800–3,000",
    openNow: true,
    badge: null,
    distanceKm: 5.6,
    tagline: "Budget-friendly · central",
  },
];

const reviewsSample = [
  {
    name: "Sarah M.",
    country: "🇩🇪 Visiting from Berlin",
    rating: 5,
    date: "3 days ago",
    text:
      "Absolutely the best nail salon experience I've had in Nairobi. Booked via WhatsApp, they confirmed in 2 minutes. Agnes did my gel set — it's now 3 weeks old and no chips. They'll be my place every time I'm back.",
  },
  {
    name: "Jon A.",
    country: "🇺🇸 New to Nairobi",
    rating: 5,
    date: "1 week ago",
    text:
      "Came here on the recommendation of my AirBnB host. Secure parking, clean, and the staff walked me through every step since it was my first time getting a proper pedicure. Paid with M-Pesa, done in 45 minutes.",
  },
  {
    name: "Priya R.",
    country: "🇰🇪 Kileleshwa",
    rating: 4,
    date: "2 weeks ago",
    text:
      "Consistent quality over the 4 years I've been coming here. The newer stylist still learning but the senior team is world-class. A bit pricey but worth it for special occasions.",
  },
];

// ---------- GUIDES DATA ----------
const guideCategories = [
  { key: "safety", label: "Safety", Icon: Shield, color: "#B8472E", blurb: "Stay aware, stay relaxed" },
  { key: "areas", label: "Neighbourhoods", Icon: Home, color: "#2A3D2B", blurb: "Where to stay & why" },
  { key: "transport", label: "Transport", Icon: Car, color: "#D4A341", blurb: "Getting around Nairobi" },
  { key: "money", label: "Money & M-Pesa", Icon: Banknote, color: "#2A3D2B", blurb: "Cash, cards & mobile" },
  { key: "culture", label: "Culture & Etiquette", Icon: Lightbulb, color: "#B8472E", blurb: "Greetings, tipping, language" },
  { key: "health", label: "Health", Icon: HeartPulse, color: "#D4A341", blurb: "Vaccines, water, hospitals" },
];

const guides = [
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
const HeroImage = ({ variant = "posh" }) => {
  // Warm-toned SVG placeholders so the prototype looks polished offline
  const palettes = {
    posh: ["#E8B89E", "#B8472E", "#3A2418"],
    talisman: ["#C9A76B", "#6F4E1F", "#1F1A11"],
    artcaffe: ["#E4D5B8", "#A48253", "#2C2317"],
    default: ["#E8B89E", "#B8472E", "#2A3D2B"],
  };
  const p = palettes[variant] || palettes.default;
  return (
    <svg viewBox="0 0 400 240" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`g-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p[0]} />
          <stop offset="60%" stopColor={p[1]} />
          <stop offset="100%" stopColor={p[2]} />
        </linearGradient>
        <pattern id={`pat-${variant}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12 L12 0 L24 12 L12 24 Z" fill="none" stroke={p[0]} strokeOpacity="0.18" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill={`url(#g-${variant})`} />
      <rect width="400" height="240" fill={`url(#pat-${variant})`} />
      <circle cx="320" cy="60" r="80" fill={p[0]} fillOpacity="0.3" />
      <circle cx="80" cy="200" r="110" fill={p[2]} fillOpacity="0.25" />
    </svg>
  );
};

// ---------- HELPERS ----------
const StarRow = ({ rating, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={i <= Math.round(rating) ? "fill-current" : ""}
        style={{ color: i <= Math.round(rating) ? "#D4A341" : "#D7CFC4" }}
      />
    ))}
  </span>
);

const Badge = ({ kind, children }) => {
  const styles = {
    recommended: { bg: "#FBF4E0", border: "#D4A341", color: "#7A5A10" },
    verified: { bg: "#EBEFE9", border: "#5C7A5E", color: "#2A3D2B" },
    open: { bg: "#EFF5EC", border: "#7A9A6F", color: "#2A3D2B" },
    closed: { bg: "#F3EEE9", border: "#B8A999", color: "#6B5B4A" },
  };
  const s = styles[kind] || styles.verified;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {kind === "recommended" && <Sparkles size={11} />}
      {kind === "verified" && <Check size={11} />}
      {children}
    </span>
  );
};

// ---------- STYLE BLOCK ----------
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    .font-serif-d { font-family: 'Instrument Serif', 'Georgia', serif; font-weight: 400; letter-spacing: -0.01em; }
    .font-sans-d { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    .bg-ivory { background-color: #F7F1E8; }
    .bg-ivory-2 { background-color: #F1E9DB; }
    .bg-clay { background-color: #B8472E; }
    .bg-clay-soft { background-color: #F3D9CF; }
    .bg-forest { background-color: #2A3D2B; }
    .bg-forest-soft { background-color: #EBEFE9; }
    .bg-ochre { background-color: #D4A341; }
    .bg-ochre-soft { background-color: #FBF4E0; }
    .bg-ink { background-color: #1C1613; }
    .text-clay { color: #B8472E; }
    .text-forest { color: #2A3D2B; }
    .text-ochre { color: #D4A341; }
    .text-ochre-d { color: #7A5A10; }
    .text-ink { color: #1C1613; }
    .text-stone-w { color: #8B8378; }
    .border-ink-10 { border-color: rgba(28,22,19,0.10); }
    .border-ink-20 { border-color: rgba(28,22,19,0.20); }
    .border-clay { border-color: #B8472E; }
    .border-ochre { border-color: #D4A341; }

    .phone-shadow { box-shadow: 0 40px 80px -20px rgba(40,25,15,0.35), 0 20px 40px -10px rgba(40,25,15,0.20); }

    .kitenge-bg {
      background-image:
        radial-gradient(circle at 25% 30%, rgba(184,71,46,0.06) 0%, transparent 40%),
        radial-gradient(circle at 75% 70%, rgba(42,61,43,0.05) 0%, transparent 40%);
    }

    .fade-in { animation: fadeIn 0.32s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .scroll-x { scrollbar-width: none; -ms-overflow-style: none; }
    .scroll-x::-webkit-scrollbar { display: none; }

    .hide-scroll::-webkit-scrollbar { display: none; }
    .hide-scroll { scrollbar-width: none; }

    .greeting-cycle { animation: greetingFade 9s ease-in-out infinite; }
    @keyframes greetingFade {
      0%, 22% { opacity: 1; }
      28%, 72% { opacity: 0.4; }
      78%, 100% { opacity: 1; }
    }

    .pulse-dot {
      animation: pulseDot 2s ease-in-out infinite;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `}</style>
);

// ---------- SCREEN: DISCOVER ----------
const DiscoverScreen = ({ go, activeCity, onOpenCityPicker }) => {
  const { cities, categories } = useReferenceData();
  // KAR-6: the carousel reads the live top-ranked active businesses. Not
  // city-filtered — the prototype shows the same cards in every city, and an
  // empty rail would collapse the section; live-and-empty keeps the fallback.
  const { items: liveTop } = useBusinesses({ fallback: recommended });
  const topBusinesses = (liveTop.length ? liveTop : recommended).slice(0, 6);
  const placeholders = [
    "nails in Westlands",
    "airport transfer tonight",
    "best nyama choma",
    "pharmacy open now",
    "forex bureau near me",
  ];
  const [phIndex, setPhIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % placeholders.length), 2400);
    return () => clearInterval(t);
  }, []);

  const cityLabel = cities.find((c) => c.key === activeCity)?.label || "Nairobi";

  return (
    <div className="fade-in">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-clay flex items-center justify-center">
            <span className="font-serif-d text-xl" style={{ color: "#F7F1E8", lineHeight: 1 }}>K</span>
          </div>
          <span className="font-serif-d text-xl text-ink">Karibu</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCityPicker}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-ink-10 bg-ivory-2 active:bg-ivory"
          >
            <MapPin size={12} className="text-clay" />
            <span className="text-xs font-medium text-ink">{cityLabel}</span>
            <ChevronRight size={10} className="text-stone-w rotate-90" />
          </button>
          <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
            <Bell size={15} className="text-ink" />
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 pt-4 pb-3">
        <div className="font-serif-d text-3xl text-ink leading-tight">
          <span className="greeting-cycle inline-block">Karibu,</span> traveller.
        </div>
        <div className="font-serif-d italic text-xl text-stone-w leading-tight mt-0.5">
          What do you need in {cityLabel}?
        </div>
      </div>

      {/* Ask Karibu AI search */}
      <div className="px-5 pb-5">
        <button
          onClick={() => go("ask")}
          className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-left relative overflow-hidden border"
          style={{ backgroundColor: "#FBF4E0", borderColor: "#D4A341" }}
        >
          <div className="w-8 h-8 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ochre-d uppercase tracking-wider">
              Ask Karibu · AI
            </div>
            <div className="text-sm text-ink mt-0.5 truncate">
              "<span className="italic">{placeholders[phIndex]}</span>"
            </div>
          </div>
          <ChevronRight size={16} className="text-ochre-d flex-shrink-0" />
        </button>
      </div>

      {/* Visitor essentials */}
      <div className="px-5 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-serif-d text-lg text-ink">For visitors</h3>
          <span className="text-xs text-stone-w uppercase tracking-wider">Karibu picks</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {visitorEssentials.map(({ label, sub, Icon }) => (
            <button
              key={label}
              className="flex flex-col items-center text-center px-1 py-3 rounded-xl bg-forest-soft border border-ink-10"
            >
              <div className="w-9 h-9 rounded-full bg-forest flex items-center justify-center mb-1.5">
                <Icon size={16} color="#F7F1E8" />
              </div>
              <span className="text-[11px] font-semibold text-ink leading-tight">{label}</span>
              <span className="text-[9px] text-stone-w leading-tight mt-0.5">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category grid */}
      <div className="px-5 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">Browse services</h3>
        <div className="grid grid-cols-3 gap-2">
          {categories.map((cat) => {
            const Icon = cat.Icon;
            const hasSubs = (cat.subTypes && cat.subTypes.length > 0) || (cat.cuisineTags && cat.cuisineTags.length > 0);
            return (
              <button
                key={cat.key}
                onClick={() => go(hasSubs ? "subcategory" : "category", cat)}
                className="flex flex-col items-center text-center py-3 px-1.5 rounded-xl border border-ink-10 hover:bg-ivory-2 transition"
              >
                <div className="w-9 h-9 rounded-full bg-clay-soft flex items-center justify-center mb-1.5">
                  <Icon size={16} className="text-clay" />
                </div>
                <span className="text-[10px] font-semibold text-ink leading-tight">{cat.label}</span>
                {hasSubs && (
                  <span className="text-[9px] text-stone-w leading-tight mt-0.5">
                    {cat.subTypes?.length || cat.cuisineTags?.length} types
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Karibu Recommended carousel */}
      <div className="pb-6">
        <div className="px-5 flex items-baseline justify-between mb-3">
          <div>
            <h3 className="font-serif-d text-lg text-ink">Karibu Recommended</h3>
            <p className="text-xs text-stone-w">Trusted by visitors · verified monthly</p>
          </div>
          <button className="text-xs text-clay font-semibold flex items-center gap-0.5">
            See all <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scroll-x px-5 pb-1">
          {topBusinesses.map((b) => (
            <button
              key={b.id}
              onClick={() => go("business", b)}
              className="flex-shrink-0 w-60 rounded-2xl overflow-hidden border border-ink-10 bg-white text-left"
            >
              <div className="h-32 relative">
                <HeroImage variant={b.image} />
                {b.badge && (
                  <div className="absolute top-2 left-2">
                    <Badge kind={b.badge === "Verified" ? "verified" : "recommended"}>{b.badge}</Badge>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm text-ink leading-tight">{b.name}</h4>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Star size={12} className="fill-current text-ochre" />
                    <span className="text-xs font-semibold text-ink">{b.rating}</span>
                  </div>
                </div>
                <div className="text-xs text-stone-w mt-0.5">
                  {b.category} · {b.hood}
                </div>
                <div className="text-xs text-ink mt-1 font-medium">{b.price}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tourist favourites */}
      <div className="px-5 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">Visitors are loving</h3>
        <div className="space-y-2.5">
          {[
            { name: "Mama Oliech's", cat: "Seafood · Fish specialist", hood: "Parklands", rating: 4.7, reviews: 890 },
            { name: "Connect Coffee Roasters", cat: "Specialty coffee", hood: "Lavington", rating: 4.8, reviews: 412 },
            { name: "Nairobi National Park Safari", cat: "Day trip · Wildlife", hood: "Pickup city-wide", rating: 4.9, reviews: 1203 },
          ].map((b, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-ink-10 bg-white text-left"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <HeroImage variant={["posh", "talisman", "artcaffe"][i]} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-ink truncate">{b.name}</h4>
                <p className="text-xs text-stone-w truncate">{b.cat} · {b.hood}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarRow rating={b.rating} size={11} />
                  <span className="text-xs text-ink font-medium">{b.rating}</span>
                  <span className="text-xs text-stone-w">({b.reviews})</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-stone-w flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Read before you go — guides teaser */}
      <div className="pb-6">
        <div className="px-5 flex items-baseline justify-between mb-3">
          <div>
            <h3 className="font-serif-d text-lg text-ink">Read before you go</h3>
            <p className="text-xs text-stone-w">Editorial guides · updated monthly</p>
          </div>
          <button onClick={() => go("guides")} className="text-xs text-clay font-semibold flex items-center gap-0.5">
            All guides <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scroll-x px-5 pb-1">
          {guides.filter((g) => g.featured).map((g) => {
            const cat = guideCategories.find((c) => c.key === g.category);
            return (
              <button
                key={g.id}
                onClick={() => go("guide_article", g)}
                className="flex-shrink-0 w-60 rounded-2xl overflow-hidden border border-ink-10 bg-white text-left"
              >
                <div className="h-24 relative">
                  <HeroImage variant={g.heroVariant} />
                  <div className="absolute top-2 left-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur"
                      style={{ backgroundColor: "rgba(247,241,232,0.85)", color: cat?.color }}
                    >
                      <cat.Icon size={10} />
                      {cat?.label}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-serif-d text-sm text-ink leading-tight">{g.title}</h4>
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-stone-w">
                    <Clock size={10} />
                    <span>{g.readTime} min read</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Own a business CTA */}
      <div className="px-5 pb-6">
        <button
          onClick={() => go("business_signup")}
          className="w-full rounded-2xl p-5 text-left relative overflow-hidden border border-ink-10"
          style={{ backgroundColor: "#2A3D2B" }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #D4A341 0 1px, transparent 1px 14px)",
            }}
          />
          <div className="relative">
            <div className="text-ochre text-xs font-semibold uppercase tracking-wider mb-1">
              For businesses
            </div>
            <h4 className="font-serif-d text-2xl text-white leading-tight mb-1">
              Be found by thousands<br />of visitors weekly
            </h4>
            <p className="text-xs" style={{ color: "#D7CFC4" }}>
              List free · Upgrade for featured placement
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ochre">
              See pricing <ArrowUpRight size={14} />
            </div>
          </div>
        </button>
        <button
          onClick={() => go("merchant_dashboard")}
          className="mt-2 w-full py-2.5 text-xs font-semibold text-stone-w flex items-center justify-center gap-1.5"
        >
          <LayoutDashboard size={13} />
          Already a partner? Open merchant dashboard
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: SUB-CATEGORY PICKER ----------
const SubCategoryScreen = ({ payload, go, back, activeCity = "nairobi" }) => {
  const { cities } = useReferenceData();
  const cat = payload;
  if (!cat) return null;
  const city = cities.find((c) => c.key === activeCity) || cities[0];

  const items = cat.subTypes && cat.subTypes.length > 0
    ? cat.subTypes
    : cat.cuisineTags && cat.cuisineTags.length > 0
      ? cat.cuisineTags
      : [];

  const isRestaurant = cat.key === "restaurants";

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">{cat.label}</h2>
        <span className="w-8" />
      </div>

      {/* Hero block */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-clay-soft flex items-center justify-center">
            <cat.Icon size={22} className="text-clay" />
          </div>
          <div>
            <h1 className="font-serif-d text-2xl text-ink leading-tight">{cat.label}</h1>
            <p className="text-xs text-stone-w">{cat.blurb} · {city.label}</p>
          </div>
        </div>
      </div>

      {/* Browse all */}
      <div className="px-5 pb-3">
        <button
          onClick={() => go("category", { ...cat, subType: null })}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-ink-10 bg-clay-soft active:bg-clay-soft"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center">
              <Compass size={15} className="text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm text-ink">Browse all {cat.label.toLowerCase()}</div>
              <div className="text-[11px] text-stone-w">See everything in this category</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-clay" />
        </button>
      </div>

      {/* Sub-type / cuisine grid */}
      <div className="px-5 pb-5">
        <h3 className="text-[10px] font-semibold text-stone-w uppercase tracking-wider mb-2">
          {isRestaurant ? "By cuisine" : "By type"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {items.map((sub) => {
            const Icon = sub.Icon;
            return (
              <button
                key={sub.key}
                onClick={() => go("category", { ...cat, subType: sub })}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-ink-10 bg-white text-left active:bg-ivory-2"
              >
                <div className="w-9 h-9 rounded-full bg-ivory-2 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-clay" />
                </div>
                <span className="text-xs font-semibold text-ink leading-tight">{sub.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ask Karibu nudge */}
      <div className="px-5 pb-6">
        <button
          onClick={() => go("ask")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-ochre bg-ochre-soft text-left"
        >
          <div className="w-9 h-9 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-xs text-ink">Not sure which type?</div>
            <div className="text-[11px] text-stone-w">
              Ask Karibu AI — describe what you need
            </div>
          </div>
          <ChevronRight size={15} className="text-ochre-d" />
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: CATEGORY ----------
const CategoryScreen = ({ payload, go, back, activeCity = "nairobi" }) => {
  const { cities } = useReferenceData();
  const city = cities.find((c) => c.key === activeCity) || cities[0];
  const hoods = [`All ${city.label}`, ...city.hoods];
  const [activeHood, setActiveHood] = useState(hoods[0]);
  const [activeSort, setActiveSort] = useState("Recommended");

  // Only Nairobi salons (Beauty → nails) was seeded in the prototype constants
  const isBeautyNails = payload?.key === "beauty" && (!payload?.subType || payload?.subType?.key === "nails");

  // KAR-6: live listings for this city/category/sub-type. Until the first live
  // page resolves the prototype behaviour holds (salonsList for the one seeded
  // case, "coming soon" otherwise); once live, the database decides — an empty
  // result shows the existing "coming soon" state.
  const { items: liveItems, live } = useBusinesses({
    citySlug: activeCity,
    categorySlug: payload?.key,
    subTypeSlug: payload?.subType?.key,
    fallback: activeCity === "nairobi" && isBeautyNails ? salonsList : [],
  });
  const hasListings = live
    ? liveItems.length > 0
    : activeCity === "nairobi" && isBeautyNails;

  const subTypeLabel = payload?.subType?.label;
  const screenTitle = subTypeLabel
    ? `${subTypeLabel}`
    : payload?.label || "Services";

  const filtered = useMemo(() => {
    if (!hasListings) return [];
    let list = [...liveItems];
    if (!activeHood.startsWith("All ")) list = list.filter((s) => s.hood === activeHood);
    // Live rows may lack distanceKm/openNow (no user geolocation or hours data
    // yet) — sort unknown distances last, and "Open now" only keeps known-open.
    if (activeSort === "Closest") list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    if (activeSort === "Top rated") list.sort((a, b) => b.rating - a.rating);
    if (activeSort === "Open now") list = list.filter((s) => s.openNow);
    return list;
  }, [liveItems, activeHood, activeSort, hasListings]);

  return (
    <div className="fade-in pb-4">
      {/* Top bar */}
      <div className="sticky top-0 bg-ivory z-10 px-5 pt-4 pb-3 border-b border-ink-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={back} className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
            <ChevronLeft size={17} className="text-ink" />
          </button>
          <div className="flex-1 text-center px-2">
            {subTypeLabel && (
              <div className="text-[10px] font-semibold text-stone-w uppercase tracking-wider leading-tight">
                {payload?.label}
              </div>
            )}
            <h2 className="font-serif-d text-lg text-ink leading-tight">{screenTitle}</h2>
          </div>
          <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
            <Filter size={15} className="text-ink" />
          </button>
        </div>

        {/* Neighborhood chips */}
        <div className="flex gap-1.5 overflow-x-auto scroll-x">
          {hoods.map((h) => (
            <button
              key={h}
              onClick={() => setActiveHood(h)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                activeHood === h
                  ? "bg-ink text-white border-ink"
                  : "border-ink-10 text-ink bg-white"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Sort row */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto scroll-x">
        <span className="text-xs text-stone-w pr-1">Sort:</span>
        {["Recommended", "Closest", "Top rated", "Open now"].map((s) => (
          <button
            key={s}
            onClick={() => setActiveSort(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              activeSort === s
                ? "bg-clay text-white"
                : "bg-ivory-2 text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-5 pt-2 space-y-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            // Live rows carry a slug and are passed as-is (BusinessScreen
            // fetches full detail by slug); constants keep the prototype merge.
            onClick={() => go("business", s.slug ? s : recommended.find((r) => r.id === s.id) || { ...recommended[0], ...s, image: "posh" })}
            className="w-full flex gap-3 p-2.5 rounded-2xl border border-ink-10 bg-white text-left"
          >
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative">
              <HeroImage variant="posh" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-ink leading-tight">{s.name}</h4>
                {/* Unknown open-state (live rows without hours data) shows neither */}
                {s.openNow != null &&
                  (s.openNow ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-forest flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-forest pulse-dot" />
                      Open
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-stone-w flex-shrink-0">Closed</span>
                  ))}
              </div>
              <p className="text-xs text-stone-w mt-0.5">{s.tagline}</p>
              <div className="flex items-center gap-1 mt-1">
                <StarRow rating={s.rating} size={11} />
                <span className="text-xs text-ink font-medium">{s.rating}</span>
                <span className="text-xs text-stone-w">({s.reviews})</span>
                <span className="text-xs text-stone-w">·</span>
                <span className="text-xs text-stone-w">{s.hood}</span>
                {/* Distance needs user geolocation — hidden until it exists */}
                {s.distanceKm != null && (
                  <>
                    <span className="text-xs text-stone-w">·</span>
                    <span className="text-xs text-stone-w">{s.distanceKm} km</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {s.badge === "Karibu Recommended" && <Badge kind="recommended">Recommended</Badge>}
                {s.badge === "Verified" && <Badge kind="verified">Verified</Badge>}
                <span className="text-[11px] text-ink font-medium">{s.price}</span>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && hasListings && (
          <div className="text-center py-10 text-sm text-stone-w">
            No businesses match those filters.
          </div>
        )}
        {!hasListings && (
          <div className="text-center py-12 px-4 fade-in">
            <div className="w-12 h-12 rounded-full bg-ochre-soft inline-flex items-center justify-center mb-3">
              <Compass size={18} className="text-ochre-d" />
            </div>
            <h3 className="font-serif-d text-xl text-ink">
              {activeCity !== "nairobi"
                ? `Coming soon to ${city.label}`
                : `${payload?.label || "Listings"} coming soon`}
            </h3>
            <p className="text-xs text-stone-w mt-1 leading-relaxed max-w-[260px] mx-auto">
              {activeCity !== "nairobi"
                ? `We're onboarding verified businesses in ${city.label} now. Ask Karibu AI for recommendations in the meantime.`
                : `We're onboarding verified ${payload?.label?.toLowerCase() || "businesses"} in ${city.label}. Ask Karibu AI for trusted recommendations from local expertise.`}
            </p>
            <button
              onClick={() => go("ask")}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ochre text-white text-xs font-semibold"
            >
              <Sparkles size={12} />
              Ask Karibu AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- SCREEN: BUSINESS DETAIL ----------
const BusinessScreen = ({ payload, back, go, reviews = [], justPosted }) => {
  const b = payload || recommended[0];
  const [saved, setSaved] = useState(false);

  // KAR-7: live-sourced payloads carry a slug — fetch the full row + published
  // reviews. Constant-sourced payloads have no slug; the hook stays inert and
  // the prototype merge below behaves exactly as before.
  const { business: liveBiz, reviews: liveReviews } = useBusinessDetail(b.slug);

  // Fall back to full data if the payload was a lightweight list item
  const full = { ...recommended[0], ...b, ...(liveBiz || {}) };

  // Combine existing seed reviews with new user-submitted ones (new first).
  // Once the published set is live it replaces the sample constants.
  const allReviews = [...reviews, ...(liveReviews ?? reviewsSample)];

  // Live-computed rating: folds user reviews into the stored aggregate
  const seedSum = full.rating * full.reviews;
  const addSum = reviews.reduce((a, r) => a + r.rating, 0);
  const totalCount = full.reviews + reviews.length;
  const liveRating =
    totalCount > 0 ? (seedSum + addSum) / totalCount : full.rating;

  // Rating distribution — computed from the live published reviews when we
  // have them; the prototype's illustrative split otherwise.
  const distribution = liveReviews
    ? [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        pct: liveReviews.length
          ? Math.round(
              (liveReviews.filter((r) => r.rating === stars).length /
                liveReviews.length) *
                100,
            )
          : 0,
      }))
    : [
        { stars: 5, pct: 72 },
        { stars: 4, pct: 21 },
        { stars: 3, pct: 5 },
        { stars: 2, pct: 1 },
        { stars: 1, pct: 1 },
      ];

  // Rank within hood/category — derived from rating position in seed list
  const sameHoodAndCategory = salonsList.filter(
    (s) => s.hood === full.hood && full.category?.toLowerCase().includes("salon")
  );
  const sortedByRating = [...sameHoodAndCategory].sort((a, b) => b.rating - a.rating);
  const rankIndex = sortedByRating.findIndex((s) => s.id === full.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  return (
    <div className="fade-in pb-6">
      {/* Hero */}
      <div className="relative h-52">
        <HeroImage variant={full.image || "posh"} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.45) 100%)" }} />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={back}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <ChevronLeft size={18} className="text-ink" />
          </button>
          <button
            onClick={() => setSaved(!saved)}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <Heart
              size={18}
              className={saved ? "fill-current text-clay" : "text-ink"}
            />
          </button>
        </div>
        {full.badge === "Karibu Recommended" && (
          <div className="absolute bottom-3 left-4">
            <Badge kind="recommended">Karibu Recommended</Badge>
          </div>
        )}
      </div>

      {/* "Review posted" banner */}
      {justPosted && (
        <div className="px-5 py-2.5 bg-forest-soft border-b border-ink-10 flex items-center gap-2 fade-in">
          <Check size={15} className="text-forest" />
          <span className="text-xs font-semibold text-forest">
            Thanks — your review is live. Others will see it after moderation.
          </span>
        </div>
      )}

      {/* Name block */}
      <div className="px-5 pt-4 pb-4 border-b border-ink-10">
        <h1 className="font-serif-d text-3xl text-ink leading-tight">{full.name}</h1>
        <p className="text-sm text-stone-w mt-0.5">{full.category} · {full.hood}</p>
        <div className="flex items-center gap-2 mt-2">
          <StarRow rating={liveRating} size={14} />
          <span className="text-sm font-semibold text-ink">{liveRating.toFixed(1)}</span>
          <span className="text-sm text-stone-w">({totalCount.toLocaleString()} reviews)</span>
        </div>
        {rank && rank <= 3 && (
          <div className="flex items-center gap-1.5 mt-2">
            <Trophy size={13} className="text-ochre" />
            <span className="text-xs font-semibold text-ochre-d">
              Ranked #{rank} in {full.hood} · {full.category}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-forest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-forest pulse-dot" />
            Open · Closes 8pm
          </span>
          <span className="text-stone-w">·</span>
          <span className="text-ink font-medium">{full.price}</span>
          <span className="text-stone-w">·</span>
          <span className="text-stone-w">2.3 km away</span>
        </div>
      </div>

      {/* Action row */}
      <div className="px-5 py-4 grid grid-cols-4 gap-2 border-b border-ink-10">
        {[
          { label: "Call", Icon: Phone, color: "#2A3D2B" },
          { label: "WhatsApp", Icon: MessageCircle, color: "#2A3D2B" },
          { label: "Directions", Icon: Navigation, color: "#B8472E" },
          { label: "Website", Icon: Globe, color: "#2A3D2B" },
        ].map(({ label, Icon, color }) => (
          <button
            key={label}
            className="flex flex-col items-center py-2 rounded-xl border border-ink-10"
          >
            <Icon size={17} color={color} />
            <span className="text-[11px] font-medium text-ink mt-1">{label}</span>
          </button>
        ))}
      </div>

      {/* About */}
      <div className="px-5 py-4 border-b border-ink-10">
        <h3 className="font-serif-d text-lg text-ink mb-1.5">About</h3>
        <p className="text-sm text-ink leading-relaxed">{full.about}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {full.tags?.map((t) => (
            <span
              key={t}
              className="px-2.5 py-0.5 rounded-full bg-ivory-2 text-xs text-ink border border-ink-10"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="px-5 py-4 border-b border-ink-10">
        <h3 className="font-serif-d text-lg text-ink mb-2">Services & prices</h3>
        <div className="space-y-1.5">
          {full.services?.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-ink-10 last:border-0">
              <span className="text-sm text-ink">{s.name}</span>
              <span className="text-sm font-semibold text-ink">{s.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hours + payment */}
      <div className="px-5 py-4 border-b border-ink-10 space-y-3">
        <div className="flex items-start gap-3">
          <Clock size={17} className="text-stone-w flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-ink">Hours</div>
            <div className="text-sm text-stone-w">{full.hours}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Banknote size={17} className="text-stone-w flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-ink">Payment</div>
            <div className="text-sm text-stone-w">M-Pesa {full.mpesa} · Visa · Cash (KSh / USD)</div>
          </div>
        </div>
      </div>

      {/* Reviews summary */}
      <div className="px-5 py-4 border-b border-ink-10">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-serif-d text-lg text-ink">Reviews</h3>
          <button
            onClick={() => go("review_compose", full)}
            className="text-xs text-clay font-semibold flex items-center gap-1"
          >
            <Star size={12} className="fill-current" />
            Write a review
          </button>
        </div>

        {/* Rating distribution */}
        <div className="flex items-start gap-4 p-3 rounded-xl bg-ivory-2 border border-ink-10 mb-3">
          <div className="text-center flex-shrink-0">
            <div className="font-serif-d text-4xl text-ink leading-none">
              {liveRating.toFixed(1)}
            </div>
            <div className="mt-1">
              <StarRow rating={liveRating} size={12} />
            </div>
            <div className="text-[10px] text-stone-w mt-1">
              {totalCount.toLocaleString()} reviews
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {distribution.map((d) => (
              <div key={d.stars} className="flex items-center gap-2">
                <span className="text-[10px] text-stone-w w-2">{d.stars}</span>
                <Star size={9} className="fill-current text-ochre" />
                <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                  <div className="h-full bg-ochre" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-[10px] text-stone-w w-7 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review cards */}
        <div className="space-y-3">
          {allReviews.slice(0, 4).map((r, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border ${
                r.isNew ? "bg-ochre-soft border-ochre" : "bg-ivory-2 border-ink-10"
              }`}
            >
              {r.isNew && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Sparkles size={10} className="text-ochre-d" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ochre-d">
                    Just posted
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-sm font-semibold text-ink">{r.name}</div>
                  <div className="text-[11px] text-stone-w">{r.country}</div>
                </div>
                <div className="text-right">
                  <StarRow rating={r.rating} size={12} />
                  <div className="text-[11px] text-stone-w mt-0.5">{r.date}</div>
                </div>
              </div>
              {r.recommendation && (
                <div className="mt-1 mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-ink-10">
                  <ThumbsUp size={10} className="text-forest" />
                  <span className="text-[10px] font-medium text-ink">{r.recommendation}</span>
                </div>
              )}
              {r.serviceUsed && (
                <div className="text-[10px] text-stone-w mb-1.5">
                  Service used: <span className="text-ink font-medium">{r.serviceUsed}</span>
                </div>
              )}
              <p className="text-xs text-ink leading-relaxed mt-1">{r.text}</p>
            </div>
          ))}
        </div>
        <button className="mt-3 w-full py-2.5 text-sm font-semibold text-clay border border-clay rounded-xl">
          See all {totalCount.toLocaleString()} reviews
        </button>
      </div>

      {/* Write-a-review nudge at bottom */}
      <div className="px-5 pt-4">
        <button
          onClick={() => go("review_compose", full)}
          className="w-full rounded-xl p-4 border border-ink-10 bg-clay-soft flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-clay flex items-center justify-center flex-shrink-0">
            <Star size={17} className="text-white fill-current" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-ink">Been here? Share your experience</div>
            <div className="text-[11px] text-stone-w">
              Your review helps other visitors — and keeps good businesses ranked high.
            </div>
          </div>
          <ChevronRight size={16} className="text-clay" />
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: REVIEW COMPOSER ----------
const ReviewComposerScreen = ({ payload, back, onSubmit }) => {
  const biz = payload || recommended[0];
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [service, setService] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [country, setCountry] = useState("🇺🇸 United States");
  const [visitType, setVisitType] = useState("Tourist");

  const services = biz.services?.map((s) => s.name) || ["General visit"];
  const recos = [
    { key: "yes", label: "Yes, absolutely", Icon: ThumbsUp },
    { key: "caveats", label: "Yes, with caveats", Icon: AlertCircle },
    { key: "no", label: "Not really", Icon: X },
  ];
  const countries = [
    "🇺🇸 United States", "🇬🇧 United Kingdom", "🇩🇪 Germany", "🇫🇷 France",
    "🇮🇹 Italy", "🇨🇳 China", "🇮🇳 India", "🇯🇵 Japan", "🇿🇦 South Africa",
    "🇳🇬 Nigeria", "🇰🇪 Kenya (resident)", "🇪🇹 Ethiopia", "Other",
  ];
  const visitTypes = ["Tourist", "Business visitor", "Expat", "New resident", "Resident"];

  const canSubmit = rating > 0 && text.trim().length >= 40 && recommendation !== "";
  const charCount = text.length;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const recoLabel = recos.find((r) => r.key === recommendation)?.label;
    const newReview = {
      name: "You",
      country: `${country} · ${visitType}`,
      rating,
      date: "Just now",
      text: text.trim(),
      isNew: true,
      serviceUsed: service || null,
      recommendation: recoLabel,
    };
    // Optimistic local update first — the on-screen UX ("live after
    // moderation") is identical whether or not the server write happens.
    onSubmit(biz.id, newReview);

    // KAR-8: persist through the submit-review edge function when possible.
    // It requires a signed-in user (verify_jwt = true) and a live business
    // (dbId). Until the app ships an auth flow, guest reviews stay local-only.
    if (biz.dbId) {
      (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData?.session;
          if (!session) {
            console.warn(
              "[Karibu] review kept local — sign in required to persist reviews.",
            );
            return;
          }
          const { error: fnError } = await supabase.functions.invoke(
            "submit-review",
            {
              body: {
                business_id: biz.dbId,
                reviewer_name:
                  session.user.user_metadata?.full_name ||
                  session.user.email?.split("@")[0] ||
                  "Karibu visitor",
                reviewer_country: country.replace(/^\S*\s+/, ""), // drop the flag emoji
                reviewer_type: visitType.toLowerCase(),
                rating,
                body: text.trim(),
                service_used: service || null,
                recommendation, // the key the function validates: yes | caveats | no
              },
            },
          );
          if (fnError) {
            console.error("[Karibu] submit-review failed:", fnError.message);
          }
        } catch (e) {
          console.error("[Karibu] submit-review failed:", e);
        }
      })();
    }
  };

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <X size={16} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Write a review</h2>
        <span className="w-8" />
      </div>

      {/* Business card */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <HeroImage variant={biz.image || "posh"} />
        </div>
        <div>
          <div className="font-semibold text-sm text-ink">{biz.name}</div>
          <div className="text-xs text-stone-w">{biz.category} · {biz.hood}</div>
        </div>
      </div>

      {/* Rating */}
      <div className="px-5 pt-5 pb-5 text-center border-b border-ink-10">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-3">
          How was it?
        </div>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
              className="transition-transform active:scale-90"
            >
              <Star
                size={36}
                className={i <= (hover || rating) ? "fill-current" : ""}
                style={{ color: i <= (hover || rating) ? "#D4A341" : "#D7CFC4" }}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div className="mt-2 text-sm text-ink font-medium fade-in">
            {["", "Not great", "Could be better", "It was okay", "Really good", "Outstanding"][rating]}
          </div>
        )}
      </div>

      {/* Service used */}
      <div className="px-5 py-4 border-b border-ink-10">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
          What did you get?
        </div>
        <div className="flex flex-wrap gap-1.5">
          {services.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => setService(service === s ? "" : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                service === s
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink border-ink-10"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setService("Other")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              service === "Other"
                ? "bg-ink text-white border-ink"
                : "bg-white text-ink border-ink-10"
            }`}
          >
            Other
          </button>
        </div>
      </div>

      {/* Recommendation */}
      <div className="px-5 py-4 border-b border-ink-10">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
          Would you recommend to other visitors?
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {recos.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setRecommendation(key)}
              className={`py-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition ${
                recommendation === key
                  ? key === "no"
                    ? "bg-ink text-white border-ink"
                    : key === "caveats"
                    ? "bg-ochre-soft text-ochre-d border-ochre"
                    : "bg-forest text-white border-forest"
                  : "bg-white text-ink border-ink-10"
              }`}
            >
              <Icon size={14} />
              <span className="leading-tight text-center px-1">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Text */}
      <div className="px-5 py-4 border-b border-ink-10">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-semibold text-stone-w uppercase tracking-wider">
            Tell us more
          </div>
          <span
            className={`text-[11px] ${charCount < 40 ? "text-clay" : "text-stone-w"}`}
          >
            {charCount} / 40 min
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What stood out? Anything other visitors should know — communication, wait time, payment methods, language?"
          className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2.5 text-sm text-ink font-sans-d outline-none resize-none"
          rows={4}
        />
      </div>

      {/* Context */}
      <div className="px-5 py-4 border-b border-ink-10 space-y-3">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider">
          Your context
          <span className="ml-1 text-stone-w normal-case font-normal tracking-normal">
            · helps other visitors weigh your review
          </span>
        </div>
        <div>
          <label className="text-[11px] text-stone-w block mb-1">Where are you from?</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2 text-sm text-ink font-sans-d outline-none"
          >
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone-w block mb-1">You're in Kenya as a...</label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2 text-sm text-ink font-sans-d outline-none"
          >
            {visitTypes.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Photo upload placeholder */}
      <div className="px-5 py-4 border-b border-ink-10">
        <button className="w-full py-3 rounded-xl border border-dashed border-ink-20 flex items-center justify-center gap-2 text-xs text-stone-w">
          <Camera size={15} />
          <span>Add photos (optional)</span>
        </button>
      </div>

      {/* Guidelines + submit */}
      <div className="px-5 py-4">
        <p className="text-[11px] text-stone-w mb-3 leading-relaxed">
          By submitting, you agree to Karibu's review guidelines. Reviews are moderated for authenticity — first-person experiences only, no promotional content. Fake reviews lead to account removal.
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
            canSubmit ? "bg-clay text-white" : "bg-ivory-2 text-stone-w cursor-not-allowed"
          }`}
        >
          {canSubmit ? "Post review" : "Complete all fields to post"}
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: BUSINESS SIGNUP / PRICING ----------
const BusinessSignupScreen = ({ back }) => {
  const tiers = [
    {
      name: "Free Listing",
      price: "KSh 0",
      cadence: "forever",
      color: "#E8E1D3",
      textColor: "#1C1613",
      features: [
        "Name, contact, hours, location",
        "Appear in search results",
        "Customer reviews enabled",
      ],
      cta: "List for free",
      highlight: false,
    },
    {
      name: "Verified",
      price: "KSh 2,500",
      cadence: "per month",
      color: "#EBEFE9",
      textColor: "#2A3D2B",
      features: [
        "Verified badge · builds trust",
        "Priority in search results",
        "Photo gallery (up to 15)",
        "Analytics dashboard",
        "WhatsApp & M-Pesa integration",
      ],
      cta: "Get Verified",
      highlight: false,
    },
    {
      name: "Karibu Recommended",
      price: "KSh 7,500",
      cadence: "per month",
      color: "#FBF4E0",
      textColor: "#7A5A10",
      features: [
        "Gold Recommended badge",
        "Featured on home carousel",
        "Top 3 placement in category",
        "Review response tools",
        "Monthly performance report",
        "Dedicated account manager",
      ],
      cta: "Become Recommended",
      highlight: true,
    },
  ];

  return (
    <div className="fade-in pb-6">
      {/* Hero */}
      <div className="relative bg-forest px-5 pt-5 pb-7 text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #D4A341 0 1px, transparent 1px 14px)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={back}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(247,241,232,0.15)" }}
            >
              <ChevronLeft size={17} color="#F7F1E8" />
            </button>
            <span className="text-xs font-semibold text-ochre uppercase tracking-wider">For Businesses</span>
            <span className="w-8" />
          </div>
          <h1 className="font-serif-d text-3xl leading-tight">
            Be the place visitors<br />
            <span className="italic">can't stop</span> recommending.
          </h1>
          <p className="text-sm mt-2" style={{ color: "#D7CFC4" }}>
            Get discovered by tourists, expats, and newcomers searching for trusted services in Kenya.
          </p>

          <div className="flex gap-4 mt-4">
            <div>
              <div className="font-serif-d text-2xl text-ochre">28k+</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "#D7CFC4" }}>Monthly visitors</div>
            </div>
            <div>
              <div className="font-serif-d text-2xl text-ochre">2.4k</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "#D7CFC4" }}>Listed businesses</div>
            </div>
            <div>
              <div className="font-serif-d text-2xl text-ochre">41%</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "#D7CFC4" }}>Bookings uplift*</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="font-serif-d text-xl text-ink mb-3">Choose your plan</h3>
        <div className="space-y-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl p-4 border ${t.highlight ? "border-ochre" : "border-ink-10"}`}
              style={{ backgroundColor: t.color }}
            >
              {t.highlight && (
                <div className="flex items-center justify-between mb-2">
                  <Badge kind="recommended">Most Popular</Badge>
                  <TrendingUp size={15} style={{ color: t.textColor }} />
                </div>
              )}
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="font-serif-d text-xl" style={{ color: t.textColor }}>{t.name}</h4>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="font-serif-d text-3xl" style={{ color: t.textColor }}>{t.price}</span>
                <span className="text-xs" style={{ color: t.textColor, opacity: 0.7 }}>/ {t.cadence}</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: t.textColor }}>
                    <Check size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2.5 rounded-xl text-sm font-semibold ${
                  t.highlight ? "bg-ochre text-ink" : "bg-ink text-white"
                }`}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-w mt-3 leading-relaxed">
          * Average reported uplift from Recommended businesses in the first 90 days. All prices inclusive of 16% VAT. M-Pesa and card billing. Cancel anytime.
        </p>
      </div>

      {/* Trust row */}
      <div className="mx-5 mt-5 p-4 rounded-2xl bg-ivory-2 border border-ink-10">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-forest flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-ink">Verified businesses only</div>
            <p className="text-xs text-stone-w mt-0.5">
              Every Verified and Recommended listing goes through a manual review by our Nairobi team. We check registration, location, and a sample of recent reviews before approval.
            </p>
          </div>
        </div>
      </div>

      {/* Quality standards */}
      <div className="px-5 mt-4">
        <div className="rounded-2xl border border-ink-10 bg-white overflow-hidden">
          <div className="px-4 pt-4 pb-3 bg-forest-soft border-b border-ink-10">
            <div className="flex items-center gap-2">
              <Award size={17} className="text-forest" />
              <h3 className="font-serif-d text-lg text-forest">Quality-first platform</h3>
            </div>
            <p className="text-xs text-ink mt-1 leading-relaxed">
              Karibu exists because visitors trust it. We protect that trust by keeping ranking honest and removing businesses that consistently underdeliver.
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-forest-soft flex items-center justify-center flex-shrink-0">
                <TrendingUp size={14} className="text-forest" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Reviews drive ranking</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  Position in search and "Recommended" carousel is determined by rating, review volume, and recency — not by how much you pay. Subscription only unlocks placement tiers within your rating band.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FBF4E0" }}>
                <AlertCircle size={14} className="text-ochre-d" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Improvement window at 3.5★</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  If a business drops below 3.5★ with 20+ reviews, we open a 60-day improvement window. You get a private dashboard of what reviewers cite, a direct line to our team, and a chance to respond.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F3D9CF" }}>
                <X size={14} className="text-clay" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Unlisted if unresolved</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  Businesses still below 3.5★ after 60 days are unlisted from search and refunded their current month. Tough, but it's why visitors keep trusting Karibu — and why good businesses thrive here.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-forest-soft flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-forest" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">Fair protection against abuse</div>
                <p className="text-xs text-stone-w leading-relaxed">
                  Reviews are moderated for authenticity. We detect and remove review bombing, fake accounts, and competitor sabotage. Businesses can flag reviews for investigation at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- SCREEN: CITY PICKER ----------
const CityPickerScreen = ({ back, activeCity, onSelect }) => {
  const { cities } = useReferenceData();
  return (
    <div className="fade-in">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <X size={16} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Change city</h2>
        <span className="w-8" />
      </div>

      <div className="px-5 pt-5 pb-3">
        <h3 className="font-serif-d text-2xl text-ink leading-tight">Where in Kenya<br />are you?</h3>
        <p className="text-xs text-stone-w mt-2 leading-relaxed">
          We show services, businesses, and AI recommendations based on your city. You can switch any time.
        </p>
      </div>

      <div className="px-5 pb-5 space-y-2">
        {cities.map((c) => {
          const isActive = c.key === activeCity;
          return (
            <button
              key={c.key}
              onClick={() => onSelect(c.key)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition ${
                isActive ? "border-clay bg-clay-soft" : "border-ink-10 bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isActive ? "bg-clay" : "bg-ivory-2"
              }`}>
                <MapPin size={16} className={isActive ? "text-white" : "text-stone-w"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-ink">{c.label}</div>
                <div className="text-xs text-stone-w">{c.tagline} · {c.hoods.length} neighbourhoods</div>
              </div>
              {isActive && <Check size={16} className="text-clay flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-6">
        <div className="p-3 rounded-xl bg-forest-soft border border-ink-10 flex items-start gap-2">
          <Sparkles size={13} className="text-forest flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-ink leading-relaxed">
            More cities coming: Eldoret, Malindi, Lamu, Kilifi. Tell us where you'd like to see Karibu next.
          </p>
        </div>
      </div>
    </div>
  );
};

// ---------- SCREEN: ASK KARIBU (AI search) ----------
const AskKaribuScreen = ({ back, go, activeCity }) => {
  const { cities } = useReferenceData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const cityLabel = cities.find((c) => c.key === activeCity)?.label || "Nairobi";

  const examplePrompts = [
    `I have 3 hours before my flight — where should I eat near JKIA?`,
    `First time in ${cityLabel}, need a trusted salon for gel nails`,
    `Pharmacy open past 10pm tonight`,
    `Romantic dinner under KSh 5,000 per person`,
  ];

  const sendMessage = async (promptText) => {
    const userMsg = { role: "user", content: promptText };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);
    setError(null);

    try {
      // The Anthropic key never touches the browser. We call the ask-karibu
      // edge function, which holds the Anthropic API key server-side, grounds
      // the reply in the live verified directory, and returns the raw Anthropic
      // Messages response — so the content parsing below is unchanged.
      const { data, error: fnError } = await supabase.functions.invoke(
        "ask-karibu",
        {
          body: {
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            city: activeCity,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || "Ask Karibu request failed");
      }

      const text = data?.content
        ?.map((i) => (i.type === "text" ? i.text : ""))
        .filter(Boolean)
        .join("\n") || "I'm not sure how to help with that just yet.";

      setMessages([...nextMessages, { role: "assistant", content: text }]);
    } catch (e) {
      setError(e.message || "Something went wrong reaching Karibu AI.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
  };

  return (
    <div className="fade-in flex flex-col h-full">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-ochre flex items-center justify-center">
            <Sparkles size={12} className="text-white" />
          </div>
          <h2 className="font-serif-d text-lg text-ink">Ask Karibu</h2>
        </div>
        <button
          onClick={() => setMessages([])}
          className="text-xs text-stone-w font-medium"
          style={{ opacity: messages.length > 0 ? 1 : 0 }}
        >
          Clear
        </button>
      </div>

      {/* Messages / empty state */}
      <div className="flex-1 overflow-y-auto hide-scroll px-5 py-4">
        {messages.length === 0 ? (
          <div className="fade-in">
            <div className="text-center py-4 mb-4">
              <div className="inline-flex w-12 h-12 rounded-full bg-ochre-soft items-center justify-center mb-3">
                <Sparkles size={20} className="text-ochre-d" />
              </div>
              <h3 className="font-serif-d text-2xl text-ink leading-tight">
                Your local AI guide
              </h3>
              <p className="text-xs text-stone-w mt-1 leading-relaxed px-4">
                Ask anything about services in {cityLabel}. I only recommend verified Karibu businesses.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-stone-w uppercase tracking-wider mb-1">
                Try asking
              </div>
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="w-full text-left p-3 rounded-xl bg-ivory-2 border border-ink-10 text-sm text-ink active:bg-ivory"
                >
                  <span className="italic text-stone-w">"</span>{p}<span className="italic text-stone-w">"</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`fade-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-ink text-white rounded-br-sm"
                      : "bg-ochre-soft text-ink border border-ochre rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <Sparkles size={10} className="text-ochre-d" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ochre-d">
                        Karibu AI
                      </span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex justify-start fade-in">
                <div className="bg-ochre-soft border border-ochre rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 size={13} className="text-ochre-d animate-spin" />
                  <span className="text-xs text-ochre-d">Thinking...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-xl bg-clay-soft border border-clay text-xs text-ink">
                <div className="flex items-start gap-2">
                  <AlertCircle size={13} className="text-clay flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">Couldn't reach Karibu AI</div>
                    <div className="text-stone-w">{error}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-ink-10 bg-ivory">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end bg-white border border-ink-10 rounded-2xl px-3 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Ask about anything in ${cityLabel}...`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none resize-none leading-snug max-h-24"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition ${
              input.trim() && !isStreaming ? "bg-clay" : "bg-ivory-2"
            }`}
          >
            <Send
              size={16}
              className={input.trim() && !isStreaming ? "text-white" : "text-stone-w"}
            />
          </button>
        </div>
        <p className="text-[10px] text-stone-w text-center mt-1.5 leading-tight">
          Karibu AI only recommends verified businesses · Can make mistakes
        </p>
      </div>
    </div>
  );
};

// ---------- SCREEN: MERCHANT DASHBOARD ----------
const MerchantDashboardScreen = ({ back }) => {
  // Mock business — would come from auth in production
  const biz = {
    name: "Posh Palace Salon",
    category: "Salons & Nails",
    hood: "Westlands",
    tier: "Karibu Recommended",
    rating: 4.8,
    reviews: 412,
    rank: 1,
    totalInCat: 6,
    improvementStatus: "healthy", // "healthy" | "warning" | "window"
  };

  const metrics = [
    { label: "Profile views", value: "2,341", delta: "+18%", trend: "up", period: "This month" },
    { label: "WhatsApp taps", value: "187", delta: "+24%", trend: "up", period: "This month" },
    { label: "Direction taps", value: "94", delta: "-6%", trend: "down", period: "This month" },
    { label: "New reviews", value: "23", delta: "+9", trend: "up", period: "This month" },
  ];

  const ratingTrend = [4.5, 4.5, 4.6, 4.7, 4.7, 4.8, 4.8];

  const themes = [
    { label: "Quality of gel work", sentiment: "positive", count: 38 },
    { label: "Staff multilingual", sentiment: "positive", count: 27 },
    { label: "Clean, modern space", sentiment: "positive", count: 21 },
    { label: "Wait times on weekends", sentiment: "negative", count: 9 },
    { label: "Parking tight", sentiment: "negative", count: 4 },
  ];

  const recentReviews = [
    { name: "Sarah M.", country: "🇩🇪", rating: 5, snippet: "Best gel set I've ever had...", responded: false },
    { name: "Jon A.", country: "🇺🇸", rating: 5, snippet: "First time getting a pedi here — felt safe...", responded: true },
    { name: "Grace K.", country: "🇰🇪", rating: 3, snippet: "Waited 45 minutes past my appointment...", responded: false },
  ];

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Merchant</h2>
        <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
          <LogOut size={14} className="text-ink" />
        </button>
      </div>

      {/* Business header */}
      <div className="px-5 pt-5 pb-4">
        <div className="text-xs font-semibold text-ochre-d uppercase tracking-wider">
          {biz.tier}
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight mt-0.5">{biz.name}</h1>
        <p className="text-sm text-stone-w mt-0.5">{biz.category} · {biz.hood}</p>

        {/* Status card */}
        <div className="mt-4 p-4 rounded-2xl border border-forest bg-forest-soft">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-forest flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-forest">
                Healthy standing
              </div>
              <p className="text-xs text-ink mt-0.5 leading-relaxed">
                Your rating is well above the 3.5★ threshold. Keep it up and you'll keep your Recommended status next cycle.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rating + rank */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl border border-ink-10 bg-white">
            <div className="text-[10px] font-semibold text-stone-w uppercase tracking-wider">
              Rating
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif-d text-3xl text-ink leading-none">{biz.rating}</span>
              <span className="text-xs text-forest font-semibold">+0.1</span>
            </div>
            <div className="mt-1">
              <StarRow rating={biz.rating} size={10} />
            </div>
            <div className="text-[10px] text-stone-w mt-1">{biz.reviews} reviews</div>

            {/* Sparkline */}
            <svg viewBox="0 0 80 24" className="w-full mt-2 h-6">
              <polyline
                fill="none"
                stroke="#D4A341"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ratingTrend
                  .map((v, i) => {
                    const x = (i / (ratingTrend.length - 1)) * 78 + 1;
                    const y = 22 - ((v - 4.3) / 0.6) * 20;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            </svg>
          </div>

          <div className="p-4 rounded-2xl border border-ochre bg-ochre-soft">
            <div className="text-[10px] font-semibold text-ochre-d uppercase tracking-wider">
              Category rank
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif-d text-3xl text-ink leading-none">#{biz.rank}</span>
              <span className="text-xs text-stone-w">/ {biz.totalInCat}</span>
            </div>
            <div className="text-[10px] text-stone-w mt-1">{biz.hood}</div>
            <div className="mt-2 flex items-center gap-1">
              <Trophy size={11} className="text-ochre" />
              <span className="text-[10px] font-semibold text-ochre-d">
                Top 3 this month
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="px-5 pb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-serif-d text-lg text-ink">Activity</h3>
          <span className="text-[10px] text-stone-w uppercase tracking-wider">Last 30 days</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="p-3 rounded-xl border border-ink-10 bg-white">
              <div className="text-[10px] text-stone-w">{m.label}</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-serif-d text-2xl text-ink leading-none">{m.value}</span>
                <span
                  className={`text-[10px] font-semibold inline-flex items-center gap-0.5 ${
                    m.trend === "up" ? "text-forest" : "text-clay"
                  }`}
                >
                  {m.trend === "up" ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                  {m.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review themes */}
      <div className="px-5 pb-4">
        <h3 className="font-serif-d text-lg text-ink mb-2">What reviewers mention</h3>
        <div className="p-3 rounded-xl border border-ink-10 bg-white">
          <div className="text-[10px] font-semibold text-stone-w uppercase tracking-wider mb-2">
            Top themes · last 90 days
          </div>
          <div className="space-y-1.5">
            {themes.map((t) => {
              const isPositive = t.sentiment === "positive";
              return (
                <div key={t.label} className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isPositive ? "bg-forest" : "bg-clay"
                    }`}
                  />
                  <span className="text-xs text-ink flex-1">{t.label}</span>
                  <span className="text-[10px] text-stone-w">{t.count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-ink-10 flex items-start gap-2">
            <Sparkles size={11} className="text-ochre-d flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-ink leading-relaxed">
              <span className="font-semibold">Suggestion:</span> Consider a weekend-only second chair to ease wait times — it's your most-cited negative.
            </p>
          </div>
        </div>
      </div>

      {/* Recent reviews */}
      <div className="px-5 pb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-serif-d text-lg text-ink">Recent reviews</h3>
          <button className="text-xs text-clay font-semibold">See all</button>
        </div>
        <div className="space-y-2">
          {recentReviews.map((r, i) => (
            <div key={i} className="p-3 rounded-xl border border-ink-10 bg-white">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{r.country}</span>
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                </div>
                <StarRow rating={r.rating} size={11} />
              </div>
              <p className="text-xs text-stone-w italic">"{r.snippet}"</p>
              <div className="mt-2 flex items-center gap-2">
                {r.responded ? (
                  <span className="text-[10px] text-forest font-semibold flex items-center gap-1">
                    <Check size={10} />
                    Responded
                  </span>
                ) : (
                  <button className="text-[11px] font-semibold text-clay flex items-center gap-1">
                    <MessageSquare size={11} />
                    Write response
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription */}
      <div className="px-5 pb-6">
        <div className="p-4 rounded-2xl border border-ink-10 bg-ivory-2">
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign size={15} className="text-forest" />
            <span className="text-sm font-semibold text-ink">Subscription</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-serif-d text-xl text-ink">Recommended tier</div>
              <div className="text-xs text-stone-w">Next bill: 15 May · KSh 7,500</div>
            </div>
            <button className="text-xs font-semibold text-clay">Manage</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- SCREEN: GUIDES HUB ----------
const GuidesHubScreen = ({ go, activeCity }) => {
  const { cities } = useReferenceData();
  const featured = guides.filter((g) => g.featured);
  const cityLabel = cities.find((c) => c.key === activeCity)?.label || "Nairobi";

  // Group non-featured guides by category
  const byCategory = guideCategories.map((cat) => ({
    ...cat,
    articles: guides.filter((g) => g.category === cat.key),
  }));

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="font-serif-d text-xl text-ink">Guides</span>
        </div>
        <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
          <Bookmark size={15} className="text-ink" />
        </button>
      </div>

      {/* Editorial intro */}
      <div className="px-5 pt-4 pb-5">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-1">
          {cityLabel} · Visitor library
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight">
          Read before,<br />
          <span className="italic text-clay">refer to during.</span>
        </h1>
        <p className="text-sm text-stone-w mt-2 leading-relaxed">
          Practical guides written by our editorial team and updated monthly. No affiliate links, no sponsored content.
        </p>
      </div>

      {/* Featured articles */}
      <div className="pb-6">
        <div className="px-5 flex items-baseline justify-between mb-3">
          <h3 className="font-serif-d text-lg text-ink">Featured</h3>
          <span className="text-[10px] font-semibold text-stone-w uppercase tracking-wider">Start here</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scroll-x px-5 pb-1">
          {featured.map((g) => {
            const cat = guideCategories.find((c) => c.key === g.category);
            return (
              <button
                key={g.id}
                onClick={() => go("guide_article", g)}
                className="flex-shrink-0 w-64 rounded-2xl overflow-hidden border border-ink-10 bg-white text-left"
              >
                <div className="h-28 relative">
                  <HeroImage variant={g.heroVariant} />
                  <div className="absolute top-2 left-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur"
                      style={{ backgroundColor: "rgba(247,241,232,0.85)", color: cat?.color }}
                    >
                      <cat.Icon size={10} />
                      {cat?.label}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-serif-d text-base text-ink leading-tight">{g.title}</h4>
                  <p className="text-[11px] text-stone-w mt-1 leading-snug line-clamp-2">{g.subtitle}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-stone-w">
                    <Clock size={10} />
                    <span>{g.readTime} min read</span>
                    <span>·</span>
                    <span>{g.updated}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category grid */}
      <div className="px-5 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">Browse by topic</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {byCategory.map((cat) => (
            <button
              key={cat.key}
              onClick={() => cat.articles[0] && go("guide_article", cat.articles[0])}
              className="flex items-start gap-3 p-3 rounded-xl border border-ink-10 bg-white text-left active:bg-ivory-2"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cat.color}15` }}
              >
                <cat.Icon size={16} style={{ color: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-ink leading-tight">{cat.label}</div>
                <div className="text-[10px] text-stone-w mt-0.5 leading-tight">{cat.blurb}</div>
                <div className="text-[10px] text-stone-w mt-1">
                  {cat.articles.length} article{cat.articles.length === 1 ? "" : "s"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* All articles list */}
      <div className="px-5 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">All guides</h3>
        <div className="space-y-2">
          {guides.map((g) => {
            const cat = guideCategories.find((c) => c.key === g.category);
            return (
              <button
                key={g.id}
                onClick={() => go("guide_article", g)}
                className="w-full flex items-start gap-3 p-3 rounded-xl border border-ink-10 bg-white text-left active:bg-ivory-2"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <cat.Icon size={16} style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink leading-tight">{g.title}</div>
                  <div className="text-[11px] text-stone-w mt-0.5 leading-snug">{g.subtitle}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-stone-w">
                    <span style={{ color: cat.color }}>{cat.label}</span>
                    <span>·</span>
                    <Clock size={9} />
                    <span>{g.readTime} min</span>
                  </div>
                </div>
                <ChevronRight size={15} className="text-stone-w flex-shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Ask Karibu nudge */}
      <div className="px-5 pb-6">
        <button
          onClick={() => go("ask")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-ochre bg-ochre-soft text-left"
        >
          <div className="w-10 h-10 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-ink">Can't find your question?</div>
            <div className="text-[11px] text-stone-w">
              Ask Karibu AI — it knows all the guides and the full business directory.
            </div>
          </div>
          <ChevronRight size={16} className="text-ochre-d flex-shrink-0" />
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: GUIDE ARTICLE ----------
const GuideArticleScreen = ({ payload, back, go }) => {
  const g = payload || guides[0];
  const cat = guideCategories.find((c) => c.key === g.category);
  const [saved, setSaved] = useState(false);

  // Find related businesses from the directory
  const relatedBiz = (g.relatedBusinesses || [])
    .map((id) => recommended.find((r) => r.id === id))
    .filter(Boolean);

  return (
    <div className="fade-in pb-6">
      {/* Hero */}
      <div className="relative h-44">
        <HeroImage variant={g.heroVariant} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.50) 100%)",
          }}
        />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={back}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <ChevronLeft size={18} className="text-ink" />
          </button>
          <button
            onClick={() => setSaved(!saved)}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <Bookmark
              size={16}
              className={saved ? "fill-current text-clay" : "text-ink"}
            />
          </button>
        </div>
        <div className="absolute bottom-3 left-4">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.90)", color: cat?.color }}
          >
            <cat.Icon size={10} />
            {cat?.label}
          </span>
        </div>
      </div>

      {/* Title block */}
      <div className="px-5 pt-5 pb-3 border-b border-ink-10">
        <h1 className="font-serif-d text-3xl text-ink leading-tight">{g.title}</h1>
        <p className="font-serif-d italic text-base text-stone-w leading-snug mt-2">
          {g.subtitle}
        </p>
        <div className="flex items-center gap-2 mt-3 text-[11px] text-stone-w">
          <span>{g.author}</span>
          <span>·</span>
          <Clock size={10} />
          <span>{g.readTime} min read</span>
          <span>·</span>
          <span>{g.updated}</span>
        </div>
      </div>

      {/* Summary pullquote */}
      <div className="px-5 py-4 border-b border-ink-10 bg-ivory-2">
        <p className="font-serif-d text-base text-ink leading-snug italic">
          {g.summary}
        </p>
      </div>

      {/* Article body */}
      <div className="px-5 py-5 border-b border-ink-10">
        {g.body.map((block, i) => {
          if (block.type === "h") {
            return (
              <h3 key={i} className="font-serif-d text-xl text-ink leading-tight mt-5 mb-2 first:mt-0">
                {block.text}
              </h3>
            );
          }
          if (block.type === "p") {
            return (
              <p key={i} className="text-sm text-ink leading-relaxed mb-3">
                {block.text}
              </p>
            );
          }
          if (block.type === "list") {
            return (
              <ul key={i} className="my-3 space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-ink leading-relaxed">
                    <span className="text-clay font-bold mt-0.5 flex-shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          if (block.type === "callout") {
            const isWarning = block.tone === "warning";
            return (
              <div
                key={i}
                className={`my-4 p-3 rounded-xl border flex items-start gap-2.5 ${
                  isWarning
                    ? "bg-clay-soft border-clay"
                    : "bg-ochre-soft border-ochre"
                }`}
              >
                {isWarning ? (
                  <AlertCircle size={15} className="text-clay flex-shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb size={15} className="text-ochre-d flex-shrink-0 mt-0.5" />
                )}
                <p className="text-xs text-ink leading-relaxed">{block.text}</p>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Related businesses */}
      {relatedBiz.length > 0 && (
        <div className="px-5 py-4 border-b border-ink-10">
          <h3 className="font-serif-d text-lg text-ink mb-2">Mentioned in this guide</h3>
          <div className="space-y-2">
            {relatedBiz.map((b) => (
              <button
                key={b.id}
                onClick={() => go("business", b)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-ink-10 bg-white text-left"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <HeroImage variant={b.image} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-ink truncate">{b.name}</h4>
                  <div className="text-[11px] text-stone-w truncate">
                    {b.category} · {b.hood}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={10} className="fill-current text-ochre" />
                    <span className="text-[11px] text-ink font-medium">{b.rating}</span>
                    <span className="text-[11px] text-stone-w">({b.reviews})</span>
                  </div>
                </div>
                <ChevronRight size={15} className="text-stone-w flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ask Karibu about this */}
      {g.askPrompts && g.askPrompts.length > 0 && (
        <div className="px-5 py-4 border-b border-ink-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-ochre flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <h3 className="font-serif-d text-lg text-ink">Ask Karibu about this</h3>
          </div>
          <div className="space-y-1.5">
            {g.askPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => go("ask")}
                className="w-full text-left p-3 rounded-xl bg-ochre-soft border border-ochre text-sm text-ink active:bg-ochre-soft"
              >
                <span className="italic text-stone-w">"</span>{p}<span className="italic text-stone-w">"</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* More in this category */}
      <div className="px-5 py-4">
        <h3 className="font-serif-d text-lg text-ink mb-2">More from {cat.label}</h3>
        <div className="space-y-2">
          {guides
            .filter((other) => other.category === g.category && other.id !== g.id)
            .slice(0, 3)
            .map((other) => (
              <button
                key={other.id}
                onClick={() => go("guide_article", other)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-ink-10 bg-white text-left"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <HeroImage variant={other.heroVariant} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-ink leading-tight">{other.title}</h4>
                  <div className="text-[11px] text-stone-w mt-0.5">
                    {other.readTime} min read
                  </div>
                </div>
                <ChevronRight size={15} className="text-stone-w" />
              </button>
            ))}
          {guides.filter((o) => o.category === g.category && o.id !== g.id).length === 0 && (
            <p className="text-xs text-stone-w italic">
              More {cat.label.toLowerCase()} guides coming soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- SCREEN: SEARCH (lightweight) ----------
const SearchScreen = ({ back, go }) => {
  const [q, setQ] = useState("");
  const suggestions = [
    "Nails in Westlands",
    "Airport transfer to JKIA",
    "Best Ethiopian food",
    "24-hour pharmacy Kilimani",
    "Gym day pass",
    "Kenyan SIM card",
  ];
  return (
    <div className="fade-in">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-ink-10">
        <button onClick={back} className="w-8 h-8 flex items-center justify-center">
          <ChevronLeft size={18} className="text-ink" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-white border border-ink-10 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-stone-w" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What are you looking for?"
            className="flex-1 bg-transparent text-sm text-ink outline-none font-sans-d"
          />
        </div>
      </div>
      <div className="px-5 pt-4">
        <h4 className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">Popular searches</h4>
        <div className="space-y-1">
          {suggestions
            .filter((s) => s.toLowerCase().includes(q.toLowerCase()))
            .map((s) => (
              <button
                key={s}
                onClick={() => go("category", { key: "salons", label: "Nails & Salons" })}
                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-ivory-2 text-left"
              >
                <Search size={14} className="text-stone-w" />
                <span className="text-sm text-ink">{s}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

// ---------- SCREEN: PLACEHOLDER ----------
const PlaceholderScreen = ({ title, message }) => (
  <div className="fade-in flex flex-col items-center justify-center h-full text-center px-8 py-20">
    <div className="w-14 h-14 rounded-full bg-ivory-2 flex items-center justify-center mb-4">
      <Bookmark size={22} className="text-clay" />
    </div>
    <h2 className="font-serif-d text-2xl text-ink mb-1">{title}</h2>
    <p className="text-sm text-stone-w max-w-xs">{message}</p>
  </div>
);

// ---------- BOTTOM NAV ----------
const BottomNav = ({ active, go }) => {
  const items = [
    { key: "discover", label: "Discover", Icon: Compass },
    { key: "guides", label: "Guides", Icon: BookOpen },
    { key: "saved", label: "Saved", Icon: Bookmark },
    { key: "business_signup", label: "Business", Icon: Briefcase },
    { key: "profile", label: "Profile", Icon: User },
  ];
  return (
    <div className="border-t border-ink-10 bg-ivory grid grid-cols-5">
      {items.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className="flex flex-col items-center py-2.5"
        >
          <Icon size={19} className={active === key ? "text-clay" : "text-stone-w"} />
          <span
            className={`text-[10px] mt-0.5 ${
              active === key ? "text-clay font-semibold" : "text-stone-w"
            }`}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
};

// ---------- APP ----------
export default function Karibu() {
  const [stack, setStack] = useState([{ screen: "discover", payload: null }]);
  const [reviewsByBusiness, setReviewsByBusiness] = useState({});
  const [justPostedFor, setJustPostedFor] = useState(null);
  const [activeCity, setActiveCity] = useState("nairobi");
  const [merchantMode, setMerchantMode] = useState(false);
  const current = stack[stack.length - 1];

  const go = (screen, payload = null) => {
    if (screen === "merchant_dashboard") {
      setMerchantMode(true);
      setStack([{ screen: "merchant_dashboard", payload: null }]);
      return;
    }
    setStack((s) => [...s, { screen, payload }]);
  };
  const back = () => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };
  const exitMerchant = () => {
    setMerchantMode(false);
    setStack([{ screen: "discover", payload: null }]);
  };
  const goTab = (key) => {
    setStack([{ screen: key, payload: null }]);
  };

  // Handle review submission: add to state, pop composer, show toast
  const submitReview = (businessId, review) => {
    setReviewsByBusiness((prev) => ({
      ...prev,
      [businessId]: [review, ...(prev[businessId] || [])],
    }));
    setJustPostedFor(businessId);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setTimeout(() => setJustPostedFor(null), 6000);
  };

  const handleCitySelect = (cityKey) => {
    setActiveCity(cityKey);
    // Pop the city picker off the stack
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };

  const renderScreen = () => {
    switch (current.screen) {
      case "discover":
        return (
          <DiscoverScreen
            go={go}
            activeCity={activeCity}
            onOpenCityPicker={() => go("city_picker")}
          />
        );
      case "category":
        return <CategoryScreen payload={current.payload} go={go} back={back} activeCity={activeCity} />;
      case "subcategory":
        return <SubCategoryScreen payload={current.payload} go={go} back={back} activeCity={activeCity} />;
      case "business": {
        const bizId = current.payload?.id;
        const biz = current.payload;
        return (
          <BusinessScreen
            payload={biz}
            back={back}
            go={go}
            reviews={bizId ? reviewsByBusiness[bizId] || [] : []}
            justPosted={justPostedFor && justPostedFor === bizId}
          />
        );
      }
      case "review_compose":
        return (
          <ReviewComposerScreen
            payload={current.payload}
            back={back}
            onSubmit={submitReview}
          />
        );
      case "business_signup":
        return <BusinessSignupScreen back={back} />;
      case "city_picker":
        return (
          <CityPickerScreen
            back={back}
            activeCity={activeCity}
            onSelect={handleCitySelect}
          />
        );
      case "ask":
        return <AskKaribuScreen back={back} go={go} activeCity={activeCity} />;
      case "merchant_dashboard":
        return <MerchantDashboardScreen back={exitMerchant} />;
      case "guides":
        return <GuidesHubScreen go={go} activeCity={activeCity} />;
      case "guide_article":
        return <GuideArticleScreen payload={current.payload} back={back} go={go} />;
      case "search":
        return <SearchScreen back={back} go={go} />;
      case "saved":
        return (
          <PlaceholderScreen
            title="Your saved places"
            message="Tap the heart on any business to save it here for later. Great for building a short-list before a trip."
          />
        );
      case "profile":
        return (
          <PlaceholderScreen
            title="Your profile"
            message="Sign in to sync your saved places across devices and leave reviews."
          />
        );
      default:
        return <DiscoverScreen go={go} activeCity={activeCity} onOpenCityPicker={() => go("city_picker")} />;
    }
  };

  const activeTab = ["discover", "guides", "saved", "business_signup", "profile"].includes(current.screen)
    ? current.screen
    : stack[0]?.screen || "discover";

  // Hide bottom nav for full-screen flows
  const hideBottomNav = ["review_compose", "city_picker", "ask", "merchant_dashboard", "guide_article"].includes(current.screen);

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen font-sans-d text-ink kitenge-bg" style={{ backgroundColor: "#EEE5D3" }}>
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 flex flex-col md:flex-row gap-8 items-start justify-center">
          {/* Left copy (desktop only) */}
          <div className="hidden md:block md:w-80 md:pt-10 md:sticky md:top-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center">
                <span className="font-serif-d text-xl" style={{ color: "#F7F1E8", lineHeight: 1 }}>K</span>
              </div>
              <span className="font-serif-d text-2xl text-ink">Karibu</span>
            </div>
            <h1 className="font-serif-d text-5xl leading-none text-ink mb-3">
              A local guide,<br />
              <span className="italic text-clay">for newcomers.</span>
            </h1>
            <p className="text-sm text-ink leading-relaxed mb-4" style={{ maxWidth: "28ch" }}>
              Services discovery for tourists, expats, and anyone new to Kenya. Find the right salon, the right driver, the right nyama choma — without asking five strangers first.
            </p>
            <div className="space-y-2 text-sm text-ink">
              <div className="flex items-start gap-2">
                <Check size={15} className="text-clay mt-0.5 flex-shrink-0" />
                <span>12 service categories across Nairobi & Mombasa</span>
              </div>
              <div className="flex items-start gap-2">
                <Check size={15} className="text-clay mt-0.5 flex-shrink-0" />
                <span>M-Pesa, WhatsApp, and multilingual signals</span>
              </div>
              <div className="flex items-start gap-2">
                <Check size={15} className="text-clay mt-0.5 flex-shrink-0" />
                <span>Tiered subscription model for businesses</span>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-ink-10 text-xs text-stone-w">
              Tap through the prototype → home, category listing, business detail, and the "For Business" pricing flow are all interactive.
            </div>
          </div>

          {/* Phone frame */}
          <div className="w-full max-w-sm mx-auto md:mx-0">
            <div
              className="relative rounded-[2.5rem] border-4 border-ink phone-shadow overflow-hidden"
              style={{ backgroundColor: "#F7F1E8", height: "820px" }}
            >
              {/* Status bar */}
              <div className="px-6 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-semibold text-ink">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <span>●●●</span>
                  <span>📶</span>
                  <span>🔋</span>
                </div>
              </div>

              {/* Notch */}
              <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-20 h-5 bg-ink rounded-b-2xl" />

              {/* Screen content (scrollable) */}
              <div
                className="overflow-y-auto hide-scroll"
                style={{ height: hideBottomNav ? "calc(820px - 36px)" : "calc(820px - 88px)" }}
              >
                {renderScreen()}
              </div>

              {/* Bottom nav (hidden for full-screen flows) */}
              {!hideBottomNav && (
                <div className="absolute bottom-0 left-0 right-0">
                  <BottomNav active={activeTab} go={goTab} />
                </div>
              )}
            </div>
            <div className="text-center mt-4 text-[11px] text-stone-w">
              {merchantMode
                ? "Merchant mode · Tap back to return to the traveller app."
                : "Tap any category, card, or CTA. Try the city picker (top-right), Ask Karibu, or open the merchant dashboard."}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
