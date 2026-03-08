import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import {
  getAuthedUser,
  getVisibleContactsForViewer,
  requireAuthedUserWithRole,
  stripSensitiveUserFields,
} from "./lib";
import {
  assertMaxLength,
  assertNonNegative,
  assertRangeOrder,
  assertReasonableDate,
  normalizeStringArrayStrict,
  normalizeOptionalTrimmed,
} from "./validation";
import { lifestyleValidator, sanitizeLifestyle } from "./domain";

type Ctx = QueryCtx | MutationCtx;

async function getLatestRoommateProfileByUser(ctx: Ctx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("roommateProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestSettingsByUser(ctx: Ctx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await getAuthedUser(ctx);
    const profile = await getLatestRoommateProfileByUser(ctx, userId);

    if (!profile) return null;

    const user = await ctx.db.get(profile.userId);
    const college = profile.collegeId ? await ctx.db.get(profile.collegeId) : null;
    const settings = await getLatestSettingsByUser(ctx, userId);
    const isAdminViewer = viewer?.role === "admin";
    const canViewAllContacts = viewer?._id === userId || isAdminViewer;
    const shouldShowInBrowse = settings?.showInBrowse ?? false;
    const canViewProfile = canViewAllContacts || (shouldShowInBrowse && profile.isActive);
    if (!canViewProfile) return null;

    const contactsVisible = await getVisibleContactsForViewer(ctx, userId, viewer?._id);
    const photos = await ctx.db
      .query("userPhotos")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    return {
      ...profile,
      user: user ? { ...stripSensitiveUserFields(user), contactInfo: contactsVisible } : null,
      college,
      photos,
    };
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return null;

    const profile = await getLatestRoommateProfileByUser(ctx, user._id);

    if (!profile) return null;

    const college = profile.collegeId ? await ctx.db.get(profile.collegeId) : null;
    return { ...profile, college };
  },
});

export const listActive = query({
  args: {
    collegeId: v.optional(v.id("colleges")),
  },
  handler: async (ctx, { collegeId }) => {
    const viewer = await getAuthedUser(ctx);

    const profilesQuery = ctx.db
      .query("roommateProfiles")
      .withIndex("by_active", (q) => q.eq("isActive", true));

    const profiles = await profilesQuery.collect();

    // Filter by college client-side (Convex doesn't support compound index queries across different indexes)
    const filtered = collegeId
      ? profiles.filter((p) => p.collegeId === collegeId)
      : profiles;

    // Resolve relations for each profile
    const results = await Promise.all(
      filtered.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        if (!user) return null;

        const college = profile.collegeId ? await ctx.db.get(profile.collegeId) : null;
        const settings = await getLatestSettingsByUser(ctx, profile.userId);
        const photos = await ctx.db
          .query("userPhotos")
          .withIndex("by_user_order", (q) => q.eq("userId", profile.userId))
          .collect();
        const canViewAllContacts = viewer?._id === profile.userId;
        const shouldShowInBrowse = settings?.showInBrowse ?? false;
        if (!canViewAllContacts && !shouldShowInBrowse) {
          return null;
        }
        const contactsVisible = await getVisibleContactsForViewer(
          ctx,
          profile.userId,
          viewer?._id,
        );

        return {
          ...profile,
          user: { ...stripSensitiveUserFields(user), contactInfo: contactsVisible },
          college,
          photos,
        };
      }),
    );

    return results.filter(Boolean);
  },
});

/**
 * Paginated browse endpoint for roommate discovery.
 * This avoids unbounded full-table scans in client-facing browse pages.
 */
export const listActivePaginated = query({
  args: {
    collegeId: v.optional(v.id("colleges")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { collegeId, paginationOpts }) => {
    const viewer = await getAuthedUser(ctx);
    const page = await ctx.db
      .query("roommateProfiles")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .paginate(paginationOpts);

    const results = await Promise.all(
      page.page.map(async (profile) => {
        if (collegeId && profile.collegeId !== collegeId) return null;

        const user = await ctx.db.get(profile.userId);
        if (!user) return null;

        const college = profile.collegeId ? await ctx.db.get(profile.collegeId) : null;
        const settings = await getLatestSettingsByUser(ctx, profile.userId);
        const canViewAllContacts = viewer?._id === profile.userId;
        const shouldShowInBrowse = settings?.showInBrowse ?? false;
        if (!canViewAllContacts && !shouldShowInBrowse) return null;

        const contactsVisible = await getVisibleContactsForViewer(
          ctx,
          profile.userId,
          viewer?._id,
        );
        const photos = await ctx.db
          .query("userPhotos")
          .withIndex("by_user_order", (q) => q.eq("userId", profile.userId))
          .collect();

        return {
          ...profile,
          user: { ...stripSensitiveUserFields(user), contactInfo: contactsVisible },
          college,
          photos,
        };
      }),
    );

    return {
      ...page,
      page: results.filter(Boolean),
    };
  },
});

export const upsert = mutation({
  args: {
    collegeId: v.optional(v.id("colleges")),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    preferredLocations: v.optional(v.array(v.string())),
    moveInDate: v.optional(v.string()),
    moveInFlexibility: v.optional(
      v.union(v.literal("exact"), v.literal("within_week"), v.literal("within_month"), v.literal("flexible")),
    ),
    leaseDuration: v.optional(
      v.union(v.literal("semester"), v.literal("academic_year"), v.literal("full_year"), v.literal("flexible")),
    ),
    lifestyle: v.optional(lifestyleValidator),
    bio: v.optional(v.string()),
    dealBreakers: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    lookingFor: v.optional(
      v.union(v.literal("single_roommate"), v.literal("multiple_roommates"), v.literal("any")),
    ),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    genderPreference: v.optional(
      v.union(
        v.literal("same_gender"),
        v.literal("any_gender"),
        v.literal("no_preference"),
        v.literal("male"),
        v.literal("female"),
      ),
    ),
    aboutMeTags: v.optional(v.array(v.string())),
    roommatePreferences: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    if (args.collegeId !== undefined) {
      const college = await ctx.db.get(args.collegeId);
      if (!college) throw new ConvexError("College not found");
    }
    assertNonNegative(args.budgetMin, "Budget minimum");
    assertNonNegative(args.budgetMax, "Budget maximum");
    assertRangeOrder(args.budgetMin, args.budgetMax, "Budget minimum", "Budget maximum");
    assertReasonableDate(args.moveInDate, "Move-in date");
    assertMaxLength(args.bio, "Bio", 2000);

    const rows = await ctx.db
      .query("roommateProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const existing = rows[0] ?? null;
    for (const duplicate of rows.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }

    // Strip undefined values from an object so Convex doesn't reject them
    const clean = (obj: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

    if (existing) {
      const updates: Record<string, unknown> = {};
      const sanitizedExistingLifestyle = sanitizeLifestyle(existing.lifestyle);
      if (args.collegeId !== undefined) updates.collegeId = args.collegeId;
      if (args.budgetMin !== undefined) updates.budgetMin = args.budgetMin;
      if (args.budgetMax !== undefined) updates.budgetMax = args.budgetMax;
      if (args.moveInDate !== undefined) updates.moveInDate = args.moveInDate;
      if (args.moveInFlexibility !== undefined) updates.moveInFlexibility = args.moveInFlexibility;
      if (args.leaseDuration !== undefined) updates.leaseDuration = args.leaseDuration;
      if (args.lifestyle !== undefined) {
        updates.lifestyle = clean(
          sanitizeLifestyle({
            ...sanitizedExistingLifestyle,
            ...(args.lifestyle as Record<string, unknown>),
          }),
        );
      } else if (
        JSON.stringify(existing.lifestyle ?? {}) !== JSON.stringify(sanitizedExistingLifestyle)
      ) {
        // Opportunistic cleanup of legacy keys no longer supported by the profile UI.
        updates.lifestyle = clean(sanitizedExistingLifestyle);
      }
      if (args.bio !== undefined) updates.bio = normalizeOptionalTrimmed(args.bio);
      if (args.dealBreakers !== undefined) updates.dealBreakers = normalizeStringArrayStrict(args.dealBreakers);
      if (args.isActive !== undefined) updates.isActive = args.isActive;
      if (args.lookingFor !== undefined) updates.lookingFor = args.lookingFor;
      if (args.gender !== undefined) updates.gender = args.gender;
      if (args.genderPreference !== undefined) updates.genderPreference = args.genderPreference;
      if (args.aboutMeTags !== undefined) updates.aboutMeTags = normalizeStringArrayStrict(args.aboutMeTags);
      if (args.roommatePreferences !== undefined) {
        updates.roommatePreferences = normalizeStringArrayStrict(args.roommatePreferences);
      }
      if (args.preferredLocations !== undefined) {
        updates.preferredLocations = normalizeStringArrayStrict(args.preferredLocations);
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    }

    const insertedId = await ctx.db.insert("roommateProfiles", {
      userId: user._id,
      collegeId: args.collegeId,
      budgetMin: args.budgetMin,
      budgetMax: args.budgetMax,
      preferredLocations: normalizeStringArrayStrict(args.preferredLocations),
      moveInDate: args.moveInDate,
      moveInFlexibility: args.moveInFlexibility,
      leaseDuration: args.leaseDuration,
      lifestyle: args.lifestyle ? clean(sanitizeLifestyle(args.lifestyle)) : {},
      bio: normalizeOptionalTrimmed(args.bio),
      dealBreakers: normalizeStringArrayStrict(args.dealBreakers),
      isActive: args.isActive ?? true,
      lookingFor: args.lookingFor,
      gender: args.gender,
      genderPreference: args.genderPreference,
      aboutMeTags: normalizeStringArrayStrict(args.aboutMeTags),
      roommatePreferences: normalizeStringArrayStrict(args.roommatePreferences),
    });
    const afterInsert = await ctx.db
      .query("roommateProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    afterInsert.sort((a, b) => b._creationTime - a._creationTime);
    const canonical = afterInsert.find((row) => row._id === insertedId) ?? afterInsert[0];
    for (const row of afterInsert) {
      if (row._id !== canonical._id) await ctx.db.delete(row._id);
    }
    return canonical._id;
  },
});

export const toggleActive = mutation({
  args: { isActive: v.boolean() },
  handler: async (ctx, { isActive }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");

    const profile = await getLatestRoommateProfileByUser(ctx, user._id);
    if (!profile) throw new ConvexError("Roommate profile not found");

    await ctx.db.patch(profile._id, { isActive });
  },
});
