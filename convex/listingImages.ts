import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireAuthedUser } from "./lib";

type Ctx = QueryCtx | MutationCtx;

async function getLatestProviderProfileByUser(
  ctx: Ctx,
  userId: Doc<"users">["_id"],
) {
  const rows = await ctx.db
    .query("providerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

function normalizeSortOrder(order: number | undefined, max: number) {
  if (order === undefined) return max;
  if (!Number.isInteger(order) || order < 0) {
    throw new ConvexError("Sort order must be a non-negative integer");
  }
  return Math.min(order, max);
}

export const getByListing = query({
  args: { listingId: v.id("apartmentListings") },
  handler: async (ctx, { listingId }) => {
    return await ctx.db
      .query("listingImages")
      .withIndex("by_listing_order", (q) => q.eq("listingId", listingId))
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

export const saveImage = mutation({
  args: {
    listingId: v.id("apartmentListings"),
    storageId: v.id("_storage"),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { listingId, storageId, sortOrder }) => {
    const user = await requireAuthedUser(ctx);

    // Verify listing ownership
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const provider = await getLatestProviderProfileByUser(ctx, user._id);
    if (!provider || listing.providerId !== provider._id) {
      throw new ConvexError("Not authorized");
    }

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new ConvexError("Failed to get storage URL");

    const existing = await ctx.db
      .query("listingImages")
      .withIndex("by_listing_order", (q) => q.eq("listingId", listingId))
      .collect();

    const order = normalizeSortOrder(sortOrder, existing.length);
    for (let i = order; i < existing.length; i++) {
      await ctx.db.patch(existing[i]._id, { sortOrder: i + 1 });
    }

    return await ctx.db.insert("listingImages", {
      listingId,
      storageId,
      url,
      sortOrder: order,
    });
  },
});

export const addImageByUrl = mutation({
  args: {
    listingId: v.id("apartmentListings"),
    url: v.string(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { listingId, url, sortOrder }) => {
    const user = await requireAuthedUser(ctx);
    const normalizedUrl = url.trim();
    if (!normalizedUrl) throw new ConvexError("Image URL is required");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const provider = await getLatestProviderProfileByUser(ctx, user._id);
    if (!provider || listing.providerId !== provider._id) {
      throw new ConvexError("Not authorized");
    }

    const existing = await ctx.db
      .query("listingImages")
      .withIndex("by_listing_order", (q) => q.eq("listingId", listingId))
      .collect();

    const order = normalizeSortOrder(sortOrder, existing.length);
    for (let i = order; i < existing.length; i++) {
      await ctx.db.patch(existing[i]._id, { sortOrder: i + 1 });
    }

    return await ctx.db.insert("listingImages", {
      listingId,
      storageId: undefined,
      url: normalizedUrl,
      sortOrder: order,
    });
  },
});

export const removeImage = mutation({
  args: { imageId: v.id("listingImages") },
  handler: async (ctx, { imageId }) => {
    const user = await requireAuthedUser(ctx);

    const image = await ctx.db.get(imageId);
    if (!image) throw new ConvexError("Image not found");

    const listing = await ctx.db.get(image.listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const provider = await getLatestProviderProfileByUser(ctx, user._id);
    if (!provider || listing.providerId !== provider._id) {
      throw new ConvexError("Not authorized");
    }

    if (image.storageId) {
      await ctx.storage.delete(image.storageId);
    }
    await ctx.db.delete(imageId);

    // Re-order remaining
    const remaining = await ctx.db
      .query("listingImages")
      .withIndex("by_listing_order", (q) => q.eq("listingId", image.listingId))
      .collect();
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await ctx.db.patch(remaining[i]._id, { sortOrder: i });
      }
    }
  },
});
