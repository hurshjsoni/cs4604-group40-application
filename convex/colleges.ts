import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("colleges").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("colleges")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

export const getById = query({
  args: { collegeId: v.id("colleges") },
  handler: async (ctx, { collegeId }) => {
    return await ctx.db.get(collegeId);
  },
});

const COLLEGE_DATA = [
  { slug: "vt", name: "Virginia Tech", shortName: "VT", location: "Blacksburg, VA" },
  { slug: "uva", name: "University of Virginia", shortName: "UVA", location: "Charlottesville, VA" },
  { slug: "gmu", name: "George Mason University", shortName: "GMU", location: "Fairfax, VA" },
  { slug: "vcu", name: "Virginia Commonwealth University", shortName: "VCU", location: "Richmond, VA" },
  { slug: "jmu", name: "James Madison University", shortName: "JMU", location: "Harrisonburg, VA" },
  { slug: "wm", name: "William & Mary", shortName: "W&M", location: "Williamsburg, VA" },
] as const;

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("colleges").collect();
    if (existing.length > 0) return { inserted: 0, message: "Colleges already seeded" };

    for (const college of COLLEGE_DATA) {
      await ctx.db.insert("colleges", { ...college });
    }

    return { inserted: COLLEGE_DATA.length, message: "Colleges seeded successfully" };
  },
});

export const seedInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("colleges").collect();
    if (existing.length > 0) return;

    for (const college of COLLEGE_DATA) {
      await ctx.db.insert("colleges", { ...college });
    }
  },
});
