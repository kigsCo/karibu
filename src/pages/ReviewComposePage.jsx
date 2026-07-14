import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ReviewComposerScreen } from "../KaribuApp.jsx";
import { useLocalReviews } from "../context/LocalReviewsContext.jsx";

export default function ReviewComposePage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { addReview } = useLocalReviews();
  const payload = state?.payload ?? { id: slug, slug };
  const onSubmit = (businessId, review) => {
    addReview(businessId, review);
    navigate(-1);
  };
  return <ReviewComposerScreen payload={payload} back={() => navigate(-1)} onSubmit={onSubmit} />;
}
