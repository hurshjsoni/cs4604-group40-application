import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthedUser, getVisibleContactsForViewer, requireAuthedUser } from "./lib";
import { assertMaxLength } from "./validation";
import { contactTypeValidator } from "./domain";

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await getAuthedUser(ctx);
    return await getVisibleContactsForViewer(ctx, userId, viewer?._id);
  },
});

export const set = mutation({
  args: {
    contacts: v.array(
      v.object({
        type: contactTypeValidator,
        value: v.string(),
        customLabel: v.optional(v.string()),
        isPublic: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { contacts }) => {
    const user = await requireAuthedUser(ctx);
    const normalized = contacts
      .map((contact) => ({
        ...contact,
        value: contact.value.trim(),
        customLabel: contact.customLabel?.trim() || undefined,
      }))
      .filter((contact) => contact.value.length > 0);
    if (normalized.length !== contacts.length) {
      throw new ConvexError("Contact values cannot be empty");
    }
    const deduped = normalized.filter(
      (contact, index, list) =>
        list.findIndex(
          (c) => c.type === contact.type && c.value.toLowerCase() === contact.value.toLowerCase(),
        ) === index,
    );
    for (const contact of deduped) {
      assertMaxLength(contact.value, "Contact value", 160);
      assertMaxLength(contact.customLabel, "Contact label", 60);
    }

    // Delete existing contacts
    const existing = await ctx.db
      .query("contactInfo")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const contact of existing) {
      await ctx.db.delete(contact._id);
    }

    // Insert new contacts
    for (const contact of deduped) {
      await ctx.db.insert("contactInfo", {
        userId: user._id,
        type: contact.type,
        value: contact.value,
        customLabel: contact.customLabel,
        isPublic: contact.isPublic,
      });
    }
  },
});

export const remove = mutation({
  args: { contactId: v.id("contactInfo") },
  handler: async (ctx, { contactId }) => {
    const user = await requireAuthedUser(ctx);

    const contact = await ctx.db.get(contactId);
    if (!contact) throw new ConvexError("Contact not found");
    if (contact.userId !== user._id) throw new ConvexError("Not authorized");

    await ctx.db.delete(contactId);
  },
});
