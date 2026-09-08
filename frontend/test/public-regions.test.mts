import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePublicRegion,
  formatPublicRegion,
  matchesPublicRegion,
  getDeduplicatedPublicRegions,
  ORDERED_PUBLIC_REGIONS,
} from "../src/lib/public-regions.ts";

test("1. normalizePublicRegion correctly maps English and variant raw values to Thai labels", () => {
  assert.equal(normalizePublicRegion("Central"), "ภาคกลาง");
  assert.equal(normalizePublicRegion("central"), "ภาคกลาง");
  assert.equal(normalizePublicRegion("Central Thailand"), "ภาคกลาง");
  assert.equal(normalizePublicRegion("central-thailand"), "ภาคกลาง");
  assert.equal(normalizePublicRegion("ภาคกลาง"), "ภาคกลาง");

  assert.equal(normalizePublicRegion("Northern"), "ภาคเหนือ");
  assert.equal(normalizePublicRegion("northern"), "ภาคเหนือ");
  assert.equal(normalizePublicRegion("ภาคเหนือ"), "ภาคเหนือ");

  assert.equal(normalizePublicRegion("Northeastern"), "ภาคตะวันออกเฉียงเหนือ");
  assert.equal(normalizePublicRegion("northeastern"), "ภาคตะวันออกเฉียงเหนือ");

  assert.equal(normalizePublicRegion("Southern"), "ภาคใต้");
  assert.equal(normalizePublicRegion("southern"), "ภาคใต้");

  assert.equal(normalizePublicRegion("Eastern"), "ภาคตะวันออก");
  assert.equal(normalizePublicRegion("eastern"), "ภาคตะวันออก");

  assert.equal(normalizePublicRegion("Western"), "ภาคตะวันตก");
  assert.equal(normalizePublicRegion("western"), "ภาคตะวันตก");

  // Null, empty, and unknown
  assert.equal(normalizePublicRegion(null), null);
  assert.equal(normalizePublicRegion(undefined), null);
  assert.equal(normalizePublicRegion(""), null);
  assert.equal(normalizePublicRegion("UnknownRegion"), "UnknownRegion");
});

test("2. formatPublicRegion formats region safely for public UI", () => {
  assert.equal(formatPublicRegion("Central Thailand"), "ภาคกลาง");
  assert.equal(formatPublicRegion("Northern"), "ภาคเหนือ");
  assert.equal(formatPublicRegion("Western"), "ภาคตะวันตก");
  assert.equal(formatPublicRegion(null), "");
  assert.equal(formatPublicRegion(undefined), "");
});

test("3. matchesPublicRegion matches stores with raw variant region values", () => {
  // Matching with Thai label
  assert.equal(matchesPublicRegion("Central", "ภาคกลาง"), true);
  assert.equal(matchesPublicRegion("Central Thailand", "ภาคกลาง"), true);
  assert.equal(matchesPublicRegion("Northern", "ภาคกลาง"), false);

  // Matching with English raw query
  assert.equal(matchesPublicRegion("Central", "Central"), true);
  assert.equal(matchesPublicRegion("Central Thailand", "Central"), true);
  assert.equal(matchesPublicRegion("Central", "Central Thailand"), true);

  // ALL matches any store
  assert.equal(matchesPublicRegion("Central", "ALL"), true);
  assert.equal(matchesPublicRegion("Northern", "ALL"), true);
  assert.equal(matchesPublicRegion(null, "ALL"), true);

  // Null store region does not match specific filter
  assert.equal(matchesPublicRegion(null, "ภาคกลาง"), false);
  assert.equal(matchesPublicRegion(undefined, "ภาคกลาง"), false);

  // Western region
  assert.equal(matchesPublicRegion("Western", "ภาคตะวันตก"), true);
  assert.equal(matchesPublicRegion("Western", "Western"), true);
});

test("4. getDeduplicatedPublicRegions merges equivalent raw values and prevents duplicates", () => {
  const rawDbRegions = [
    "Central",
    "Central Thailand",
    "Eastern",
    "Northeastern",
    "Northern",
    "Southern",
    "Western",
  ];

  const deduplicated = getDeduplicatedPublicRegions(rawDbRegions);

  // Should contain exactly 6 unique Thai regions in order
  assert.deepEqual(deduplicated, [
    "ภาคกลาง",
    "ภาคเหนือ",
    "ภาคตะวันออกเฉียงเหนือ",
    "ภาคใต้",
    "ภาคตะวันออก",
    "ภาคตะวันตก",
  ]);

  // No duplicate "Central" / "Central Thailand"
  const centralMatches = deduplicated.filter((r) => r === "ภาคกลาง");
  assert.equal(centralMatches.length, 1);
});
