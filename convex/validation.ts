import { ConvexError } from "convex/values";

/**
 * Shared, deterministic validation helpers for Convex mutations.
 * Keep these narrow and reusable so constraint behavior stays consistent.
 */

export function normalizeTrimmed(value: string): string {
  return value.trim();
}

export function normalizeOptionalTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) throw new ConvexError(`${fieldName} is required`);
}

export function assertMaxLength(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
): void {
  if (value !== undefined && value.length > maxLength) {
    throw new ConvexError(`${fieldName} must be at most ${maxLength} characters`);
  }
}

export function assertNonNegative(value: number | undefined, fieldName: string): void {
  if (value !== undefined && value < 0) {
    throw new ConvexError(`${fieldName} must be non-negative`);
  }
}

export function assertRangeOrder(
  minValue: number | undefined,
  maxValue: number | undefined,
  minFieldName: string,
  maxFieldName: string,
): void {
  if (
    minValue !== undefined &&
    maxValue !== undefined &&
    minValue > maxValue
  ) {
    throw new ConvexError(`${minFieldName} cannot be greater than ${maxFieldName}`);
  }
}

export function normalizeStringArrayStrict(values: string[] | undefined): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function assertReasonableDate(value: string | undefined, fieldName: string): void {
  if (!value) return;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new ConvexError(`${fieldName} must be a valid date`);
  }
}

