import { useNavigate } from "react-router-dom";
import { DiscoverScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

export default function DiscoverPage() {
  const { go } = useLegacyNav();
  const navigate = useNavigate();
  const { cityKey } = useCity();
  return (
    <DiscoverScreen go={go} activeCity={cityKey} onOpenCityPicker={() => navigate("/city")} />
  );
}
