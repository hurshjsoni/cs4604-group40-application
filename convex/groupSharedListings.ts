import { v, ConvexError } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUser } from "./lib";

async function resolveSharedListing(
  ctx: QueryCtx | MutationCtx,
  shared: Doc<"groupSharedListings">,
) {
  const listing = await ctx.db.get(shared.listingId);
  const sharedByUser = await ctx.db.get(shared.sharedBy);

  let images: string[] = [];
  if (listing) {
    const imgRecords = await ctx.db
      .query("listingImages")
      .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
      .order("asc")
      .collect();
    images = imgRecords.map((r) => r.url);
  }

  const votes = await ctx.db
    .query("groupListingVotes")
    .withIndex("by_shared_listing", (q) => q.eq("sharedListingId", shared._id))
    .collect();

  return { ...shared, listing: listing ? { ...listing, images } : null, sharedByUser, votes };
}

async function getMembershipByGroupAndUser(
  ctx: QueryCtx | MutationCtx,
  groupId: Doc<"roommateGroups">["_id"],
  userId: Doc<"users">["_id"],
) {
  const rows = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestSharedListingByGroupAndListing(
  ctx: QueryCtx | MutationCtx,
  groupId: Doc<"roommateGroups">["_id"],
  listingId: Doc<"apartmentListings">["_id"],
) {
  const rows = await ctx.db
    .query("groupSharedListings")
    .withIndex("by_group_listing", (q) => q.eq("groupId", groupId).eq("listingId", listingId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestVoteBySharedListingAndUser(
  ctx: QueryCtx | MutationCtx,
  sharedListingId: Doc<"groupSharedListings">["_id"],
  userId: Doc<"users">["_id"],
) {
  const rows = await ctx.db
    .query("groupListingVotes")
    .withIndex("by_shared_listing_user", (q) =>
      q.eq("sharedListingId", sharedListingId).eq("userId", userId),
    )
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

export const getByGroup = query({
  args: { groupId: v.id("roommateGroups") },
  handler: async (ctx, { groupId }) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser) return [];

    const membership = await getMembershipByGroupAndUser(ctx, groupId, authedUser._id);
    if (!membership || membership.status !== "active") return [];

    const shared = await ctx.db
      .query("groupSharedListings")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    return Promise.all(shared.map((s) => resolveSharedListing(ctx, s)));
  },
});

export const share = mutation({
  args: {
    groupId: v.id("roommateGroups"),
    listingId: v.id("apartmentListings"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUser(ctx);

    const membership = await getMembershipByGroupAndUser(ctx, args.groupId, authedUser._id);
    if (!membership || membership.status !== "active") throw new ConvexError("Not a member");

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const existing = await getLatestSharedListingByGroupAndListing(ctx, args.groupId, args.listingId);
    if (existing) throw new ConvexError("This listing is already shared with the group");

    const sharedId = await ctx.db.insert("groupSharedListings", {
      groupId: args.groupId,
      listingId: args.listingId,
      sharedBy: authedUser._id,
      notes: args.notes,
      status: "proposed",
    });

    await ctx.db.insert("groupMessages", {
      groupId: args.groupId,
      senderId: authedUser._id,
      content: `📍 ${authedUser.name ?? "Someone"} shared a listing: ${listing?.title ?? "an apartment"} · $${listing?.rent ?? "?"}/mo`,
      messageType: "system",
    });

    return sharedId;
  },
});

export const vote = mutation({
  args: {
    sharedListingId: v.id("groupSharedListings"),
    vote: v.union(
      v.literal("interested"),
      v.literal("neutral"),
      v.literal("not_interested"),
    ),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUser(ctx);
    const shared = await ctx.db.get(args.sharedListingId);
    if (!shared) throw new ConvexError("Listing not found");

    const membership = await getMembershipByGroupAndUser(ctx, shared.groupId, authedUser._id);
    if (!membership || membership.status !== "active") throw new ConvexError("Not a member");

    const existing = await getLatestVoteBySharedListingAndUser(ctx, args.sharedListingId, authedUser._id);

    if (existing) {
      await ctx.db.patch(existing._id, { vote: args.vote, comment: args.comment });
    } else {
      await ctx.db.insert("groupListingVotes", {
        sharedListingId: args.sharedListingId,
        userId: authedUser._id,
        vote: args.vote,
        comment: args.comment,
      });
    }
  },
});

export const updateStatus = mutation({
  args: {
    sharedListingId: v.id("groupSharedListings"),
    status: v.union(
      v.literal("proposed"),
      v.literal("shortlisted"),
      v.literal("rejected"),
    ),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUser(ctx);

    const shared = await ctx.db.get(args.sharedListingId);
    if (!shared) throw new ConvexError("Not found");

    const membership = await getMembershipByGroupAndUser(ctx, shared.groupId, authedUser._id);
    if (!membership || membership.role !== "admin" || membership.status !== "active") {
      throw new ConvexError("Admin only");
    }

    await ctx.db.patch(args.sharedListingId, { status: args.status });
  },
});
