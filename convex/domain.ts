import { v } from "convex/values";

export const contactTypeValidator = v.union(
  v.literal("email"),
  v.literal("phone"),
  v.literal("instagram"),
  v.literal("snapchat"),
  v.literal("discord"),
  v.literal("twitter"),
  v.literal("linkedin"),
  v.literal("other"),
);

export const rentTypeValidator = v.union(
  v.literal("entire_unit"),
  v.literal("per_bed"),
  v.literal("per_person"),
);

export const petPolicyValidator = v.union(
  v.literal("allowed"),
  v.literal("not_allowed"),
  v.literal("case_by_case"),
);

export const utilitiesPolicyValidator = v.union(
  v.literal("included"),
  v.literal("not_included"),
  v.literal("partial"),
);

export const parkingPolicyValidator = v.union(
  v.literal("included"),
  v.literal("available"),
  v.literal("none"),
);

export const matchStatusValidator = v.union(
  v.literal("suggested"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
);

export const matchTypeValidator = v.union(
  v.literal("smart"),
  v.literal("manual"),
);

export const groupStatusValidator = v.union(
  v.literal("searching"),
  v.literal("found_place"),
  v.literal("confirmed"),
  v.literal("disbanded"),
);

export const lifestyleValidator = v.object({
  sleepSchedule: v.optional(v.union(v.literal("early_bird"), v.literal("night_owl"), v.literal("flexible"))),
  wakeUpTime: v.optional(v.string()),
  bedTime: v.optional(v.string()),
  cleanliness: v.optional(v.union(v.literal("very_clean"), v.literal("clean"), v.literal("moderate"), v.literal("relaxed"))),
  cleaningFrequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("biweekly"), v.literal("monthly"))),
  socialLevel: v.optional(v.union(v.literal("introvert"), v.literal("ambivert"), v.literal("extrovert"))),
  guestFrequency: v.optional(v.union(v.literal("never"), v.literal("rarely"), v.literal("sometimes"), v.literal("often"), v.literal("very_often"))),
  overnightGuests: v.optional(v.union(v.literal("never"), v.literal("rarely"), v.literal("sometimes"), v.literal("often"))),
  noiseLevel: v.optional(v.union(v.literal("very_quiet"), v.literal("quiet"), v.literal("moderate"), v.literal("lively"))),
  studyEnvironment: v.optional(v.union(v.literal("complete_silence"), v.literal("quiet"), v.literal("some_noise_ok"), v.literal("anywhere"))),
  musicPreference: v.optional(v.union(v.literal("headphones_only"), v.literal("low_volume"), v.literal("moderate"), v.literal("loud_ok"))),
  smoking: v.optional(v.union(v.literal("never"), v.literal("outside_only"), v.literal("yes"))),
  drinking: v.optional(v.union(v.literal("never"), v.literal("socially"), v.literal("regularly"))),
  pets: v.optional(v.union(v.literal("no_pets"), v.literal("have_pet"), v.literal("want_pet"), v.literal("allergic"))),
  petTypes: v.optional(v.array(v.string())),
  yearInSchool: v.optional(v.union(v.literal("freshman"), v.literal("sophomore"), v.literal("junior"), v.literal("senior"), v.literal("graduate"), v.literal("other"))),
  studyHabits: v.optional(v.union(v.literal("home_only"), v.literal("library_only"), v.literal("mixed"), v.literal("anywhere"))),
  workSchedule: v.optional(v.union(v.literal("no_job"), v.literal("part_time"), v.literal("full_time"), v.literal("internship"))),
  temperaturePreference: v.optional(v.union(v.literal("cold"), v.literal("moderate"), v.literal("warm"))),
  cookingFrequency: v.optional(v.union(v.literal("never"), v.literal("rarely"), v.literal("sometimes"), v.literal("often"), v.literal("daily"))),
  dietaryRestrictions: v.optional(v.array(v.string())),
  sharedSpaceUsage: v.optional(v.union(v.literal("minimal"), v.literal("moderate"), v.literal("frequent"))),
});

export const matchBreakdownValidator = v.object({
  budgetScore: v.number(),
  scheduleScore: v.number(),
  cleanlinessScore: v.number(),
  socialScore: v.number(),
  lifestyleScore: v.number(),
  locationScore: v.number(),
  matchedCriteria: v.array(v.string()),
  potentialConflicts: v.array(v.string()),
  aiInsight: v.optional(v.string()),
});

const LIFESTYLE_KEYS = [
  "sleepSchedule",
  "wakeUpTime",
  "bedTime",
  "cleanliness",
  "cleaningFrequency",
  "socialLevel",
  "guestFrequency",
  "overnightGuests",
  "noiseLevel",
  "studyEnvironment",
  "musicPreference",
  "smoking",
  "drinking",
  "pets",
  "petTypes",
  "yearInSchool",
  "studyHabits",
  "workSchedule",
  "temperaturePreference",
  "cookingFrequency",
  "dietaryRestrictions",
  "sharedSpaceUsage",
] as const;

const ALLOWED_LIFESTYLE_KEY_SET = new Set<string>(LIFESTYLE_KEYS);

export function getUnexpectedLifestyleKeys(lifestyle: unknown): string[] {
  if (!lifestyle || typeof lifestyle !== "object") return [];
  return Object.keys(lifestyle).filter((key) => !ALLOWED_LIFESTYLE_KEY_SET.has(key));
}

export function sanitizeLifestyle(
  lifestyle: unknown,
): Record<string, unknown> {
  if (!lifestyle || typeof lifestyle !== "object") return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(lifestyle)) {
    if (ALLOWED_LIFESTYLE_KEY_SET.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
