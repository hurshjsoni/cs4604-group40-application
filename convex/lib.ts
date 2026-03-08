import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/**
 * Shared auth helper used across all Convex modules.
 * Returns the authenticated user document, or null if not signed in.
 */
export async function getAuthedUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const usersByToken = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .collect();
  const users =
    usersByToken.length > 0
      ? usersByToken
      : identity.subject
      ? await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
          .collect()
      : [];
  if (users.length === 0) return null;
  // Defensive fallback: if duplicate token rows exist, prefer oldest canonical row.
  users.sort((a, b) => a._creationTime - b._creationTime);
  return users[0];
}

/**
 * Like getAuthedUser but throws ConvexError if unauthenticated.
 * Use in mutations that always require auth.
 */
export async function requireAuthedUser(ctx: Ctx) {
  const user = await getAuthedUser(ctx);
  if (!user) throw new ConvexError("Not authenticated");
  return user;
}

/**
 * Require that the current user has the expected role.
 */
export async function requireAuthedUserWithRole(
  ctx: Ctx,
  role: "student" | "provider" | "admin",
) {
  const user = await requireAuthedUser(ctx);
  if (user.role !== role) {
    throw new ConvexError("Not authorized");
  }
  return user;
}

export async function assertUserEmailAvailable(
  ctx: Ctx,
  email: string,
  currentUserId?: string,
) {
  const matches = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();

  const conflict = matches.find((u) => u._id !== currentUserId);
  if (conflict) {
    throw new ConvexError("Email is already in use");
  }
}

async function getLatestSettingsByUser(
  ctx: Ctx,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

/**
 * Shared contact-privacy policy:
 * - owners can always see all of their contacts
 * - non-owners can only see public contacts when target user enabled showContactInfo
 */
export async function getVisibleContactsForViewer(
  ctx: Ctx,
  targetUserId: Id<"users">,
  viewerUserId?: Id<"users"> | null,
) {
  const contacts = await ctx.db
    .query("contactInfo")
    .withIndex("by_user", (q) => q.eq("userId", targetUserId))
    .collect();

  if (viewerUserId && viewerUserId === targetUserId) {
    return contacts;
  }

  const settings = await getLatestSettingsByUser(ctx, targetUserId);
  if (!settings?.showContactInfo) return [];
  return contacts.filter((contact) => contact.isPublic);
}

/**
 * Remove sensitive internal auth linkage fields before returning user docs
 * to clients.
 */
export function stripSensitiveUserFields<T extends { tokenIdentifier?: string } | null>(
  user: T,
): Omit<NonNullable<T>, "tokenIdentifier"> | null {
  if (!user) return null;
  const safeUser = { ...user };
  delete (safeUser as { tokenIdentifier?: string }).tokenIdentifier;
  return safeUser;
}
