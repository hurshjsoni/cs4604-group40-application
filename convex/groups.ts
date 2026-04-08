import { v, ConvexError } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUserWithRole, stripSensitiveUserFields } from "./lib";
import {
  assertMaxLength,
  assertNonEmpty,
  assertNonNegative,
  assertRangeOrder,
  assertReasonableDate,
  normalizeOptionalTrimmed,
  normalizeTrimmed,
} from "./validation";

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

async function resolveMember(ctx: QueryCtx | MutationCtx, member: Doc<"groupMembers">) {
  const user = await ctx.db.get(member.userId);
  return { ...member, user: stripSensitiveUserFields(user) };
}

async function resolveGroup(ctx: QueryCtx | MutationCtx, group: Doc<"roommateGroups">) {
  const members = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .collect();

  const activeMembers = members.filter((m) => m.status === "active");
  const resolvedMembers = await Promise.all(activeMembers.map((m) => resolveMember(ctx, m)));

  const messages = await ctx.db
    .query("groupMessages")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .collect();
  const latestTextMessage = await ctx.db
    .query("groupMessages")
    .withIndex("by_group_type", (q) =>
      q.eq("groupId", group._id).eq("messageType", "text"),
    )
    .order("desc")
    .first();

  const sharedListings = await ctx.db
    .query("groupSharedListings")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .collect();

  return {
    ...group,
    members: resolvedMembers,
    messageCount: messages.length,
    sharedListingCount: sharedListings.length,
    latestTextMessage: latestTextMessage
      ? {
          id: latestTextMessage._id,
          senderId: latestTextMessage.senderId,
          createdAt: latestTextMessage._creationTime,
        }
      : null,
  };
}

export const getMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser || authedUser.role !== "student") return [];

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", authedUser._id))
      .collect();

    // Canonicalize duplicates by taking the latest row per group, then only keep active memberships.
    const dedupedMembershipsByGroup = new Map<string, (typeof memberships)[number]>();
    for (const membership of memberships) {
      const key = String(membership.groupId);
      const existing = dedupedMembershipsByGroup.get(key);
      if (!existing || membership._creationTime > existing._creationTime) {
        dedupedMembershipsByGroup.set(key, membership);
      }
    }
    const activeMemberships = [...dedupedMembershipsByGroup.values()].filter(
      (membership) => membership.status === "active",
    );

    const groups = await Promise.all(
      activeMemberships.map(async (m) => {
        const group = await ctx.db.get(m.groupId);
        if (!group || group.status === "disbanded") return null;
        return resolveGroup(ctx, group);
      }),
    );

    return groups.filter(Boolean);
  },
});

export const getById = query({
  args: { groupId: v.id("roommateGroups") },
  handler: async (ctx, { groupId }) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser || authedUser.role !== "student") return null;

    const group = await ctx.db.get(groupId);
    if (!group) return null;

    const membership = await getMembershipByGroupAndUser(ctx, groupId, authedUser._id);
    if (!membership || membership.status !== "active") return null;

    return resolveGroup(ctx, group);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    notes: v.optional(v.string()),
    targetBudgetMin: v.optional(v.number()),
    targetBudgetMax: v.optional(v.number()),
    targetMoveIn: v.optional(v.string()),
    targetLocation: v.optional(v.string()),
    inviteUserIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUserWithRole(ctx, "student");
    const userId = authedUser._id;
    assertNonNegative(args.targetBudgetMin, "Group target budget minimum");
    assertNonNegative(args.targetBudgetMax, "Group target budget maximum");
    assertRangeOrder(args.targetBudgetMin, args.targetBudgetMax, "Group target budget minimum", "Group target budget maximum");
    assertReasonableDate(args.targetMoveIn, "Group target move-in date");
    const name = normalizeTrimmed(args.name);
    assertNonEmpty(name, "Group name");
    assertMaxLength(name, "Group name", 120);
    const notes = normalizeOptionalTrimmed(args.notes);
    assertMaxLength(notes, "Group notes", 2000);
    const targetLocation = normalizeOptionalTrimmed(args.targetLocation);
    assertMaxLength(targetLocation, "Group target location", 120);

    const groupId = await ctx.db.insert("roommateGroups", {
      name,
      createdBy: userId,
      status: "searching",
      notes,
      targetBudgetMin: args.targetBudgetMin,
      targetBudgetMax: args.targetBudgetMax,
      targetMoveIn: args.targetMoveIn,
      targetLocation,
    });

    await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      role: "admin",
      joinedAt: Date.now(),
      status: "active",
    });

    await ctx.db.insert("groupMessages", {
      groupId,
      senderId: userId,
      content: "Group created",
      messageType: "system",
    });

    const inviteIds = [...new Set(args.inviteUserIds.filter((id) => id !== userId))];
    for (const invitedId of inviteIds) {
      const invitedUser = await ctx.db.get(invitedId);
      if (!invitedUser) continue;
      if (invitedUser.role !== "student") continue;
      const existing = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", invitedId))
        .collect();
      existing.sort((a, b) => b._creationTime - a._creationTime);
      const latestExisting = existing[0] ?? null;
      if (!latestExisting) {
        await ctx.db.insert("groupMembers", {
          groupId,
          userId: invitedId,
          role: "member",
          joinedAt: Date.now(),
          status: "active",
        });
      }
    }

    return groupId;
  },
});

export const updateSettings = mutation({
  args: {
    groupId: v.id("roommateGroups"),
    name: v.string(),
    notes: v.optional(v.string()),
    targetBudgetMin: v.optional(v.number()),
    targetBudgetMax: v.optional(v.number()),
    targetMoveIn: v.optional(v.string()),
    targetLocation: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("searching"),
        v.literal("found_place"),
        v.literal("confirmed"),
        v.literal("disbanded"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUserWithRole(ctx, "student");
    assertNonNegative(args.targetBudgetMin, "Group target budget minimum");
    assertNonNegative(args.targetBudgetMax, "Group target budget maximum");
    assertRangeOrder(args.targetBudgetMin, args.targetBudgetMax, "Group target budget minimum", "Group target budget maximum");
    assertReasonableDate(args.targetMoveIn, "Group target move-in date");
    const name = normalizeTrimmed(args.name);
    assertNonEmpty(name, "Group name");
    assertMaxLength(name, "Group name", 120);
    const notes = normalizeOptionalTrimmed(args.notes);
    assertMaxLength(notes, "Group notes", 2000);
    const targetLocation = normalizeOptionalTrimmed(args.targetLocation);
    assertMaxLength(targetLocation, "Group target location", 120);

    const membership = await getMembershipByGroupAndUser(ctx, args.groupId, authedUser._id);
    if (!membership || membership.role !== "admin" || membership.status !== "active") {
      throw new ConvexError("Not authorized");
    }

    const updates: Record<string, unknown> = {
      name,
      notes,
      targetBudgetMin: args.targetBudgetMin,
      targetBudgetMax: args.targetBudgetMax,
      targetMoveIn: args.targetMoveIn,
      targetLocation,
    };
    if (args.status !== undefined) updates.status = args.status;
    await ctx.db.patch(args.groupId, updates);
  },
});

export const inviteMembers = mutation({
  args: {
    groupId: v.id("roommateGroups"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUserWithRole(ctx, "student");

    const membership = await getMembershipByGroupAndUser(ctx, args.groupId, authedUser._id);
    if (!membership || membership.status !== "active" || membership.role !== "admin") {
      throw new ConvexError("Admin only");
    }

    const inviteIds = [...new Set(args.userIds.filter((id) => id !== authedUser._id))];
    for (const invitedId of inviteIds) {
      const invitedUser = await ctx.db.get(invitedId);
      if (!invitedUser) continue;
      if (invitedUser.role !== "student") continue;
      const existing = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_user", (q) => q.eq("groupId", args.groupId).eq("userId", invitedId))
        .collect();
      existing.sort((a, b) => b._creationTime - a._creationTime);
      const latestExisting = existing[0] ?? null;
      if (!latestExisting) {
        await ctx.db.insert("groupMembers", {
          groupId: args.groupId,
          userId: invitedId,
          role: "member",
          joinedAt: Date.now(),
          status: "active",
        });
      } else if (latestExisting.status !== "active") {
        await ctx.db.patch(latestExisting._id, { status: "active", joinedAt: Date.now() });
      }
    }
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("roommateGroups") },
  handler: async (ctx, args) => {
    const authedUser = await requireAuthedUserWithRole(ctx, "student");
    const userId = authedUser._id;

    const membership = await getMembershipByGroupAndUser(ctx, args.groupId, userId);
    if (!membership) throw new ConvexError("Not a member");

    await ctx.db.patch(membership._id, { status: "left" });

    await ctx.db.insert("groupMessages", {
      groupId: args.groupId,
      senderId: userId,
      content: `${authedUser.name ?? "A member"} left the group`,
      messageType: "system",
    });

    if (membership.role === "admin") {
      // Ensure group continuity when an admin leaves:
      // promote an active member, otherwise close the group.
      const remaining = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      const nextAdmin = remaining.find((m) => m.status === "active" && m.userId !== userId);
      if (nextAdmin) {
        await ctx.db.patch(nextAdmin._id, { role: "admin" });
      } else {
        await ctx.db.patch(args.groupId, { status: "disbanded" });
      }
    }
  },
});

export const getAcceptedMatchUsers = query({
  args: {},
  handler: async (ctx) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser || authedUser.role !== "student") return [];

    // Outgoing accepted (current user sent the request and it was accepted)
    const outgoing = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", authedUser._id).eq("status", "accepted"),
      )
      .filter((q) => q.eq(q.field("matchType"), "manual"))
      .collect();

    // Incoming accepted (someone sent the request to current user and they accepted)
    const incoming = await ctx.db
      .query("roommateMatches")
      .withIndex("by_matched_user", (q) => q.eq("matchedUserId", authedUser._id))
      .filter((q) =>
        q.and(q.eq(q.field("status"), "accepted"), q.eq(q.field("matchType"), "manual")),
      )
      .collect();

    // Deduplicate by other user id (prefer outgoing record)
    const seenUserIds = new Set<string>();
    const allMatches = [...outgoing, ...incoming];
    const deduped = allMatches.filter((m) => {
      const otherId = m.userId === authedUser._id ? m.matchedUserId : m.userId;
      if (seenUserIds.has(otherId)) return false;
      seenUserIds.add(otherId);
      return true;
    });

    const users = await Promise.all(
      deduped.map(async (m) => {
        const otherId = m.userId === authedUser._id ? m.matchedUserId : m.userId;
        const user = stripSensitiveUserFields(await ctx.db.get(otherId));
        return { matchId: m._id, user, compatibilityScore: m.compatibilityScore };
      }),
    );

    return users.filter((u) => u.user !== null);
  },
});
