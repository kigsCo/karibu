import { useParams, useLocation, useNavigate } from "react-router-dom";
import { GuideArticleScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";

export default function GuideArticlePage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  const payload = state?.payload ?? { id: slug, slug };
  return <GuideArticleScreen key={payload.id} payload={payload} back={() => navigate(-1)} go={go} />;
}
