import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthedUser, requireAuthedUser } from "./lib";

const DEFAULTS = {
  showInBrowse: false,
  showContactInfo: false,
  emailNotifications: true,
  matchNotifications: true,
  messageNotifications: true,
  theme: "system" as const,
};

type Ctx = QueryCtx | MutationCtx;

async function getLatestSettingsForUser(
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

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return null;

    const settings = await getLatestSettingsForUser(ctx, user._id);

    if (!settings) {
      return { userId: user._id, ...DEFAULTS };
    }

    return settings;
  },
});

export const upsert = mutation({
  args: {
    showInBrowse: v.optional(v.boolean()),
    showContactInfo: v.optional(v.boolean()),
    emailNotifications: v.optional(v.boolean()),
    matchNotifications: v.optional(v.boolean()),
    messageNotifications: v.optional(v.boolean()),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);

    const rows = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const existing = rows[0] ?? null;
    for (const duplicate of rows.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (args.showInBrowse !== undefined) updates.showInBrowse = args.showInBrowse;
      if (args.showContactInfo !== undefined) updates.showContactInfo = args.showContactInfo;
      if (args.emailNotifications !== undefined) updates.emailNotifications = args.emailNotifications;
      if (args.matchNotifications !== undefined) updates.matchNotifications = args.matchNotifications;
      if (args.messageNotifications !== undefined) updates.messageNotifications = args.messageNotifications;
      if (args.theme !== undefined) updates.theme = args.theme;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    }

    const insertedId = await ctx.db.insert("userSettings", {
      userId: user._id,
      showInBrowse: args.showInBrowse ?? DEFAULTS.showInBrowse,
      showContactInfo: args.showContactInfo ?? DEFAULTS.showContactInfo,
      emailNotifications: args.emailNotifications ?? DEFAULTS.emailNotifications,
      matchNotifications: args.matchNotifications ?? DEFAULTS.matchNotifications,
      messageNotifications: args.messageNotifications ?? DEFAULTS.messageNotifications,
      theme: args.theme ?? DEFAULTS.theme,
    });
    const afterInsert = await ctx.db
      .query("userSettings")
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
