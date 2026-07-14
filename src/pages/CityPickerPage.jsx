import { useNavigate } from "react-router-dom";
import { CityPickerScreen } from "../KaribuApp.jsx";
import { useCity } from "../context/CityContext.jsx";

export default function CityPickerPage() {
  const navigate = useNavigate();
  const { cityKey, setCityKey } = useCity();
  const onSelect = (key) => {
    setCityKey(key);
    navigate(-1);
  };
  return <CityPickerScreen back={() => navigate(-1)} activeCity={cityKey} onSelect={onSelect} />;
}
