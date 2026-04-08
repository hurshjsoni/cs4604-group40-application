import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  requireAuthedUser,
  requireAuthedUserWithRole,
  getAuthedUser,
  getVisibleContactsForViewer,
} from "./lib";

async function getSavedRowsForUserListing(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  listingId: Id<"apartmentListings">,
) {
  const rows = await ctx.db
    .query("savedListings")
    .withIndex("by_user_listing", (q) =>
      q.eq("userId", userId).eq("listingId", listingId),
    )
    .collect();
  return rows.sort((a, b) => b._creationTime - a._creationTime);
}

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    const saved = await ctx.db
      .query("savedListings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const deduped = new Map<string, (typeof saved)[number]>();
    for (const row of saved) {
      const key = String(row.listingId);
      const existing = deduped.get(key);
      if (!existing || row._creationTime > existing._creationTime) {
        deduped.set(key, row);
      }
    }

    const results = await Promise.all(
      [...deduped.values()].map(async (s) => {
        const listing = await ctx.db.get(s.listingId);
        if (!listing) return null;

        const images = await ctx.db
          .query("listingImages")
          .withIndex("by_listing_order", (q) => q.eq("listingId", listing._id))
          .collect();

        const colleges = await Promise.all(
          listing.collegeIds.map((id: Id<"colleges">) => ctx.db.get(id)),
        );

        const provider = await ctx.db.get(listing.providerId);

        return {
          ...s,
          listing: {
            ...listing,
            images: images.map((img) => img.url),
            colleges: colleges.filter(Boolean),
            provider,
          },
        };
      }),
    );

    return results.filter(Boolean);
  },
});

export const isSaved = query({
  args: { listingId: v.id("apartmentListings") },
  handler: async (ctx, { listingId }) => {
    const user = await getAuthedUser(ctx);
    if (!user) return false;

    const existing = await getSavedRowsForUserListing(ctx, user._id, listingId);
    return existing.length > 0;
  },
});

export const toggle = mutation({
  args: { listingId: v.id("apartmentListings") },
  handler: async (ctx, { listingId }) => {
    const user = await requireAuthedUser(ctx);

    // Verify listing exists
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const existing = await getSavedRowsForUserListing(ctx, user._id, listingId);
    if (existing.length > 0) {
      for (const row of existing) {
        await ctx.db.delete(row._id);
      }
      return { saved: false };
    }

    const insertedId = await ctx.db.insert("savedListings", {
      userId: user._id,
      listingId,
    });
    // Defensive dedupe if concurrent toggles inserted duplicates.
    const afterInsert = await getSavedRowsForUserListing(ctx, user._id, listingId);
    const canonical = afterInsert.find((row) => row._id === insertedId) ?? afterInsert[0];
    for (const row of afterInsert) {
      if (row._id !== canonical._id) {
        await ctx.db.delete(row._id);
      }
    }
    return { saved: true };
  },
});

export const giveConsent = mutation({
  args: { listingId: v.id("apartmentListings") },
  handler: async (ctx, { listingId }) => {
    const user = await requireAuthedUser(ctx);

    const existing = await getSavedRowsForUserListing(ctx, user._id, listingId);
    if (existing.length === 0) throw new ConvexError("Listing not saved");
    for (const row of existing) {
      if (row.consentGiven !== true) {
        await ctx.db.patch(row._id, { consentGiven: true });
      }
    }
  },
});

export const getStudentsInterestedInMyListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUserWithRole(ctx, "provider");

    // Get the provider profile for this user
    const providerProfiles = await ctx.db
      .query("providerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    providerProfiles.sort((a, b) => b._creationTime - a._creationTime);
    const providerProfile = providerProfiles[0] ?? null;
    if (!providerProfile) return [];

    // Get all listings owned by this provider
    const myListings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_provider", (q) => q.eq("providerId", providerProfile._id))
      .collect();

    const interestedByListing = await Promise.all(
      myListings.map((listing) =>
        ctx.db
          .query("savedListings")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .collect(),
      ),
    );
    const dedupedInterested = new Map<string, (typeof interestedByListing)[number][number]>();
    for (const row of interestedByListing.flat()) {
      const key = `${row.userId}:${row.listingId}`;
      const existing = dedupedInterested.get(key);
      if (!existing || row._creationTime > existing._creationTime) {
        dedupedInterested.set(key, row);
      }
    }
    const interested = [...dedupedInterested.values()].filter((s) => s.consentGiven === true);

    const results = await Promise.all(
      interested.map(async (s) => {
        const student = await ctx.db.get(s.userId);
        if (!student) return null;

        const listing = myListings.find((l) => l._id === s.listingId);
        const contacts = await getVisibleContactsForViewer(ctx, s.userId, user._id);

        return {
          savedId: s._id,
          student: {
            id: student._id,
            name: student.name,
            email: student.email,
          },
          listing: listing
            ? { id: listing._id, title: listing.title }
            : null,
          contacts,
        };
      }),
    );

    return results.filter(Boolean);
  },
});
