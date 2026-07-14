import { useNavigate } from "react-router-dom";
import { AskKaribuScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

export default function AskKaribuPage() {
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  const { cityKey } = useCity();
  return <AskKaribuScreen back={() => navigate(-1)} go={go} activeCity={cityKey} />;
}
