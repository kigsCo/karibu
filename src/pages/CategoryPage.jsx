import { useParams } from "react-router-dom";
import { CategoryScreen } from "../KaribuApp.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

export default function CategoryPage() {
  const { categorySlug, subSlug } = useParams();
  const { go, back } = useLegacyNav();
  const { cityKey } = useCity();
  const { categories } = useReferenceData();
  const cat = categories.find((c) => c.key === categorySlug) || { key: categorySlug };
  const subList = cat.subTypes?.length ? cat.subTypes : cat.cuisineTags || [];
  const subType = subSlug ? subList.find((s) => s.key === subSlug) || null : null;
  return <CategoryScreen payload={{ ...cat, subType }} go={go} back={back} activeCity={cityKey} />;
}
