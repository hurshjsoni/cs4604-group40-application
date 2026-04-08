import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import {
  getAuthedUser,
  getVisibleContactsForViewer,
  requireAuthedUserWithRole,
  stripSensitiveUserFields,
} from "./lib";

type RoommateProfile = Doc<"roommateProfiles">;
type Lifestyle = RoommateProfile["lifestyle"];
type Ctx = QueryCtx | MutationCtx;
type RoommateMatchDoc = Doc<"roommateMatches">;

function normalizeSmartStatus<T extends RoommateMatchDoc>(match: T): T {
  if (match.matchType === "smart" && match.status === "pending") {
    return { ...match, status: "suggested" } as T;
  }
  return match;
}

function dedupeLatestByOtherUser<T extends RoommateMatchDoc>(
  matches: T[],
  getOtherUserId: (match: T) => Doc<"users">["_id"],
): T[] {
  const sorted = [...matches].sort((a, b) => b._creationTime - a._creationTime);
  const seen = new Set<Doc<"users">["_id"]>();
  const deduped: T[] = [];
  for (const match of sorted) {
    const otherUserId = getOtherUserId(match);
    if (seen.has(otherUserId)) continue;
    seen.add(otherUserId);
    deduped.push(match);
  }
  return deduped;
}

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

// ---------------------------------------------------
// Matching algorithm - ported from lib/matching.ts
// ---------------------------------------------------

function calcBudget(p1: RoommateProfile, p2: RoommateProfile): number {
  const hasBudget1 = p1.budgetMin !== undefined || p1.budgetMax !== undefined;
  const hasBudget2 = p2.budgetMin !== undefined || p2.budgetMax !== undefined;
  if (!hasBudget1 || !hasBudget2) return 60;
  const min1 = p1.budgetMin ?? 0;
  const max1 = p1.budgetMax ?? 3000;
  const min2 = p2.budgetMin ?? 0;
  const max2 = p2.budgetMax ?? 3000;
  const overlap = Math.min(max1, max2) - Math.max(min1, min2);
  const maxRange = Math.max(max1 - min1, max2 - min2, 1);
  return Math.max(0, Math.min(100, (overlap / maxRange) * 100));
}

function calcSchedule(l1: Lifestyle, l2: Lifestyle): number {
  const signals: number[] = [];
  if (l1.sleepSchedule !== undefined && l2.sleepSchedule !== undefined) {
    signals.push(l1.sleepSchedule === l2.sleepSchedule ? 100 : 45);
  }
  if (l1.wakeUpTime !== undefined && l2.wakeUpTime !== undefined) {
    signals.push(l1.wakeUpTime === l2.wakeUpTime ? 100 : 70);
  }
  if (l1.bedTime !== undefined && l2.bedTime !== undefined) {
    signals.push(l1.bedTime === l2.bedTime ? 100 : 70);
  }
  if (signals.length === 0) return 60;
  return Math.round(signals.reduce((sum, value) => sum + value, 0) / signals.length);
}

function calcCleanliness(l1: Lifestyle, l2: Lifestyle): number {
  const levels: Record<string, number> = { very_clean: 4, clean: 3, moderate: 2, relaxed: 1 };
  if (!l1.cleanliness || !l2.cleanliness) return 60;
  const v1 = l1.cleanliness ? levels[l1.cleanliness] ?? 2 : 2;
  const v2 = l2.cleanliness ? levels[l2.cleanliness] ?? 2 : 2;
  const diff = Math.abs(v1 - v2);
  return Math.max(0, 100 - diff * 25);
}

function calcSocial(l1: Lifestyle, l2: Lifestyle): number {
  const levels: Record<string, number> = { introvert: 1, ambivert: 2, extrovert: 3 };
  if (!l1.socialLevel || !l2.socialLevel) return 60;
  const v1 = l1.socialLevel ? levels[l1.socialLevel] ?? 2 : 2;
  const v2 = l2.socialLevel ? levels[l2.socialLevel] ?? 2 : 2;
  const diff = Math.abs(v1 - v2);
  return Math.max(0, 100 - diff * 20);
}

function calcLifestyle(l1: Lifestyle, l2: Lifestyle): number {
  const signals: number[] = [];
  if (l1.smoking !== undefined && l2.smoking !== undefined) {
    signals.push(l1.smoking === l2.smoking ? 100 : 45);
  }
  if (l1.pets !== undefined && l2.pets !== undefined) {
    signals.push(l1.pets === l2.pets ? 100 : 70);
  }
  if (l1.noiseLevel !== undefined && l2.noiseLevel !== undefined) {
    signals.push(l1.noiseLevel === l2.noiseLevel ? 100 : 75);
  }
  if (signals.length === 0) return 60;
  return Math.round(signals.reduce((sum, value) => sum + value, 0) / signals.length);
}

function calcLocation(p1: RoommateProfile, p2: RoommateProfile): number {
  if (p1.preferredLocations.length === 0 || p2.preferredLocations.length === 0) return 60;
  const overlap = p1.preferredLocations.filter((l) => p2.preferredLocations.includes(l));
  return (overlap.length / Math.max(p1.preferredLocations.length, p2.preferredLocations.length)) * 100;
}

function normalizeTokens(values: string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function calcPreferenceAlignment(p1: RoommateProfile, p2: RoommateProfile): number {
  const p1Prefs = normalizeTokens(p1.roommatePreferences);
  const p2Prefs = normalizeTokens(p2.roommatePreferences);
  if (p1Prefs.length === 0 && p2Prefs.length === 0) return 60;

  const p1Traits = new Set(normalizeTokens(p1.aboutMeTags));
  const p2Traits = new Set(normalizeTokens(p2.aboutMeTags));

  const p1Hit = p1Prefs.filter((pref) => p2Traits.has(pref)).length;
  const p2Hit = p2Prefs.filter((pref) => p1Traits.has(pref)).length;
  const totalPrefs = p1Prefs.length + p2Prefs.length;
  if (totalPrefs === 0) return 60;
  return Math.round((p1Hit + p2Hit) / totalPrefs * 100);
}

function calcDealBreakerPenalty(p1: RoommateProfile, p2: RoommateProfile): number {
  const p1Breakers = normalizeTokens(p1.dealBreakers);
  const p2Breakers = normalizeTokens(p2.dealBreakers);
  const p1Traits = new Set(normalizeTokens(p1.aboutMeTags));
  const p2Traits = new Set(normalizeTokens(p2.aboutMeTags));
  let penalty = 0;

  for (const breaker of p1Breakers) {
    if (p2Traits.has(breaker)) penalty += 15;
  }
  for (const breaker of p2Breakers) {
    if (p1Traits.has(breaker)) penalty += 15;
  }
  return Math.min(40, penalty);
}

function acceptsGender(
  preference: RoommateProfile["genderPreference"],
  selfGender: RoommateProfile["gender"],
  otherGender: RoommateProfile["gender"],
): boolean {
  if (!preference || preference === "no_preference" || preference === "any_gender") return true;
  if (preference === "same_gender") {
    if (!selfGender || !otherGender) return true;
    return selfGender === otherGender;
  }
  if (preference === "male" || preference === "female") {
    if (!otherGender) return true;
    return otherGender === preference;
  }
  return true;
}

function isMutuallyGenderCompatible(p1: RoommateProfile, p2: RoommateProfile): boolean {
  return (
    acceptsGender(p1.genderPreference, p1.gender, p2.gender) &&
    acceptsGender(p2.genderPreference, p2.gender, p1.gender)
  );
}

function computeBreakdown(p1: RoommateProfile, p2: RoommateProfile) {
  const budgetScore = calcBudget(p1, p2);
  const scheduleScore = calcSchedule(p1.lifestyle, p2.lifestyle);
  const cleanlinessScore = calcCleanliness(p1.lifestyle, p2.lifestyle);
  const socialScore = calcSocial(p1.lifestyle, p2.lifestyle);
  const lifestyleScore = calcLifestyle(p1.lifestyle, p2.lifestyle);
  const locationScore = calcLocation(p1, p2);
  const preferenceScore = calcPreferenceAlignment(p1, p2);
  const dealBreakerPenalty = calcDealBreakerPenalty(p1, p2);

  const matchedCriteria: string[] = [];
  const potentialConflicts: string[] = [];

  if (budgetScore >= 80) matchedCriteria.push("Budget Range");
  if (p1.lifestyle.sleepSchedule === p2.lifestyle.sleepSchedule) {
    matchedCriteria.push("Sleep Schedule");
  } else if (scheduleScore < 60) {
    potentialConflicts.push("Different sleep schedules");
  }
  if (cleanlinessScore >= 90) matchedCriteria.push("Cleanliness");
  else if (cleanlinessScore < 60) potentialConflicts.push("Different cleanliness expectations");
  if (p1.lifestyle.smoking === "never" && p2.lifestyle.smoking === "never") {
    matchedCriteria.push("No Smoking");
  }
  if (preferenceScore >= 70) matchedCriteria.push("Roommate Preferences");
  if (dealBreakerPenalty >= 15) potentialConflicts.push("Potential deal-breaker overlap");

  const weighted =
    budgetScore * 0.20 +
    scheduleScore * 0.16 +
    cleanlinessScore * 0.16 +
    socialScore * 0.14 +
    lifestyleScore * 0.14 +
    locationScore * 0.10 +
    preferenceScore * 0.10;
  const avg = Math.max(0, weighted - dealBreakerPenalty);
  let aiInsight: string;
  if (avg >= 85) {
    aiInsight = `Excellent match! Strong compatibility across ${matchedCriteria.length} key criteria.`;
  } else if (avg >= 70) {
    aiInsight = `Good potential match with ${matchedCriteria.length} aligned criteria.`;
  } else if (avg >= 55) {
    aiInsight = `Moderate compatibility. ${potentialConflicts.length} areas to discuss.`;
  } else {
    aiInsight = `Lower compatibility suggests different lifestyle preferences.`;
  }

  return {
    compatibilityScore: Math.round(avg),
    matchBreakdown: {
      budgetScore,
      scheduleScore,
      cleanlinessScore,
      socialScore,
      lifestyleScore,
      locationScore,
      matchedCriteria,
      potentialConflicts,
      aiInsight,
    },
  };
}

async function resolveVisibleContacts(
  ctx: QueryCtx,
  viewerId: Doc<"users">["_id"],
  targetUserId: Doc<"users">["_id"],
) {
  return await getVisibleContactsForViewer(ctx, targetUserId, viewerId);
}

async function getManualMatchesBetween(
  ctx: Ctx,
  userId: Doc<"users">["_id"],
  matchedUserId: Doc<"users">["_id"],
) {
  const rows = await ctx.db
    .query("roommateMatches")
    .withIndex("by_user_and_matched", (q) =>
      q.eq("userId", userId).eq("matchedUserId", matchedUserId),
    )
    .collect();
  return rows
    .filter((row) => row.matchType === "manual")
    .sort((a, b) => b._creationTime - a._creationTime);
}

async function getLatestEffectiveMatchBetweenUsers(
  ctx: Ctx,
  userId: Doc<"users">["_id"],
  otherUserId: Doc<"users">["_id"],
) {
  const [forward, reverse] = await Promise.all([
    ctx.db
      .query("roommateMatches")
      .withIndex("by_user_and_matched", (q) =>
        q.eq("userId", userId).eq("matchedUserId", otherUserId),
      )
      .collect(),
    ctx.db
      .query("roommateMatches")
      .withIndex("by_user_and_matched", (q) =>
        q.eq("userId", otherUserId).eq("matchedUserId", userId),
      )
      .collect(),
  ]);

  const allMatches = [...forward, ...reverse].map(normalizeSmartStatus);
  if (allMatches.length === 0) return null;

  const manualMatches = allMatches
    .filter((match) => match.matchType === "manual")
    .sort((a, b) => b._creationTime - a._creationTime);
  if (manualMatches.length > 0) return manualMatches[0];

  const smartMatches = allMatches
    .filter((match) => match.matchType === "smart")
    .sort((a, b) => b._creationTime - a._creationTime);
  return smartMatches[0] ?? null;
}

function getManualRelationshipUserIds(
  outgoing: RoommateMatchDoc[],
  incoming: RoommateMatchDoc[],
): Set<Doc<"users">["_id"]> {
  return new Set<Doc<"users">["_id"]>([
    ...outgoing.filter((m) => m.matchType === "manual").map((m) => m.matchedUserId),
    ...incoming.filter((m) => m.matchType === "manual").map((m) => m.userId),
  ]);
}

async function ensureAcceptedReverseManual(
  ctx: MutationCtx,
  userId: Doc<"users">["_id"],
  matchedUserId: Doc<"users">["_id"],
  sourceMatch: Doc<"roommateMatches">,
) {
  const reverseManual = await getManualMatchesBetween(ctx, userId, matchedUserId);
  if (reverseManual.length === 0) {
    await ctx.db.insert("roommateMatches", {
      userId,
      matchedUserId,
      compatibilityScore: sourceMatch.compatibilityScore,
      matchBreakdown: sourceMatch.matchBreakdown,
      status: "accepted",
      matchType: "manual",
    });
    return;
  }

  // If duplicates exist, normalize them to accepted so the pair state is consistent.
  for (const match of reverseManual) {
    if (match.status !== "accepted") {
      await ctx.db.patch(match._id, { status: "accepted" });
    }
  }
}

// ---------------------------------------------------
// Queries
// ---------------------------------------------------

export const getForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return [];

    // Outgoing: matches where I am the sender
    const outgoing = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Incoming accepted manual connections where I am the receiver.
    // We include these so user2 always sees the connection even if the reverse
    // record wasn't created (e.g. accepted before that fix was deployed).
    const incomingRaw = await ctx.db
      .query("roommateMatches")
      .withIndex("by_matched_user", (q) => q.eq("matchedUserId", user._id))
      .collect();
    const incomingAccepted = incomingRaw.filter(
      (m) => m.status === "accepted" && m.matchType === "manual",
    );

    const manualRelationshipUserIds = getManualRelationshipUserIds(outgoing, incomingRaw);

    const outgoingManual = dedupeLatestByOtherUser(
      outgoing
        .filter((m) => m.matchType === "manual")
        .map(normalizeSmartStatus),
      (m) => m.matchedUserId,
    );

    const outgoingSmart = dedupeLatestByOtherUser(
      outgoing
        .filter((m) => m.matchType === "smart" && !manualRelationshipUserIds.has(m.matchedUserId))
        .map(normalizeSmartStatus),
      (m) => m.matchedUserId,
    );

    // Build a set of other-user IDs already covered by outgoing records so we
    // don't show the same person twice if the reverse accepted record also exists.
    const coveredUserIds = new Set(outgoingManual.map((m) => m.matchedUserId));

    // Synthesise a "from the receiver's perspective" match object so the
    // client can treat it identically to an outgoing accepted record.
    const incomingAsSender = dedupeLatestByOtherUser(
      incomingAccepted
      .filter((m) => !coveredUserIds.has(m.userId))
      .map((m) => ({
        ...m,
        // Flip the IDs so this user is always "userId" and the other is "matchedUserId"
        userId: user._id,
        matchedUserId: m.userId,
      })),
      (m) => m.matchedUserId,
    );

    const allMatches = [...outgoingManual, ...outgoingSmart, ...incomingAsSender];

    const results = await Promise.all(
      allMatches.map(async (match) => {
        const matchedUser = await ctx.db.get(match.matchedUserId);
        if (!matchedUser) return null;

        const profile = await getLatestRoommateProfileByUser(ctx, match.matchedUserId);

        const college = profile?.collegeId ? await ctx.db.get(profile.collegeId) : null;
        const photos = await ctx.db
          .query("userPhotos")
          .withIndex("by_user_order", (q) => q.eq("userId", match.matchedUserId))
          .collect();
        const visibleContacts = await resolveVisibleContacts(
          ctx,
          user._id,
          match.matchedUserId,
        );

        return {
          ...match,
          matchedUser: {
            ...stripSensitiveUserFields(matchedUser),
            contactInfo: visibleContacts,
          },
          profile: profile ? { ...profile, college } : null,
          photos,
        };
      }),
    );
    // Filter out nulls (deleted users) so the client always gets a clean array
    return results.filter((r) => r !== null);
  },
});

export const getMatchBetween = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return null;

    const matches = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user_and_matched", (q) =>
        q.eq("userId", user._id).eq("matchedUserId", otherUserId),
      )
      .collect();
    matches.sort((a, b) => b._creationTime - a._creationTime);
    const match = matches[0] ?? null;

    return match ?? null;
  },
});

// ---------------------------------------------------
// Mutations
// ---------------------------------------------------

export const computeMatches = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUserWithRole(ctx, "student");

    const myProfile = await getLatestRoommateProfileByUser(ctx, user._id);
    if (!myProfile) throw new ConvexError("Roommate profile required for matching");

    // Smart matching strictly requires the same college on both sides.
    // If a user has no college set they only match with others who also have no college.
    const candidatesRaw = await ctx.db
      .query("roommateProfiles")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const latestByUserId = new Map<Doc<"users">["_id"], RoommateProfile>();
    for (const candidate of candidatesRaw) {
      const existing = latestByUserId.get(candidate.userId);
      if (!existing || candidate._creationTime > existing._creationTime) {
        latestByUserId.set(candidate.userId, candidate);
      }
    }
    let candidates = [...latestByUserId.values()];
    candidates = candidates.filter(
      (p) => p.userId !== user._id && p.collegeId === myProfile.collegeId,
    );
    candidates = candidates.filter((p) => isMutuallyGenderCompatible(myProfile, p));

    // Recompute only smart suggestions for the latest profile state while
    // preserving accepted links and manual relationship intent.
    // Delete old smart matches that are still pending/declined - preserve accepted connections
    const oldMatches = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const old of oldMatches) {
      if (old.matchType !== "manual" && old.status !== "accepted") {
        await ctx.db.delete(old._id);
      }
    }

    // Build set of users already connected or with a pending manual request
    const existingManualTargets = new Set(
      oldMatches
        .filter((m) => m.matchType === "manual")
        .map((m) => m.matchedUserId),
    );

    // Compute and store new smart matches (skip users already in a manual relationship)
    let matchCount = 0;
    for (const candidate of candidates) {
      if (existingManualTargets.has(candidate.userId)) continue;
      const { compatibilityScore, matchBreakdown } = computeBreakdown(myProfile, candidate);

      const matchId = await ctx.db.insert("roommateMatches", {
        userId: user._id,
        matchedUserId: candidate.userId,
        compatibilityScore,
        matchBreakdown,
        status: "suggested",
        matchType: "smart",
      });
      await ctx.scheduler.runAfter(0, internal.gptMatching.refineMatchWithAI, {
        matchId,
      });
      matchCount++;
    }

    return { matchCount };
  },
});

export const getMatchById = query({
  args: { matchId: v.id("roommateMatches") },
  handler: async (ctx, { matchId }) => {
    const user = await getAuthedUser(ctx);
    if (!user) return null;

    const match = await ctx.db.get(matchId);
    if (!match) return null;
    if (match.userId !== user._id && match.matchedUserId !== user._id) return null;

    const profile1 = await getLatestRoommateProfileByUser(ctx, match.userId);
    const profile2 = await getLatestRoommateProfileByUser(ctx, match.matchedUserId);

    const user1 = await ctx.db.get(match.userId);
    const user2 = await ctx.db.get(match.matchedUserId);

    return {
      ...match,
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

export const updateInsight = internalMutation({
  args: {
    matchId: v.id("roommateMatches"),
    aiInsight: v.string(),
  },
  handler: async (ctx, { matchId, aiInsight }) => {
    const match = await ctx.db.get(matchId);
    if (!match) throw new ConvexError("Match not found");

    await ctx.db.patch(matchId, {
      matchBreakdown: {
        ...match.matchBreakdown,
        aiInsight,
      },
    });
  },
});

export const updateStatus = mutation({
  args: {
    matchId: v.id("roommateMatches"),
    status: v.union(v.literal("accepted"), v.literal("declined")),
  },
  handler: async (ctx, { matchId, status }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    const match = await ctx.db.get(matchId);
    if (!match) throw new ConvexError("Match not found");
    if (match.matchType !== "manual") {
      throw new ConvexError("Only manual requests can be updated");
    }
    if (match.matchedUserId !== user._id) throw new ConvexError("Not authorized");
    if (match.status !== "pending") throw new ConvexError("This request is no longer pending");

    await ctx.db.patch(matchId, { status });
    if (status === "accepted") {
      await ensureAcceptedReverseManual(ctx, user._id, match.userId, match);
    }
  },
});

// Send a connection request from browse, smart match, or profile detail page.
// Creates a pending manual record (initiator → target).
// If there is a smart match record for this pair, hide it (decline it).
export const sendConnectionRequest = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    if (user._id === targetUserId) throw new ConvexError("Cannot connect with yourself");
    const targetUser = await ctx.db.get(targetUserId);
    if (!targetUser) throw new ConvexError("Target user not found");
    if (targetUser.role !== "student") throw new ConvexError("Can only connect with student users");

    // Use the compound index for an efficient O(1) duplicate check
    const [alreadySent] = await getManualMatchesBetween(ctx, user._id, targetUserId);
    if (alreadySent) throw new ConvexError("Connection request already sent");

    // Also check if the target already has a manual record with this user.
    const [reverseManual] = await getManualMatchesBetween(ctx, targetUserId, user._id);
    if (reverseManual?.status === "accepted") throw new ConvexError("Already connected");
    if (reverseManual?.status === "pending") throw new ConvexError("This user already sent you a request");

    // Compute compatibility if profiles exist
    const myProfile = await getLatestRoommateProfileByUser(ctx, user._id);
    const theirProfile = await getLatestRoommateProfileByUser(ctx, targetUserId);

    let compatibilityScore = 50;
    let matchBreakdown = {
      budgetScore: 50, scheduleScore: 50, cleanlinessScore: 50,
      socialScore: 50, lifestyleScore: 50, locationScore: 50,
      matchedCriteria: [] as string[], potentialConflicts: [] as string[],
      aiInsight: "Connection request",
    };
    if (myProfile && theirProfile) {
      const result = computeBreakdown(myProfile, theirProfile);
      compatibilityScore = result.compatibilityScore;
      matchBreakdown = result.matchBreakdown;
    }

    // Create the pending manual request
    await ctx.db.insert("roommateMatches", {
      userId: user._id,
      matchedUserId: targetUserId,
      compatibilityScore,
      matchBreakdown,
      status: "pending",
      matchType: "manual",
    });

    // Hide the smart match for this pair (if it exists) so it doesn't re-surface
    const smartMatches = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user_and_matched", (q) =>
        q.eq("userId", user._id).eq("matchedUserId", targetUserId),
      )
      .filter((q) => q.eq(q.field("matchType"), "smart"))
      .collect();
    smartMatches.sort((a, b) => b._creationTime - a._creationTime);
    if (smartMatches.length > 0) {
      for (const smartMatch of smartMatches) {
        if (smartMatch.status !== "declined") {
          await ctx.db.patch(smartMatch._id, { status: "declined" });
        }
      }
    }
  },
});

// Check connection status between the current user and another user.
// Returns: "none" | "sent" | "received" | "connected"
export const getConnectionStatus = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return "none";

    const [outRecord] = await getManualMatchesBetween(ctx, user._id, otherUserId);
    if (outRecord?.status === "accepted") return "connected";
    if (outRecord?.status === "pending") return "sent";

    const [inRecord] = await getManualMatchesBetween(ctx, otherUserId, user._id);
    if (inRecord?.status === "accepted") return "connected";
    if (inRecord?.status === "pending") return "received";

    return "none" as const;
  },
});

export const getCompatibilityWithUser = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return null;
    if (user._id === otherUserId) return 100;

    const existingMatch = await getLatestEffectiveMatchBetweenUsers(ctx, user._id, otherUserId);
    if (existingMatch) return existingMatch.compatibilityScore;

    const myProfile = await getLatestRoommateProfileByUser(ctx, user._id);
    const otherProfile = await getLatestRoommateProfileByUser(ctx, otherUserId);
    if (!myProfile || !otherProfile) return null;

    if (!isMutuallyGenderCompatible(myProfile, otherProfile)) return 0;
    return computeBreakdown(myProfile, otherProfile).compatibilityScore;
  },
});

export const getPairContext = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return null;
    if (user._id === otherUserId) return null;

    const match = await getLatestEffectiveMatchBetweenUsers(ctx, user._id, otherUserId);
    if (!match) return null;

    return normalizeSmartStatus(match);
  },
});

// ---------------------------------------------------
// Manual Match Requests
// ---------------------------------------------------

export const getIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return [];

    const incoming = await ctx.db
      .query("roommateMatches")
      .withIndex("by_matched_user", (q) => q.eq("matchedUserId", user._id))
      .collect();

    const manualIncoming = incoming.filter((m) => m.matchType === "manual");

    return await Promise.all(
      manualIncoming.map(async (match) => {
        const sender = await ctx.db.get(match.userId);
        if (!sender) return null;

        const profile = await getLatestRoommateProfileByUser(ctx, match.userId);

        const college = profile?.collegeId ? await ctx.db.get(profile.collegeId) : null;

        const photos = await ctx.db
          .query("userPhotos")
          .withIndex("by_user_order", (q) => q.eq("userId", match.userId))
          .collect();

        const visibleContacts = await resolveVisibleContacts(ctx, user._id, match.userId);

        return {
          ...match,
          sender: { ...stripSensitiveUserFields(sender), contactInfo: visibleContacts },
          profile: profile ? { ...profile, college } : null,
          photos,
        };
      }),
    ).then((results) => results.filter(Boolean));
  },
});

export const respondToRequest = mutation({
  args: {
    matchId: v.id("roommateMatches"),
    status: v.union(v.literal("accepted"), v.literal("declined")),
  },
  handler: async (ctx, { matchId, status }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    const match = await ctx.db.get(matchId);
    if (!match) throw new ConvexError("Match not found");
    if (match.matchedUserId !== user._id) throw new ConvexError("Not authorized");
    if (match.matchType !== "manual") throw new ConvexError("Only manual requests can be responded to");
    if (match.status !== "pending") throw new ConvexError("This request is no longer pending");

    await ctx.db.patch(matchId, { status });

    if (status === "accepted") {
      await ensureAcceptedReverseManual(ctx, user._id, match.userId, match);
    }
  },
});

// Lets the match owner (userId) dismiss a suggested smart match
export const dismissMatch = mutation({
  args: { matchId: v.id("roommateMatches") },
  handler: async (ctx, { matchId }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    const match = await ctx.db.get(matchId);
    if (!match) throw new ConvexError("Match not found");
    if (match.userId !== user._id) throw new ConvexError("Not authorized");
    if (match.matchType !== "smart") throw new ConvexError("Only smart matches can be passed");

    await ctx.db.patch(matchId, { status: "declined" });
  },
});

export const restoreMatch = mutation({
  args: { matchId: v.id("roommateMatches") },
  handler: async (ctx, { matchId }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");
    const match = await ctx.db.get(matchId);
    if (!match) throw new ConvexError("Match not found");
    if (match.userId !== user._id) throw new ConvexError("Not authorized");
    if (match.matchType !== "smart") throw new ConvexError("Only smart matches can be restored");

    await ctx.db.patch(matchId, { status: "suggested" });
  },
});

export const getDeclinedForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return [];

    const outgoingRaw = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const incomingRaw = await ctx.db
      .query("roommateMatches")
      .withIndex("by_matched_user", (q) => q.eq("matchedUserId", user._id))
      .collect();
    const blockedUserIds = getManualRelationshipUserIds(outgoingRaw, incomingRaw);

    const declined = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(q.eq(q.field("status"), "declined"), q.neq(q.field("matchType"), "manual")),
      )
      .collect();
    const dedupedDeclined = dedupeLatestByOtherUser(
      declined
        .map(normalizeSmartStatus)
        .filter((match) => !blockedUserIds.has(match.matchedUserId)),
      (match) => match.matchedUserId,
    );

    return await Promise.all(
      dedupedDeclined.map(async (match) => {
        const matchedUser = await ctx.db.get(match.matchedUserId);
        if (!matchedUser) return null;
        return { ...match, matchedUser: stripSensitiveUserFields(matchedUser) };
      }),
    ).then((results) => results.filter(Boolean));
  },
});

export const acceptConnectionFromUser = mutation({
  args: { fromUserId: v.id("users") },
  handler: async (ctx, { fromUserId }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");

    // The request was sent by fromUserId to the current user (matchedUserId = user._id)
    const [match] = (await getManualMatchesBetween(ctx, fromUserId, user._id))
      .filter((row) => row.status === "pending");
    if (!match) throw new ConvexError("No pending request found");
    await ctx.db.patch(match._id, { status: "accepted" });

    await ensureAcceptedReverseManual(ctx, user._id, fromUserId, match);
  },
});

export const disconnectUser = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const user = await requireAuthedUserWithRole(ctx, "student");

    const outgoing = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user_and_matched", (q) =>
        q.eq("userId", user._id).eq("matchedUserId", otherUserId),
      )
      .collect();

    const incoming = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user_and_matched", (q) =>
        q.eq("userId", otherUserId).eq("matchedUserId", user._id),
      )
      .collect();

    const idsToDelete = new Set([...outgoing, ...incoming].map((m) => m._id));
    for (const id of idsToDelete) {
      await ctx.db.delete(id);
    }
  },
});

export const getManualOutgoing = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user || user.role !== "student") return [];

    const outgoing = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const manualOutgoing = outgoing.filter((m) => m.matchType === "manual");

    return await Promise.all(
      manualOutgoing.map(async (match) => {
        const matchedUser = await ctx.db.get(match.matchedUserId);
        if (!matchedUser) return null;

        const profile = await getLatestRoommateProfileByUser(ctx, match.matchedUserId);

        const photos = await ctx.db
          .query("userPhotos")
          .withIndex("by_user_order", (q) => q.eq("userId", match.matchedUserId))
          .collect();

        const visibleContacts = await resolveVisibleContacts(
          ctx,
          user._id,
          match.matchedUserId,
        );

        return {
          ...match,
          matchedUser: { ...stripSensitiveUserFields(matchedUser), contactInfo: visibleContacts },
          profile,
          photos,
        };
      }),
    ).then((results) => results.filter(Boolean));
  },
});
