import { useParams } from "react-router-dom";
import { SubCategoryScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

// NOTE: currently unreachable (no navigation targets "subcategory"). Kept for
// parity; wire to a route or remove with the team in a later task.
export default function SubCategoryPage() {
  const { categorySlug, subSlug } = useParams();
  const { go, back } = useLegacyNav();
  const { cityKey } = useCity();
  const { categories } = useReferenceData();
  const cat = categories.find((c) => c.key === categorySlug) || { key: categorySlug };
  const subList = cat.subTypes?.length ? cat.subTypes : cat.cuisineTags || [];
  const subType = subSlug ? subList.find((s) => s.key === subSlug) || null : null;
  return <SubCategoryScreen payload={{ ...cat, subType }} go={go} back={back} activeCity={cityKey} />;
}
