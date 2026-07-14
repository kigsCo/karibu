import { render } from "@testing-library/react";
import { forwardRef, useEffect } from "react";
import { vi } from "vitest";

// Capture what useLegacyNav().go hands to react-router's navigate(). nav.js
// only imports useNavigate, so a one-export mock is enough.
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigateSpy }));

import { useLegacyNav } from "./nav.js";

function Harness({ screen, payload }) {
  const { go } = useLegacyNav();
  useEffect(() => {
    go(screen, payload);
  }, []);
  return null;
}

beforeEach(() => navigateSpy.mockClear());

// Regression guard for the DataCloneError that made EVERY Discover "Browse
// services" tile a dead click in real browsers (jsdom's history.pushState does
// not serialize state, so MemoryRouter/jsdom tests never saw it). Under
// BrowserRouter, history.pushState structured-clones the `state` object; a
// category payload carries lucide `Icon` React components (forwardRef objects),
// which cannot be cloned -> pushState throws inside navigate() -> no navigation.
// structuredClone here reproduces that serialization exactly.
test("go() attaches only structured-clone-safe history state for a category payload", () => {
  const Icon = forwardRef(() => null); // lucide icons are forwardRef components
  Icon.displayName = "Icon";
  const category = {
    key: "hotels",
    label: "Hotels & Housing",
    Icon,
    blurb: "Stays for every length",
    subTypes: [
      { key: "hotels", label: "Hotels", Icon },
      { key: "resorts", label: "Resorts", Icon },
    ],
  };

  render(<Harness screen="subcategory" payload={category} />);

  expect(navigateSpy).toHaveBeenCalledTimes(1);
  const [path, options] = navigateSpy.mock.calls[0];
  expect(path).toBe("/browse/hotels");
  // The exact thing a real browser does to `state` on navigation:
  expect(() => structuredClone(options?.state)).not.toThrow();
  // The non-serializable component is stripped; identifying data is kept so the
  // payload still means something to any page that reads location.state.
  expect(options.state.payload.Icon).toBeUndefined();
  expect(options.state.payload.key).toBe("hotels");
  expect(options.state.payload.subTypes.map((s) => s.key)).toEqual([
    "hotels",
    "resorts",
  ]);
  expect(options.state.payload.subTypes[0].Icon).toBeUndefined();
});

// The first-paint optimization must survive: business/guide payloads are plain
// data (no React components) and every field should pass through untouched, so
// BusinessPage/GuideArticlePage still get their head-start payload.
test("go() preserves plain-data payloads used as a first-paint optimization", () => {
  render(
    <Harness
      screen="business"
      payload={{ id: "b1", slug: "java-house", name: "Java House", rating: 4.6 }}
    />,
  );

  const [path, options] = navigateSpy.mock.calls[0];
  expect(path).toBe("/b/java-house");
  expect(() => structuredClone(options?.state)).not.toThrow();
  expect(options.state.payload).toMatchObject({
    slug: "java-house",
    name: "Java House",
    rating: 4.6,
  });
});
