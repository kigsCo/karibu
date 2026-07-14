import { render, screen, act } from "@testing-library/react";
import { CityProvider, useCity } from "./CityContext.jsx";

function Probe() {
  const { cityKey, setCityKey } = useCity();
  return <button onClick={() => setCityKey("mombasa")}>{cityKey}</button>;
}

test("defaults to nairobi and updates on set", () => {
  render(<CityProvider><Probe /></CityProvider>);
  const btn = screen.getByRole("button");
  expect(btn).toHaveTextContent("nairobi");
  act(() => btn.click());
  expect(btn).toHaveTextContent("mombasa");
});
