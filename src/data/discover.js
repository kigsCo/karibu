// src/data/discover.js
// Discover-screen fallback data extracted from src/KaribuApp.jsx (SP1
// architecture refactor, task 7b — pure code move, no behaviour change).
//
// `visitorEssentials` is a static prototype list (no live Supabase query
// backs it yet). Kept BYTE-FOR-BYTE identical to the literal it replaced.
import { Wifi, Banknote, Mountain, Plane } from "lucide-react";

// ---------- DATA ----------
export const visitorEssentials = [
  { label: "SIM & Data", sub: "Safaricom, Airtel", Icon: Wifi },
  { label: "Forex", sub: "Best rates today", Icon: Banknote },
  { label: "Safaris", sub: "Day trips & multi-day", Icon: Mountain },
  { label: "Airport", sub: "JKIA transfers", Icon: Plane },
];
