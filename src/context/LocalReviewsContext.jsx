// Guest reviews are local-only until an auth flow ships (see root CLAUDE.md):
// submitting one updates optimistic in-memory state and shows a "just posted"
// toast on the business screen. This preserves the prototype's exact behaviour
// now that the compose flow spans two routes (/b/:slug/review -> /b/:slug).
// Sub-project 2 decides this flow's final fate.
import { createContext, useContext, useState } from "react";

const LocalReviewsContext = createContext({
  reviewsByBusiness: {},
  justPostedFor: null,
  addReview: () => {},
});

export function LocalReviewsProvider({ children }) {
  const [reviewsByBusiness, setReviewsByBusiness] = useState({});
  const [justPostedFor, setJustPostedFor] = useState(null);

  const addReview = (businessId, review) => {
    setReviewsByBusiness((prev) => ({
      ...prev,
      [businessId]: [review, ...(prev[businessId] || [])],
    }));
    setJustPostedFor(businessId);
    setTimeout(() => setJustPostedFor(null), 6000);
  };

  return (
    <LocalReviewsContext.Provider
      value={{ reviewsByBusiness, justPostedFor, addReview }}
    >
      {children}
    </LocalReviewsContext.Provider>
  );
}

export function useLocalReviews() {
  return useContext(LocalReviewsContext);
}
