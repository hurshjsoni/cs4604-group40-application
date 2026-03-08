import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUser } from "./lib";

type Ctx = QueryCtx | MutationCtx;

function normalizeSortOrder(order: number | undefined, max: number) {
  if (order === undefined) return max;
  if (!Number.isInteger(order) || order < 0) {
    throw new ConvexError("Sort order must be a non-negative integer");
  }
  return Math.min(order, max);
}

async function getLatestSettingsByUser(ctx: Ctx, userId: Doc<"users">["_id"]) {
  const rows = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestRoommateProfileByUser(ctx: Ctx, userId: Doc<"users">["_id"]) {
  const rows = await ctx.db
    .query("roommateProfiles")
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
    if (!viewer) return [];
    if (viewer._id !== userId) {
      const settings = await getLatestSettingsByUser(ctx, userId);
      const profile = await getLatestRoommateProfileByUser(ctx, userId);
      if (!settings?.showInBrowse || !profile?.isActive) {
        return [];
      }
    }

    return await ctx.db
      .query("userPhotos")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const savePhoto = mutation({
  args: {
    storageId: v.id("_storage"),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { storageId, sortOrder }) => {
    const user = await requireAuthedUser(ctx);

    const existing = await ctx.db
      .query("userPhotos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.length >= 3) throw new ConvexError("Maximum 3 photos allowed");

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new ConvexError("Failed to get storage URL");

    const order = normalizeSortOrder(sortOrder, existing.length);
    const ordered = [...existing].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = order; i < ordered.length; i++) {
      await ctx.db.patch(ordered[i]._id, { sortOrder: i + 1 });
    }

    return await ctx.db.insert("userPhotos", {
      userId: user._id,
      storageId,
      url,
      sortOrder: order,
    });
  },
});

export const removePhoto = mutation({
  args: { photoId: v.id("userPhotos") },
  handler: async (ctx, { photoId }) => {
    const user = await requireAuthedUser(ctx);

    const photo = await ctx.db.get(photoId);
    if (!photo) throw new ConvexError("Photo not found");
    if (photo.userId !== user._id) throw new ConvexError("Not authorized");

    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(photoId);

    // Re-order remaining photos
    const remaining = await ctx.db
      .query("userPhotos")
      .withIndex("by_user_order", (q) => q.eq("userId", user._id))
      .collect();
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await ctx.db.patch(remaining[i]._id, { sortOrder: i });
      }
    }
  },
});

export const reorderPhotos = mutation({
  args: {
    photoIds: v.array(v.id("userPhotos")),
  },
  handler: async (ctx, { photoIds }) => {
    const user = await requireAuthedUser(ctx);
    const uniquePhotoIds = new Set(photoIds);
    if (uniquePhotoIds.size !== photoIds.length) {
      throw new ConvexError("Photo reorder payload contains duplicate IDs");
    }
    const existing = await ctx.db
      .query("userPhotos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.length !== photoIds.length) {
      throw new ConvexError("Photo reorder must include all photos");
    }
    for (const photo of existing) {
      if (!uniquePhotoIds.has(photo._id)) {
        throw new ConvexError("Photo reorder must include all photos");
      }
    }

    for (let i = 0; i < photoIds.length; i++) {
      const photo = await ctx.db.get(photoIds[i]);
      if (!photo || photo.userId !== user._id) throw new ConvexError("Not authorized");
      await ctx.db.patch(photoIds[i], { sortOrder: i });
    }
  },
});
