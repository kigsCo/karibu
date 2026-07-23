import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  isInKenya,
  isValidKenyanPhone,
  isValidKraPin,
  newBusinessSlug,
  ownsPath,
  slugifyName,
} from "./onboarding.ts";

const UID = "11111111-2222-4333-8444-555555555555";

Deno.test("isValidKraPin accepts the KRA format and nothing else", () => {
  assert(isValidKraPin("A123456789Z"));
  assert(isValidKraPin("P000000001B"));
  assertFalse(isValidKraPin("a123456789z"), "lowercase is not valid");
  assertFalse(isValidKraPin("B123456789Z"), "must start with A or P");
  assertFalse(isValidKraPin("A12345678Z"), "nine digits required");
  assertFalse(isValidKraPin("A1234567890Z"), "not ten digits");
  assertFalse(isValidKraPin("A123456789"), "must end with a letter");
  assertFalse(isValidKraPin(""));
  assertFalse(isValidKraPin(null));
  assertFalse(isValidKraPin(123));
});

Deno.test("isValidKenyanPhone accepts local and international mobile forms", () => {
  for (const good of ["254712345678", "+254712345678", "0712345678",
                      "254110123456", "0110123456"]) {
    assert(isValidKenyanPhone(good), `should accept ${good}`);
  }
  for (const bad of ["12345", "255712345678", "07123456789", "+2547123",
                     "phone", "", null, undefined]) {
    assertFalse(isValidKenyanPhone(bad as unknown), `should reject ${bad}`);
  }
});

Deno.test("isInKenya bounds the coordinates", () => {
  assert(isInKenya(-1.286389, 36.817223), "Nairobi");
  assert(isInKenya(-4.0435, 39.6682), "Mombasa");
  assertFalse(isInKenya(51.5, -0.12), "London");
  assertFalse(isInKenya(0, 0), "null island");
});

Deno.test("ownsPath accepts only the caller's own folder, no tricks", () => {
  assert(ownsPath(`${UID}/photo.jpg`, UID));
  assert(ownsPath(`${UID}/deep/er/file.pdf`, UID));
  assertFalse(ownsPath("other-user/photo.jpg", UID));
  assertFalse(ownsPath(`${UID}`, UID), "a bare folder is not a file path");
  assertFalse(ownsPath(`${UID}/../other/file.jpg`, UID), "no traversal");
  assertFalse(ownsPath(`/${UID}/photo.jpg`, UID), "no leading slash");
  assertFalse(ownsPath("", UID));
  assertFalse(ownsPath(null, UID));
});

Deno.test("slugifyName produces url-safe hyphenated slugs", () => {
  assertEquals(slugifyName("Posh Palace Salon & Spa"), "posh-palace-salon-spa");
  assertEquals(slugifyName("  Café -- Nairobi!  "), "caf-nairobi");
});

Deno.test("newBusinessSlug appends a 6-char suffix", () => {
  const slug = newBusinessSlug("Posh Palace");
  assert(/^posh-palace-[0-9a-f]{6}$/.test(slug), slug);
  assert(newBusinessSlug("Posh Palace") !== newBusinessSlug("Posh Palace"));
});
