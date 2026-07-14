import { useNavigate } from "react-router-dom";
import { MerchantDashboardScreen } from "../KaribuApp.jsx";

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  return <MerchantDashboardScreen back={() => navigate("/")} />;
}
