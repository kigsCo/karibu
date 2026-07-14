import { GuidesHubScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

export default function GuidesPage() {
  const { go } = useLegacyNav();
  const { cityKey } = useCity();
  return <GuidesHubScreen go={go} activeCity={cityKey} />;
}
