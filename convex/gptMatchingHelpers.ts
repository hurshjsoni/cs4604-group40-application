import { internalQuery, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getAuthedUser } from "./lib";

type Ctx = QueryCtx | MutationCtx;

async function getLatestRoommateProfileByUser(
  ctx: Ctx,
  userId: Doc<"users">["_id"],
) {
  const rows = await ctx.db
    .query("roommateProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

function buildProfileContext(profile: Doc<"roommateProfiles"> | null) {
  if (!profile) return null;
  return {
    collegeId: profile.collegeId ?? null,
    budgetMin: profile.budgetMin ?? null,
    budgetMax: profile.budgetMax ?? null,
    preferredLocations: profile.preferredLocations ?? [],
    moveInDate: profile.moveInDate ?? null,
    moveInFlexibility: profile.moveInFlexibility ?? null,
    leaseDuration: profile.leaseDuration ?? null,
    lifestyle: profile.lifestyle ?? {},
    dealBreakers: profile.dealBreakers ?? [],
    lookingFor: profile.lookingFor ?? null,
    gender: profile.gender ?? null,
    genderPreference: profile.genderPreference ?? null,
    aboutMeTags: profile.aboutMeTags ?? [],
    roommatePreferences: profile.roommatePreferences ?? [],
  };
}

export const getMatchData = internalQuery({
  args: { matchId: v.id("roommateMatches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return null;

    const profile1 = await getLatestRoommateProfileByUser(ctx, match.userId);
    const profile2 = await getLatestRoommateProfileByUser(ctx, match.matchedUserId);

    const user1 = await ctx.db.get(match.userId);
    const user2 = await ctx.db.get(match.matchedUserId);

    return {
      ...match,
      profile1: buildProfileContext(profile1),
      profile2: buildProfileContext(profile2),
      profile1Summary: {
        name: user1?.name,
        budget: `$${profile1?.budgetMin ?? "?"}-$${profile1?.budgetMax ?? "?"}/mo`,
        cleanliness: profile1?.lifestyle?.cleanliness,
        socialLevel: profile1?.lifestyle?.socialLevel,
        smoking: profile1?.lifestyle?.smoking,
        sleepSchedule: profile1?.lifestyle?.sleepSchedule,
      },
      profile2Summary: {
        name: user2?.name,
        budget: `$${profile2?.budgetMin ?? "?"}-$${profile2?.budgetMax ?? "?"}/mo`,
        cleanliness: profile2?.lifestyle?.cleanliness,
        socialLevel: profile2?.lifestyle?.socialLevel,
        smoking: profile2?.lifestyle?.smoking,
        sleepSchedule: profile2?.lifestyle?.sleepSchedule,
      },
    };
  },
});

export const saveInsight = internalMutation({
  args: {
    matchId: v.id("roommateMatches"),
    aiInsight: v.string(),
  },
  handler: async (ctx, { matchId, aiInsight }) => {
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");

    await ctx.db.patch(matchId, {
      matchBreakdown: {
        ...match.matchBreakdown,
        aiInsight,
      },
    });
  },
});

export const applyAiAdjustment = internalMutation({
  args: {
    matchId: v.id("roommateMatches"),
    aiInsight: v.string(),
    adjustment: v.number(),
  },
  handler: async (ctx, { matchId, aiInsight, adjustment }) => {
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");

    const boundedAdjustment = Math.max(-20, Math.min(20, Math.round(adjustment)));
    const updatedScore = Math.max(0, Math.min(100, match.compatibilityScore + boundedAdjustment));

    await ctx.db.patch(matchId, {
      compatibilityScore: updatedScore,
      matchBreakdown: {
        ...match.matchBreakdown,
        aiInsight,
      },
    });
  },
});

export const getMatchesForCurrentUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
