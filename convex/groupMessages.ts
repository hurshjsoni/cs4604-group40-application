import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUser, stripSensitiveUserFields } from "./lib";
import { assertMaxLength } from "./validation";

type Ctx = QueryCtx | MutationCtx;

async function getMembershipByGroupAndUser(
  ctx: Ctx,
  groupId: Id<"roommateGroups">,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

export const getByGroup = query({
  args: {
    groupId: v.id("roommateGroups"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { groupId, paginationOpts }) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser) return { page: [], isDone: true, continueCursor: "" };

    const membership = await getMembershipByGroupAndUser(ctx, groupId, authedUser._id);
    if (!membership || membership.status !== "active")
      return { page: [], isDone: true, continueCursor: "" };

    // Newest first so `loadMore` fetches older messages
    const result = await ctx.db
      .query("groupMessages")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .paginate(paginationOpts);

    const page = await Promise.all(
      result.page.map(async (msg) => {
        const sender = stripSensitiveUserFields(await ctx.db.get(msg.senderId));
        return { ...msg, sender };
      }),
    );

    return { ...result, page };
  },
});

// Returns the most-recent TEXT message from a single group.
// Simpler per-group query used by the group detail page for notification purposes.
export const getLatestTextMessage = query({
  args: { groupId: v.id("roommateGroups") },
  handler: async (ctx, { groupId }) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser) return null;

    const membership = await getMembershipByGroupAndUser(ctx, groupId, authedUser._id);
    if (!membership || membership.status !== "active") return null;

    const latest = await ctx.db
      .query("groupMessages")
      .withIndex("by_group_type", (q) =>
        q.eq("groupId", groupId).eq("messageType", "text"),
      )
      .order("desc")
      .first();
    if (!latest) return null;

    const sender = stripSensitiveUserFields(await ctx.db.get(latest.senderId));
    return {
      id: latest._id,
      groupId: latest.groupId,
      content: latest.content,
      senderName: sender?.name ?? "Someone",
    };
  },
});

export const send = mutation({
  args: {
    groupId: v.id("roommateGroups"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUser(ctx);
    const content = args.content.trim();
    if (!content) throw new ConvexError("Message cannot be empty");
    assertMaxLength(content, "Message", 2000);

    const membership = await getMembershipByGroupAndUser(ctx, args.groupId, authedUser._id);
    if (!membership || membership.status !== "active") throw new ConvexError("Not a member");

    return ctx.db.insert("groupMessages", {
      groupId: args.groupId,
      senderId: authedUser._id,
      content,
      messageType: "text",
    });
  },
});
