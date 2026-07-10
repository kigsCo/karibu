// src/data/referenceData.js
// Reference data extracted from src/KaribuApp.jsx (KAR-5).
//
// These two constants (`cities`, `categories`) are the SOURCE OF TRUTH for the
// very first paint and the offline/unreachable-Supabase fallback. They are kept
// BYTE-FOR-BYTE identical to the prototype literals they replaced — do not edit
// them to "tidy"; they must keep rendering exactly as before. The live values
// are fetched once on app load and merged in via ReferenceDataContext.
//
// The DB stores each `icon` as a STRING (e.g. "Hotel"); the UI needs the actual
// lucide-react COMPONENT (e.g. Hotel). `iconFromName` does that string→component
// lookup, with a safe fallback so an unmapped name never crashes a render.
import {
  Hotel, Palmtree, Home, Bed, Building, Building2, Plane, Car, Users,
  Banknote, Landmark, Activity, Hospital, Stethoscope, Pill, Mountain,
  Scissors, Sparkle, Dumbbell, UtensilsCrossed, Beef, ChefHat, Coffee,
  Shirt, ShoppingCart, Carrot, Cake, Wine, Beer, Music, ShoppingBag,
  Store, Gift, Trees, Key, Scale, Ruler, HeartPulse, Warehouse,
} from "lucide-react";

// ---------- FALLBACK / INITIAL REFERENCE DATA ----------
// (byte-identical to the original KaribuApp.jsx constants)
export const cities = [
  { key: "nairobi", label: "Nairobi", tagline: "The capital", hoods: ["Westlands", "Karen", "Kilimani", "Lavington", "CBD", "Parklands"] },
  { key: "mombasa", label: "Mombasa", tagline: "Coastal", hoods: ["Nyali", "Diani", "Bamburi", "Old Town", "CBD", "Shanzu"] },
  { key: "naivasha", label: "Naivasha", tagline: "Lake & wildlife", hoods: ["Town", "Lakeshore", "Hell's Gate"] },
  { key: "kisumu", label: "Kisumu", tagline: "Lake Victoria", hoods: ["Milimani", "CBD", "Riat Hills"] },
  { key: "nakuru", label: "Nakuru", tagline: "Rift Valley", hoods: ["Milimani", "Section 58", "CBD"] },
];

export const categories = [
  {
    key: "hotels",
    label: "Hotels & Housing",
    Icon: Hotel,
    blurb: "Stays for every length",
    subTypes: [
      { key: "hotels", label: "Hotels", Icon: Hotel },
      { key: "resorts", label: "Resorts", Icon: Palmtree },
      { key: "airbnb", label: "Airbnb", Icon: Home },
      { key: "bnb", label: "Bed & Breakfast", Icon: Bed },
      { key: "vacation", label: "Vacation Homes", Icon: Building },
      { key: "short_rentals", label: "Short-term Rentals", Icon: Building2 },
      { key: "long_rentals", label: "Long-term Rentals", Icon: Building2 },
    ],
  },
  {
    key: "transport",
    label: "Transportation",
    Icon: Car,
    blurb: "Get around with ease",
    subTypes: [
      { key: "airport", label: "Airport Transfers", Icon: Plane },
      { key: "taxi", label: "Taxi Cabs", Icon: Car },
      { key: "private_taxi", label: "Private Taxis", Icon: Car },
      { key: "uber", label: "Uber", Icon: Car },
      { key: "bolt", label: "Bolt", Icon: Car },
      { key: "matatu", label: "Matatu & Public Transport", Icon: Users },
    ],
  },
  {
    key: "money",
    label: "Money & Banking",
    Icon: Banknote,
    blurb: "Cash, forex, ATMs",
    subTypes: [
      { key: "forex", label: "Currency Exchange", Icon: Banknote },
      { key: "banks", label: "Banks", Icon: Landmark },
      { key: "atms", label: "ATMs", Icon: Landmark },
    ],
  },
  {
    key: "health",
    label: "Hospital & Pharmacy",
    Icon: HeartPulse,
    blurb: "Urgent and routine care",
    subTypes: [
      { key: "urgent", label: "Urgent Care", Icon: Activity },
      { key: "emergency", label: "Emergency Room", Icon: Hospital },
      { key: "clinics", label: "Clinics", Icon: Stethoscope },
      { key: "chemists", label: "Chemists & Pharmacy", Icon: Pill },
    ],
  },
  {
    key: "safari",
    label: "Safaris & Attractions",
    Icon: Mountain,
    blurb: "Wildlife & day trips",
    subTypes: [], // Single-level — books direct
  },
  {
    key: "beauty",
    label: "Health & Beauty",
    Icon: Sparkle,
    blurb: "Salons, spas, fitness",
    subTypes: [
      { key: "hair", label: "Hair Salons", Icon: Scissors },
      { key: "nails", label: "Nail Salons", Icon: Sparkle },
      { key: "spa", label: "Spas", Icon: Sparkle },
      { key: "massage", label: "Massage", Icon: Sparkle },
      { key: "gym", label: "Gyms", Icon: Dumbbell },
    ],
  },
  {
    key: "restaurants",
    label: "Restaurants",
    Icon: UtensilsCrossed,
    blurb: "Cuisines from around the world",
    // Restaurants use cuisine *tags* rather than sub-categories
    cuisineTags: [
      { key: "steak", label: "Steakhouse", Icon: Beef },
      { key: "chinese", label: "Chinese", Icon: ChefHat },
      { key: "italian", label: "Italian", Icon: ChefHat },
      { key: "seafood", label: "Seafood", Icon: ChefHat },
      { key: "nyama_choma", label: "Nyama Choma", Icon: Beef },
      { key: "kenyan", label: "Kenyan Local", Icon: ChefHat },
      { key: "international", label: "International", Icon: ChefHat },
    ],
    subTypes: [], // No sub-types — use cuisine tags instead
  },
  {
    key: "cafes",
    label: "Cafés & Coffee",
    Icon: Coffee,
    blurb: "Brunch and good coffee",
    subTypes: [],
  },
  {
    key: "laundry",
    label: "Laundry & Dry Cleaning",
    Icon: Shirt,
    blurb: "Wash, fold, pressed",
    subTypes: [],
  },
  {
    key: "grocery",
    label: "Groceries & Markets",
    Icon: ShoppingCart,
    blurb: "Food shopping made easy",
    subTypes: [
      { key: "supermarket", label: "Supermarkets", Icon: ShoppingCart },
      { key: "butchery", label: "Butchery", Icon: Beef },
      { key: "farmers", label: "Farmer's Market", Icon: Carrot },
      { key: "bakery", label: "Bakery", Icon: Cake },
    ],
  },
  {
    key: "nightlife",
    label: "Nightlife",
    Icon: Wine,
    blurb: "Bars, clubs, sports",
    subTypes: [
      { key: "sports_bar", label: "Sports Bars", Icon: Beer },
      { key: "clubs", label: "Clubs", Icon: Music },
    ],
  },
  {
    key: "shopping",
    label: "Shopping",
    Icon: ShoppingBag,
    blurb: "Boutiques & souvenirs",
    subTypes: [
      { key: "boutiques", label: "Local Boutiques", Icon: Store },
      { key: "souvenirs", label: "Souvenirs", Icon: Gift },
    ],
  },
  {
    key: "real_estate",
    label: "Real Estate",
    Icon: Building2,
    blurb: "Buy land, homes & more",
    subTypes: [
      { key: "homes_sale", label: "Homes for Sale", Icon: Home },
      { key: "apartments_sale", label: "Apartments for Sale", Icon: Building },
      { key: "land_sale", label: "Land for Sale", Icon: Trees },
      { key: "commercial", label: "Commercial Property", Icon: Warehouse },
      { key: "agents", label: "Real Estate Agents", Icon: Key },
      { key: "lawyers", label: "Property Lawyers", Icon: Scale },
      { key: "surveyors", label: "Surveyors", Icon: Ruler },
    ],
  },
];

// ---------- ICON STRING → COMPONENT LOOKUP ----------
// The DB stores `icon` as a string. Every name below is one of the lucide-react
// components already imported in src/KaribuApp.jsx and re-imported above. Any
// name not in the map falls back to `Store` so a stray value never crashes a
// render (the visual layer must keep rendering no matter what the DB returns).
const ICONS = {
  Hotel, Palmtree, Home, Bed, Building, Building2, Plane, Car, Users,
  Banknote, Landmark, Activity, Hospital, Stethoscope, Pill, Mountain,
  Scissors, Sparkle, Dumbbell, UtensilsCrossed, Beef, ChefHat, Coffee,
  Shirt, ShoppingCart, Carrot, Cake, Wine, Beer, Music, ShoppingBag,
  Store, Gift, Trees, Key, Scale, Ruler, HeartPulse, Warehouse,
};

const FALLBACK_ICON = Store;

export function iconFromName(name) {
  return (name && ICONS[name]) || FALLBACK_ICON;
}
