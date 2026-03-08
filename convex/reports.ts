import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthedUser, requireAuthedUser } from "./lib";
import { assertMaxLength, assertNonEmpty, normalizeOptionalTrimmed, normalizeTrimmed } from "./validation";

function encodeReportTargetId(targetType: "listing" | "user", normalizedId: string) {
  return `${targetType}:${normalizedId}`;
}

function parseReportTargetId(targetType: "listing" | "user", targetId: string) {
  const trimmed = targetId.trim();
  if (!trimmed) return null;
  // Backward compatibility: accept raw IDs from existing UI callers.
  if (!trimmed.includes(":")) return trimmed;
  const [prefix, raw] = trimmed.split(":", 2);
  if (raw === undefined) return null;
  if (prefix !== targetType || !raw) return null;
  return raw;
}

export const create = mutation({
  args: {
    targetType: v.union(v.literal("listing"), v.literal("user")),
    targetId: v.string(),
    reason: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { targetType, targetId, reason, description }) => {
    const user = await requireAuthedUser(ctx);
    const normalizedReason = normalizeTrimmed(reason);
    const normalizedDescription = normalizeOptionalTrimmed(description);
    assertNonEmpty(normalizedReason, "Report reason");
    assertMaxLength(normalizedReason, "Report reason", 240);
    assertMaxLength(normalizedDescription, "Report description", 3000);

    const parsedTargetId = parseReportTargetId(targetType, targetId);
    if (!parsedTargetId) throw new ConvexError("Invalid report target");
    const normalizedTargetId =
      targetType === "listing"
        ? await ctx.db.normalizeId("apartmentListings", parsedTargetId)
        : await ctx.db.normalizeId("users", parsedTargetId);
    if (!normalizedTargetId) throw new ConvexError("Invalid report target");
    if (targetType === "user" && normalizedTargetId === user._id) {
      throw new ConvexError("You cannot report yourself");
    }

    return await ctx.db.insert("reports", {
      reporterId: user._id,
      targetType,
      targetId: encodeReportTargetId(targetType, normalizedTargetId),
      reason: normalizedReason,
      description: normalizedDescription,
      status: "pending",
    });
  },
});

export const getMyReports = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", user._id))
      .collect();
  },
});

export const listByStatus = internalQuery({
  args: {
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
  },
  handler: async (ctx, { status }) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

export const updateStatus = internalMutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("reviewed"), v.literal("resolved")),
  },
  handler: async (ctx, { reportId, status }) => {
    const report = await ctx.db.get(reportId);
    if (!report) throw new ConvexError("Report not found");

    await ctx.db.patch(reportId, { status });
  },
});
