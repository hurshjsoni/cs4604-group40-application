import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUserWithRole, stripSensitiveUserFields } from "./lib";
import {
  assertMaxLength,
  assertNonEmpty,
  normalizeOptionalTrimmed,
  normalizeTrimmed,
} from "./validation";

type Ctx = QueryCtx | MutationCtx;

async function getLatestProviderProfileByUser(ctx: Ctx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("providerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await getLatestProviderProfileByUser(ctx, userId);

    if (!profile) return null;

    const colleges = await Promise.all(
      profile.collegeIds.map((id) => ctx.db.get(id)),
    );

    const listings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_provider", (q) => q.eq("providerId", profile._id))
      .collect();

    return {
      ...profile,
      colleges: colleges.filter(Boolean),
      totalListings: listings.length,
    };
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return null;

    const profile = await getLatestProviderProfileByUser(ctx, user._id);

    if (!profile) return null;

    const colleges = await Promise.all(
      profile.collegeIds.map((id) => ctx.db.get(id)),
    );

    const listings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_provider", (q) => q.eq("providerId", profile._id))
      .collect();

    return {
      ...profile,
      colleges: colleges.filter(Boolean),
      totalListings: listings.length,
    };
  },
});

export const getById = query({
  args: { profileId: v.id("providerProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;

    const user = stripSensitiveUserFields(await ctx.db.get(profile.userId));
    const colleges = await Promise.all(
      profile.collegeIds.map((id) => ctx.db.get(id)),
    );

    const listings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_provider", (q) => q.eq("providerId", profile._id))
      .collect();

    return {
      ...profile,
      user,
      colleges: colleges.filter(Boolean),
      totalListings: listings.length,
    };
  },
});

export const upsert = mutation({
  args: {
    companyName: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    collegeIds: v.optional(v.array(v.id("colleges"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUserWithRole(ctx, "provider");
    if (args.collegeIds !== undefined) {
      for (const collegeId of args.collegeIds) {
        const college = await ctx.db.get(collegeId);
        if (!college) throw new ConvexError("One or more selected colleges no longer exist");
      }
    }

    const rows = await ctx.db
      .query("providerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const existing = rows[0] ?? null;
    for (const duplicate of rows.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (args.companyName !== undefined) {
        const companyName = normalizeTrimmed(args.companyName);
        assertNonEmpty(companyName, "Company name");
        assertMaxLength(companyName, "Company name", 140);
        updates.companyName = companyName;
      }
      if (args.description !== undefined) {
        const description = normalizeOptionalTrimmed(args.description);
        assertMaxLength(description, "Description", 2000);
        updates.description = description;
      }
      if (args.website !== undefined) updates.website = normalizeOptionalTrimmed(args.website);
      if (args.phone !== undefined) updates.phone = normalizeOptionalTrimmed(args.phone);
      if (args.address !== undefined) updates.address = normalizeOptionalTrimmed(args.address);
      if (args.collegeIds !== undefined) updates.collegeIds = [...new Set(args.collegeIds)];

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    }

    if (!args.companyName) throw new ConvexError("Company name is required");
    const companyName = normalizeTrimmed(args.companyName);
    assertNonEmpty(companyName, "Company name");
    assertMaxLength(companyName, "Company name", 140);
    const description = normalizeOptionalTrimmed(args.description);
    assertMaxLength(description, "Description", 2000);

    const insertedId = await ctx.db.insert("providerProfiles", {
      userId: user._id,
      companyName,
      description,
      website: normalizeOptionalTrimmed(args.website),
      phone: normalizeOptionalTrimmed(args.phone),
      address: normalizeOptionalTrimmed(args.address),
      verified: false,
      collegeIds: [...new Set(args.collegeIds ?? [])],
    });
    const afterInsert = await ctx.db
      .query("providerProfiles")
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
