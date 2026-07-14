import { useNavigate } from "react-router-dom";
import { SearchScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";

export default function SearchPage() {
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  return <SearchScreen back={() => navigate(-1)} go={go} />;
}
