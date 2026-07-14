// src/data/reviews.js
// Business-review fallback data extracted from src/KaribuApp.jsx (SP1
// architecture refactor, task 7b — pure code move, no behaviour change).
//
// `reviewsSample` backs the `BusinessScreen` review list until live published
// reviews are fetched. Kept BYTE-FOR-BYTE identical to the literal it
// replaced; no icons referenced.

// ---------- DATA ----------
export const reviewsSample = [
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
