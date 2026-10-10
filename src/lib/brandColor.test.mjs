import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHex, readableInk, darken, luminance, iconInitials, appIconUrl, BRAND_PRESETS } from "./brandColor.ts";

test("accepts only a plain 6-digit hex colour", () => {
  assert.equal(normalizeHex("#7A1632"), "#7a1632");
  assert.equal(normalizeHex("  #abcdef "), "#abcdef");
  for (const bad of ["red", "#fff", "#12345", "#1234567", "7a1632", "#gggggg", "rgb(1,2,3)", "#7a1632;", "#7a1632\"><script>", "url(x)", "", null, undefined, 123, {}, ["#7a1632"]]) {
    assert.equal(normalizeHex(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("picks white text on dark colours and dark text on light colours", () => {
  assert.equal(readableInk("#7a1632"), "#ffffff");
  assert.equal(readableInk("#14532d"), "#ffffff");
  assert.equal(readableInk("#1e3a5f"), "#ffffff");
  assert.equal(readableInk("#000000"), "#ffffff");
  assert.equal(readableInk("#ffffff"), "#111111");
  assert.equal(readableInk("#fde68a"), "#111111");
  assert.equal(readableInk("#ffd700"), "#111111");
});

test("every preset is valid and readable (contrast at least 4.5:1)", () => {
  for (const p of BRAND_PRESETS) {
    assert.ok(normalizeHex(p.hex), p.id);
    const ink = readableInk(p.hex);
    const Lb = luminance(p.hex), Li = luminance(ink);
    const ratio = (Math.max(Lb, Li) + 0.05) / (Math.min(Lb, Li) + 0.05);
    assert.ok(ratio >= 4.5, `${p.id} contrast ${ratio.toFixed(2)}`);
  }
});

test("darken mixes with black and stays valid", () => {
  assert.equal(darken("#ffffff", 0), "#ffffff");
  assert.equal(darken("#ffffff", 1), "#000000");
  assert.equal(darken("#808080", 0.5), "#404040");
  assert.equal(darken("#ff0000", 0.45), "#8c0000");
  assert.ok(normalizeHex(darken("#7a1632", 0.45)));
  assert.equal(darken("#336699", 5), "#000000"); // out-of-range ratio is clamped
});

test("icon initials and address", () => {
  assert.equal(iconInitials("Royal Cuts"), "RC");
  assert.equal(iconInitials("Raju"), "RA");
  assert.equal(iconInitials("कचरू नई"), "B");
  assert.equal(iconInitials("  "), "B");
  assert.equal(iconInitials("a-b c"), "AC");
  assert.equal(appIconUrl({ color: "#7A1632", name: "Royal Cuts", size: 192 }), "/api/public/app-icon?s=192&c=7a1632&t=RC");
  assert.equal(appIconUrl({ color: "bad", name: "X", size: 512, maskable: true }), "/api/public/app-icon?s=512&c=4f46e5&t=X&m=1");
});
