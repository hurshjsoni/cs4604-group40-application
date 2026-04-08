import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  normalizeTrimmed,
  normalizeOptionalTrimmed,
  normalizeStringArrayStrict,
  assertRangeOrder,
  assertNonNegative,
  assertReasonableDate,
} from "../convex/validation.ts";

test("normalize helpers trim and normalize deterministic values", () => {
  assert.equal(normalizeTrimmed("  hello  "), "hello");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM  "), "user@example.com");
  assert.equal(normalizeOptionalTrimmed("   "), undefined);
  assert.equal(normalizeOptionalTrimmed("  value "), "value");
});

test("normalizeStringArrayStrict removes blanks and case-insensitive duplicates", () => {
  const normalized = normalizeStringArrayStrict([
    "  Gym ",
    "gym",
    " Parking",
    "parking ",
    "  ",
    "Laundry",
  ]);
  assert.deepEqual(normalized, ["Gym", "Parking", "Laundry"]);
});

test("numeric/date assertions accept valid input", () => {
  assert.doesNotThrow(() => assertNonNegative(0, "Field"));
  assert.doesNotThrow(() => assertRangeOrder(100, 200, "Min", "Max"));
  assert.doesNotThrow(() => assertReasonableDate("2026-08-01", "Move-in"));
});

test("numeric/date assertions reject invalid input", () => {
  assert.throws(() => assertNonNegative(-1, "Field"));
  assert.throws(() => assertRangeOrder(200, 100, "Min", "Max"));
  assert.throws(() => assertReasonableDate("not-a-date", "Move-in"));
});
