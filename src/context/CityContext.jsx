// The currently-selected city, lifted out of the KaribuApp root state so any
// route can read or change it. The LIST of cities still lives in
// ReferenceDataContext; this holds only the selection.
import { createContext, useContext, useState } from "react";

const CityContext = createContext({ cityKey: "nairobi", setCityKey: () => {} });

export function CityProvider({ children }) {
  const [cityKey, setCityKey] = useState("nairobi");
  return (
    <CityContext.Provider value={{ cityKey, setCityKey }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  return useContext(CityContext);
}
