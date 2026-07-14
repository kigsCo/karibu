import { useNavigate } from "react-router-dom";
import { BusinessSignupScreen } from "../KaribuApp.jsx";

export default function ForBusinessPage() {
  const navigate = useNavigate();
  return <BusinessSignupScreen back={() => navigate(-1)} />;
}
