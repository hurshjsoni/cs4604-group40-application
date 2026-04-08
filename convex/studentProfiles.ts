import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUserWithRole } from "./lib";
import { assertMaxLength, normalizeOptionalTrimmed } from "./validation";

type Ctx = QueryCtx | MutationCtx;

async function getLatestStudentProfileByUser(
  ctx: Ctx,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("studentProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await getLatestStudentProfileByUser(ctx, userId);

    if (!profile) return null;

    const college = profile.collegeId ? await ctx.db.get(profile.collegeId) : null;
    return { ...profile, college };
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return null;

    const profile = await getLatestStudentProfileByUser(ctx, user._id);

    if (!profile) return null;

    const college = profile.collegeId ? await ctx.db.get(profile.collegeId) : null;
    return { ...profile, college };
  },
});

export const upsert = mutation({
  args: {
    collegeId: v.optional(v.id("colleges")),
    graduationYear: v.optional(v.number()),
    major: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    if (args.collegeId !== undefined) {
      const college = await ctx.db.get(args.collegeId);
      if (!college) throw new ConvexError("College not found");
    }
    if (args.graduationYear !== undefined) {
      if (args.graduationYear < 1900 || args.graduationYear > 2100) {
        throw new ConvexError("Graduation year is out of range");
      }
    }
    assertMaxLength(args.major, "Major", 120);

    const rows = await ctx.db
      .query("studentProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const existing = rows[0] ?? null;
    for (const duplicate of rows.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (args.collegeId !== undefined) updates.collegeId = args.collegeId;
      if (args.graduationYear !== undefined) updates.graduationYear = args.graduationYear;
      if (args.major !== undefined) updates.major = normalizeOptionalTrimmed(args.major);

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    }

    const insertedId = await ctx.db.insert("studentProfiles", {
      userId: user._id,
      collegeId: args.collegeId,
      graduationYear: args.graduationYear,
      major: normalizeOptionalTrimmed(args.major),
    });
    const afterInsert = await ctx.db
      .query("studentProfiles")
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
