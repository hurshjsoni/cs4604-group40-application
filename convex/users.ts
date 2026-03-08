import { query, mutation, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthedUser, stripSensitiveUserFields } from "./lib";
import { components } from "./_generated/api";
import {
  assertMaxLength,
  assertNonEmpty,
  normalizeEmail,
  normalizeTrimmed,
} from "./validation";

const DEFAULT_SETTINGS = {
  showInBrowse: false,
  showContactInfo: false,
  emailNotifications: true,
  matchNotifications: true,
  messageNotifications: true,
  theme: "system" as const,
};

async function getUsersByTokenIdentifier(
  ctx: MutationCtx,
  tokenIdentifier: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .collect();
}

async function getUsersByEmail(
  ctx: MutationCtx,
  email: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
}

async function ensureUserSettingsRow(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) {
    await ctx.db.insert("userSettings", { userId, ...DEFAULT_SETTINGS });
    return;
  }
  rows.sort((a, b) => b._creationTime - a._creationTime);
  for (const duplicate of rows.slice(1)) {
    await ctx.db.delete(duplicate._id);
  }
}

async function hasDependentRows(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const [
    settings,
    studentProfile,
    providerProfile,
    roommateProfile,
    contacts,
    photos,
    savedListings,
    groupMembership,
    groupMessage,
    sharedListing,
    vote,
    report,
    createdGroup,
    outgoingMatch,
    incomingMatch,
  ] = await Promise.all([
    ctx.db.query("userSettings").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("providerProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("roommateProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("contactInfo").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("userPhotos").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("savedListings").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("groupMembers").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("groupMessages").withIndex("by_sender", (q) => q.eq("senderId", userId)).first(),
    ctx.db.query("groupSharedListings").withIndex("by_shared_by", (q) => q.eq("sharedBy", userId)).first(),
    ctx.db.query("groupListingVotes").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("reports").withIndex("by_reporter", (q) => q.eq("reporterId", userId)).first(),
    ctx.db.query("roommateGroups").withIndex("by_creator", (q) => q.eq("createdBy", userId)).first(),
    ctx.db.query("roommateMatches").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("roommateMatches").withIndex("by_matched_user", (q) => q.eq("matchedUserId", userId)).first(),
  ]);

  return !!(
    settings ||
    studentProfile ||
    providerProfile ||
    roommateProfile ||
    contacts ||
    photos ||
    savedListings ||
    groupMembership ||
    groupMessage ||
    sharedListing ||
    vote ||
    report ||
    createdGroup ||
    outgoingMatch ||
    incomingMatch
  );
}

async function deleteDuplicateUserIfIsolated(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  if (await hasDependentRows(ctx, userId)) return false;
  await ctx.db.delete(userId);
  return true;
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    return stripSensitiveUserFields(user);
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const authedUser = await getAuthedUser(ctx);
    if (!authedUser || authedUser._id !== userId) return null;
    const user = await ctx.db.get(userId);
    return stripSensitiveUserFields(user);
  },
});

export const createOrGetUser = mutation({
  args: {
    // name/email are optional - fall back to JWT claims when omitted
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("student"), v.literal("provider")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const tokenUsers = await getUsersByTokenIdentifier(ctx, identity.tokenIdentifier);
    const subjectUsers =
      tokenUsers.length === 0 && identity.subject
        ? await getUsersByTokenIdentifier(ctx, identity.subject)
        : [];
    const allCandidates = [...tokenUsers, ...subjectUsers];
    const deduped = allCandidates.filter(
      (user, idx) => allCandidates.findIndex((row) => row._id === user._id) === idx,
    );
    deduped.sort((a, b) => a._creationTime - b._creationTime);
    const existing = deduped[0] ?? null;

    if (existing) {
      // Preserve the role for existing accounts.
      // Role changes are restricted to trusted/internal pathways.
      if (existing.tokenIdentifier !== identity.tokenIdentifier) {
        await ctx.db.patch(existing._id, { tokenIdentifier: identity.tokenIdentifier });
      }
      for (const duplicate of deduped.slice(1)) {
        await deleteDuplicateUserIfIsolated(ctx, duplicate._id);
      }
      await ensureUserSettingsRow(ctx, existing._id);
      return existing._id;
    }

    // Prefer explicit args, fall back to JWT claims
    const name = normalizeTrimmed(args.name ?? (identity.name as string | undefined) ?? "User");
    const email = normalizeEmail(args.email || (identity.email as string | undefined) || "");
    assertNonEmpty(name, "Name");
    assertMaxLength(name, "Name", 120);
    assertNonEmpty(email, "Email");
    assertMaxLength(email, "Email", 254);
    const role = args.role;
    const isVerified = email.endsWith(".edu");

    // Resolve concurrent sign-ins for the same real user by reusing existing
    // records keyed by normalized email.
    const existingByEmail = await getUsersByEmail(ctx, email);
    if (existingByEmail.length > 0) {
      existingByEmail.sort((a, b) => a._creationTime - b._creationTime);
      const canonical = existingByEmail[0];
      const patch: Record<string, unknown> = {};
      if (canonical.tokenIdentifier !== identity.tokenIdentifier) {
        patch.tokenIdentifier = identity.tokenIdentifier;
      }
      if (canonical.name !== name) {
        patch.name = name;
      }
      if (canonical.avatarUrl !== (identity.pictureUrl ?? undefined)) {
        patch.avatarUrl = identity.pictureUrl ?? undefined;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(canonical._id, patch);
      }
      for (const duplicate of existingByEmail.slice(1)) {
        await deleteDuplicateUserIfIsolated(ctx, duplicate._id);
      }
      await ensureUserSettingsRow(ctx, canonical._id);
      return canonical._id;
    }

    await ctx.db.insert("users", {
      email,
      name,
      role,
      isVerified,
      avatarUrl: identity.pictureUrl ?? undefined,
      onboardingComplete: false,
      tokenIdentifier: identity.tokenIdentifier,
    });

    // Best-effort idempotency under concurrent sign-ins:
    // converge duplicate rows by token/email to one canonical user.
    const byToken = await getUsersByTokenIdentifier(ctx, identity.tokenIdentifier);
    const byEmail = await getUsersByEmail(ctx, email);
    const candidates = [...byToken, ...byEmail];
    const dedupedCandidates = candidates.filter(
      (row, idx) => candidates.findIndex((candidate) => candidate._id === row._id) === idx,
    );
    dedupedCandidates.sort((a, b) => a._creationTime - b._creationTime);
    const canonical = dedupedCandidates[0] ?? null;
    if (!canonical) throw new ConvexError("Failed to create user");

    for (const duplicate of dedupedCandidates) {
      if (duplicate._id === canonical._id) continue;
      await deleteDuplicateUserIfIsolated(ctx, duplicate._id);
    }

    await ensureUserSettingsRow(ctx, canonical._id);

    return canonical._id;
  },
});

export const updateUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new ConvexError("User not found");

    const updates: Record<string, unknown> = {};
    let updatedName: string | undefined;
    let updatedEmail: string | undefined;
    if (args.name !== undefined) {
      const name = normalizeTrimmed(args.name);
      assertNonEmpty(name, "Name");
      assertMaxLength(name, "Name", 120);
      if (name !== user.name) {
        updates.name = name;
        updatedName = name;
      }
    }
    if (args.email !== undefined) {
      const normalizedEmail = normalizeEmail(args.email);
      assertNonEmpty(normalizedEmail, "Email");
      assertMaxLength(normalizedEmail, "Email", 254);
      if (normalizedEmail !== user.email) {
        const matches = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .collect();
        const conflict = matches.find(
          (candidate) =>
            candidate._id !== user._id &&
            candidate.tokenIdentifier !== user.tokenIdentifier,
        );
        if (conflict) {
          throw new ConvexError("Email is already in use");
        }
        updates.email = normalizedEmail;
        updates.isVerified = normalizedEmail.endsWith(".edu");
        updatedEmail = normalizedEmail;
      }
    }
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(user._id, updates);
    }

    // Keep Better Auth and app-layer user records in sync to avoid identity drift.
    if (updatedName !== undefined || updatedEmail !== undefined) {
      let authUser: { _id: string } | null = null;
      try {
        authUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [{ field: "_id", value: user.tokenIdentifier }],
        })) as { _id: string } | null;
      } catch {
        authUser = null;
      }

      // Seed/demo accounts may not have a backing Better Auth user row.
      if (authUser?._id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await ctx.runMutation(components.betterAuth.adapter.updateOne as any, {
            input: {
              model: "user",
              where: [{ field: "_id", value: user.tokenIdentifier }],
              update: {
                ...(updatedName !== undefined ? { name: updatedName } : {}),
                ...(updatedEmail !== undefined ? { email: updatedEmail } : {}),
              },
            },
          });
        } catch {
          // Keep app-level profile updates successful even if auth sync fails.
        }
      }
    }

    return user._id;
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) throw new ConvexError("User not found");

    await ctx.db.patch(user._id, { onboardingComplete: true });
  },
});
