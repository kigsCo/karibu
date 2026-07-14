import { pathFor, activeTabFromPath, TAB_PATH } from "./nav.js";

test("pathFor maps screens + payloads to routes", () => {
  expect(pathFor("discover")).toBe("/");
  expect(pathFor("ask")).toBe("/ask");
  expect(pathFor("guides")).toBe("/guides");
  expect(pathFor("guide_article", { slug: "using-mpesa" })).toBe("/guides/using-mpesa");
  expect(pathFor("business", { slug: "the-talisman" })).toBe("/b/the-talisman");
  expect(pathFor("business", { id: "talisman" })).toBe("/b/talisman");
  expect(pathFor("review_compose", { slug: "the-talisman" })).toBe("/b/the-talisman/review");
  expect(pathFor("category", { key: "beauty" })).toBe("/c/beauty");
  expect(pathFor("category", { key: "beauty", subType: { key: "nails" } })).toBe("/c/beauty/nails");
  expect(pathFor("business_signup")).toBe("/for-business");
  expect(pathFor("merchant_dashboard")).toBe("/merchant");
  expect(pathFor("city_picker")).toBe("/city");
});

test("activeTabFromPath highlights the right tab", () => {
  expect(activeTabFromPath("/")).toBe("discover");
  expect(activeTabFromPath("/b/x")).toBe("discover");
  expect(activeTabFromPath("/c/beauty")).toBe("discover");
  expect(activeTabFromPath("/guides")).toBe("guides");
  expect(activeTabFromPath("/saved")).toBe("saved");
  expect(activeTabFromPath("/for-business")).toBe("business_signup");
  expect(activeTabFromPath("/profile")).toBe("profile");
  expect(TAB_PATH.discover).toBe("/");
});
