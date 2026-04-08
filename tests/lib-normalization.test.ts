import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStringArrayStrict } from "../convex/validation.ts";

test("normalizeStringArray trims and removes case-insensitive duplicates", () => {
  const normalized = normalizeStringArrayStrict([
    " Gym ",
    "gym",
    "PARKING",
    "parking",
    "  Laundry ",
    " ",
  ]);
  assert.deepEqual(normalized, ["Gym", "PARKING", "Laundry"]);
});
