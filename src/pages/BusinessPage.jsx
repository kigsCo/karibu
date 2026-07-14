import { useParams, useLocation } from "react-router-dom";
import { BusinessScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useLocalReviews } from "../context/LocalReviewsContext.jsx";

export default function BusinessPage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { go, back } = useLegacyNav();
  const { reviewsByBusiness, justPostedFor } = useLocalReviews();
  const payload = state?.payload ?? { id: slug, slug };
  const id = payload.id;
  return (
    <BusinessScreen
      payload={payload}
      go={go}
      back={back}
      reviews={id ? reviewsByBusiness[id] || [] : []}
      justPosted={justPostedFor != null && justPostedFor === id}
    />
  );
}
