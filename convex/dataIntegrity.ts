import { internalMutation, internalQuery } from "./_generated/server";
import { getUnexpectedLifestyleKeys, sanitizeLifestyle } from "./domain";

type IntegrityIssue = {
  table: string;
  recordId: string;
  issue: string;
  referenceField?: string;
  referencedTable?: string;
};

function groupIdsByCount(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function parseReportTargetId(targetType: "listing" | "user", targetId: string) {
  const trimmed = targetId.trim();
  if (!trimmed) return null;
  const [prefix, raw] = trimmed.split(":", 2);
  if (raw === undefined) return null;
  if (prefix !== targetType || !raw) return null;
  return raw;
}


/**
 * Internal integrity report for database grading and maintenance.
 */
export const audit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const issues: IntegrityIssue[] = [];

    const users = await ctx.db.query("users").collect();
    const userIdSet = new Set(users.map((u) => u._id));

    const colleges = await ctx.db.query("colleges").collect();
    const collegeIdSet = new Set(colleges.map((c) => c._id));

    const studentProfiles = await ctx.db.query("studentProfiles").collect();
    const providerProfiles = await ctx.db.query("providerProfiles").collect();
    const roommateProfiles = await ctx.db.query("roommateProfiles").collect();
    const userSettings = await ctx.db.query("userSettings").collect();
    const contactInfo = await ctx.db.query("contactInfo").collect();
    const userPhotos = await ctx.db.query("userPhotos").collect();

    const roommateGroups = await ctx.db.query("roommateGroups").collect();
    const groupIdSet = new Set(roommateGroups.map((g) => g._id));

    const listings = await ctx.db.query("apartmentListings").collect();
    const listingIdSet = new Set(listings.map((l) => l._id));
    const providerProfileIdSet = new Set(providerProfiles.map((p) => p._id));

    const groupShared = await ctx.db.query("groupSharedListings").collect();
    const groupSharedIdSet = new Set(groupShared.map((s) => s._id));

    const roommateMatches = await ctx.db.query("roommateMatches").collect();
    const reports = await ctx.db.query("reports").collect();

    for (const profile of studentProfiles) {
      if (!userIdSet.has(profile.userId)) {
        issues.push({
          table: "studentProfiles",
          recordId: profile._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
      if (profile.collegeId && !collegeIdSet.has(profile.collegeId)) {
        issues.push({
          table: "studentProfiles",
          recordId: profile._id,
          issue: "Invalid college reference",
          referenceField: "collegeId",
          referencedTable: "colleges",
        });
      }
    }

    for (const profile of providerProfiles) {
      if (!userIdSet.has(profile.userId)) {
        issues.push({
          table: "providerProfiles",
          recordId: profile._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
      for (const collegeId of profile.collegeIds) {
        if (!collegeIdSet.has(collegeId)) {
          issues.push({
            table: "providerProfiles",
            recordId: profile._id,
            issue: "Invalid college reference in collegeIds",
            referenceField: "collegeIds",
            referencedTable: "colleges",
          });
        }
      }
    }

    for (const profile of roommateProfiles) {
      if (!userIdSet.has(profile.userId)) {
        issues.push({
          table: "roommateProfiles",
          recordId: profile._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
      if (profile.collegeId && !collegeIdSet.has(profile.collegeId)) {
        issues.push({
          table: "roommateProfiles",
          recordId: profile._id,
          issue: "Invalid college reference",
          referenceField: "collegeId",
          referencedTable: "colleges",
        });
      }
      const unexpectedLifestyleKeys = getUnexpectedLifestyleKeys(profile.lifestyle);
      if (unexpectedLifestyleKeys.length > 0) {
        issues.push({
          table: "roommateProfiles",
          recordId: profile._id,
          issue: `Unsupported lifestyle keys: ${unexpectedLifestyleKeys.join(", ")}`,
          referenceField: "lifestyle",
        });
      }
    }

    for (const setting of userSettings) {
      if (!userIdSet.has(setting.userId)) {
        issues.push({
          table: "userSettings",
          recordId: setting._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
    }

    for (const contact of contactInfo) {
      if (!userIdSet.has(contact.userId)) {
        issues.push({
          table: "contactInfo",
          recordId: contact._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
    }

    for (const photo of userPhotos) {
      if (!userIdSet.has(photo.userId)) {
        issues.push({
          table: "userPhotos",
          recordId: photo._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
    }

    for (const listing of listings) {
      if (!providerProfileIdSet.has(listing.providerId)) {
        issues.push({
          table: "apartmentListings",
          recordId: listing._id,
          issue: "Orphaned provider profile reference",
          referenceField: "providerId",
          referencedTable: "providerProfiles",
        });
      }
      for (const collegeId of listing.collegeIds) {
        if (!collegeIdSet.has(collegeId)) {
          issues.push({
            table: "apartmentListings",
            recordId: listing._id,
            issue: "Invalid college reference in collegeIds",
            referenceField: "collegeIds",
            referencedTable: "colleges",
          });
        }
      }
    }

    const listingImages = await ctx.db.query("listingImages").collect();
    for (const image of listingImages) {
      if (!listingIdSet.has(image.listingId)) {
        issues.push({
          table: "listingImages",
          recordId: image._id,
          issue: "Orphaned listing reference",
          referenceField: "listingId",
          referencedTable: "apartmentListings",
        });
      }
    }

    const savedListings = await ctx.db.query("savedListings").collect();
    for (const saved of savedListings) {
      if (!userIdSet.has(saved.userId)) {
        issues.push({
          table: "savedListings",
          recordId: saved._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
      if (!listingIdSet.has(saved.listingId)) {
        issues.push({
          table: "savedListings",
          recordId: saved._id,
          issue: "Orphaned listing reference",
          referenceField: "listingId",
          referencedTable: "apartmentListings",
        });
      }
    }

    const groupMembers = await ctx.db.query("groupMembers").collect();
    for (const member of groupMembers) {
      if (!groupIdSet.has(member.groupId)) {
        issues.push({
          table: "groupMembers",
          recordId: member._id,
          issue: "Orphaned group reference",
          referenceField: "groupId",
          referencedTable: "roommateGroups",
        });
      }
      if (!userIdSet.has(member.userId)) {
        issues.push({
          table: "groupMembers",
          recordId: member._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
    }

    const groupMessages = await ctx.db.query("groupMessages").collect();
    for (const message of groupMessages) {
      if (!groupIdSet.has(message.groupId)) {
        issues.push({
          table: "groupMessages",
          recordId: message._id,
          issue: "Orphaned group reference",
          referenceField: "groupId",
          referencedTable: "roommateGroups",
        });
      }
      if (!userIdSet.has(message.senderId)) {
        issues.push({
          table: "groupMessages",
          recordId: message._id,
          issue: "Orphaned sender reference",
          referenceField: "senderId",
          referencedTable: "users",
        });
      }
    }

    for (const shared of groupShared) {
      if (!groupIdSet.has(shared.groupId)) {
        issues.push({
          table: "groupSharedListings",
          recordId: shared._id,
          issue: "Orphaned group reference",
          referenceField: "groupId",
          referencedTable: "roommateGroups",
        });
      }
      if (!listingIdSet.has(shared.listingId)) {
        issues.push({
          table: "groupSharedListings",
          recordId: shared._id,
          issue: "Orphaned listing reference",
          referenceField: "listingId",
          referencedTable: "apartmentListings",
        });
      }
      if (!userIdSet.has(shared.sharedBy)) {
        issues.push({
          table: "groupSharedListings",
          recordId: shared._id,
          issue: "Orphaned user reference",
          referenceField: "sharedBy",
          referencedTable: "users",
        });
      }
    }

    const votes = await ctx.db.query("groupListingVotes").collect();
    for (const vote of votes) {
      if (!groupSharedIdSet.has(vote.sharedListingId)) {
        issues.push({
          table: "groupListingVotes",
          recordId: vote._id,
          issue: "Orphaned shared listing reference",
          referenceField: "sharedListingId",
          referencedTable: "groupSharedListings",
        });
      }
      if (!userIdSet.has(vote.userId)) {
        issues.push({
          table: "groupListingVotes",
          recordId: vote._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
    }

    for (const match of roommateMatches) {
      if (!userIdSet.has(match.userId)) {
        issues.push({
          table: "roommateMatches",
          recordId: match._id,
          issue: "Orphaned user reference",
          referenceField: "userId",
          referencedTable: "users",
        });
      }
      if (!userIdSet.has(match.matchedUserId)) {
        issues.push({
          table: "roommateMatches",
          recordId: match._id,
          issue: "Orphaned matched user reference",
          referenceField: "matchedUserId",
          referencedTable: "users",
        });
      }
    }

    for (const report of reports) {
      if (!userIdSet.has(report.reporterId)) {
        issues.push({
          table: "reports",
          recordId: report._id,
          issue: "Orphaned reporter reference",
          referenceField: "reporterId",
          referencedTable: "users",
        });
        continue;
      }

      if (report.targetType === "listing") {
        const parsedTargetId = parseReportTargetId("listing", report.targetId);
        if (!parsedTargetId) {
          issues.push({
            table: "reports",
            recordId: report._id,
            issue: "Invalid listing report target format",
            referenceField: "targetId",
            referencedTable: "apartmentListings",
          });
          continue;
        }
        const listingId = await ctx.db.normalizeId("apartmentListings", parsedTargetId);
        if (!listingId) {
          issues.push({
            table: "reports",
            recordId: report._id,
            issue: "Invalid listing report target",
            referenceField: "targetId",
            referencedTable: "apartmentListings",
          });
        }
      } else {
        const parsedTargetId = parseReportTargetId("user", report.targetId);
        if (!parsedTargetId) {
          issues.push({
            table: "reports",
            recordId: report._id,
            issue: "Invalid user report target format",
            referenceField: "targetId",
            referencedTable: "users",
          });
          continue;
        }
        const userId = await ctx.db.normalizeId("users", parsedTargetId);
        if (userId) continue;
        issues.push({
          table: "reports",
          recordId: report._id,
          issue: "Invalid user report target",
          referenceField: "targetId",
          referencedTable: "users",
        });
      }
    }

    const duplicateSummary = {
      usersByToken: groupIdsByCount(users.map((u) => u.tokenIdentifier)),
      usersByEmail: groupIdsByCount(users.map((u) => u.email.trim().toLowerCase())),
      studentProfilesByUser: groupIdsByCount(studentProfiles.map((p) => p.userId)),
      providerProfilesByUser: groupIdsByCount(providerProfiles.map((p) => p.userId)),
      roommateProfilesByUser: groupIdsByCount(roommateProfiles.map((p) => p.userId)),
      userSettingsByUser: groupIdsByCount(userSettings.map((s) => s.userId)),
      savedListingsByUserListing: groupIdsByCount(savedListings.map((s) => `${s.userId}:${s.listingId}`)),
      groupMembersByGroupUser: groupIdsByCount(groupMembers.map((m) => `${m.groupId}:${m.userId}`)),
      groupSharedByGroupListing: groupIdsByCount(groupShared.map((s) => `${s.groupId}:${s.listingId}`)),
      groupVotesBySharedListingUser: groupIdsByCount(votes.map((v) => `${v.sharedListingId}:${v.userId}`)),
      roommateMatchesByPairType: groupIdsByCount(roommateMatches.map((m) => `${m.userId}:${m.matchedUserId}:${m.matchType}`)),
      contactInfoByUserTypeValue: groupIdsByCount(contactInfo.map((c) => `${c.userId}:${c.type}:${c.value.trim().toLowerCase()}`)),
    };

    return {
      checkedAt: Date.now(),
      issueCount: issues.length,
      duplicateSummary,
      issues,
    };
  },
});

/**
 * Best-effort cleanup pass for safe integrity repairs.
 * This removes orphaned records and duplicate logical keys, preserving the latest row.
 */
export const repair = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    let patched = 0;

    const colleges = await ctx.db.query("colleges").collect();
    const collegeIdSet = new Set(colleges.map((c) => c._id));

    const repairOneToOne = async <T extends { _id: unknown; _creationTime: number; userId: string }>(
      rows: T[],
    ) => {
      const byUser = new Map<string, T[]>();
      for (const row of rows) {
        const list = byUser.get(row.userId) ?? [];
        list.push(row);
        byUser.set(row.userId, list);
      }
      for (const [, list] of byUser) {
        if (list.length <= 1) continue;
        // Keep newest rows for one-to-one logical tables and remove stale duplicates.
        list.sort((a, b) => b._creationTime - a._creationTime);
        for (const duplicate of list.slice(1)) {
          await ctx.db.delete(duplicate._id as Parameters<typeof ctx.db.delete>[0]);
          deleted++;
        }
      }
    };

    await repairOneToOne(await ctx.db.query("studentProfiles").collect());
    await repairOneToOne(await ctx.db.query("providerProfiles").collect());
    await repairOneToOne(await ctx.db.query("roommateProfiles").collect());
    await repairOneToOne(await ctx.db.query("userSettings").collect());

    const studentProfiles = await ctx.db.query("studentProfiles").collect();
    for (const row of studentProfiles) {
      const user = await ctx.db.get(row.userId);
      if (!user) {
        await ctx.db.delete(row._id);
        deleted++;
      } else if (row.collegeId && !collegeIdSet.has(row.collegeId)) {
        await ctx.db.patch(row._id, { collegeId: undefined });
        patched++;
      }
    }

    const roommateProfiles = await ctx.db.query("roommateProfiles").collect();
    for (const row of roommateProfiles) {
      const user = await ctx.db.get(row.userId);
      if (!user) {
        await ctx.db.delete(row._id);
        deleted++;
      } else if (row.collegeId && !collegeIdSet.has(row.collegeId)) {
        await ctx.db.patch(row._id, { collegeId: undefined });
        patched++;
      }

      const unexpectedLifestyleKeys = getUnexpectedLifestyleKeys(row.lifestyle);
      if (unexpectedLifestyleKeys.length > 0) {
        await ctx.db.patch(row._id, {
          lifestyle: sanitizeLifestyle(row.lifestyle),
        });
        patched++;
      }
    }

    const providers = await ctx.db.query("providerProfiles").collect();
    for (const row of providers) {
      const user = await ctx.db.get(row.userId);
      if (!user) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const validCollegeIds = row.collegeIds.filter((collegeId) => collegeIdSet.has(collegeId));
      if (validCollegeIds.length !== row.collegeIds.length) {
        await ctx.db.patch(row._id, { collegeIds: validCollegeIds });
        patched++;
      }
    }

    const listings = await ctx.db.query("apartmentListings").collect();
    for (const row of listings) {
      const provider = await ctx.db.get(row.providerId);
      if (!provider) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const validCollegeIds = row.collegeIds.filter((collegeId) => collegeIdSet.has(collegeId));
      if (validCollegeIds.length !== row.collegeIds.length) {
        await ctx.db.patch(row._id, { collegeIds: validCollegeIds });
        patched++;
      }
    }

    const users = await ctx.db.query("users").collect();
    const userIdSet = new Set(users.map((u) => u._id));

    const contacts = await ctx.db.query("contactInfo").collect();
    const contactSeen = new Set<string>();
    for (const row of contacts) {
      if (!userIdSet.has(row.userId)) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const normalizedValue = row.value.trim();
      const normalizedLabel = row.customLabel?.trim() || undefined;
      if (normalizedValue !== row.value || normalizedLabel !== row.customLabel) {
        await ctx.db.patch(row._id, {
          value: normalizedValue,
          customLabel: normalizedLabel,
        });
        patched++;
      }
      if (!normalizedValue) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const key = `${row.userId}:${row.type}:${normalizedValue.toLowerCase()}`;
      if (contactSeen.has(key)) {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        contactSeen.add(key);
      }
    }

    const photos = await ctx.db.query("userPhotos").collect();
    for (const row of photos) {
      if (!userIdSet.has(row.userId)) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    const listingImages = await ctx.db.query("listingImages").collect();
    for (const row of listingImages) {
      const listing = await ctx.db.get(row.listingId);
      if (!listing) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    const saved = await ctx.db.query("savedListings").collect();
    const savedSeen = new Set<string>();
    for (const row of saved) {
      const user = await ctx.db.get(row.userId);
      const listing = await ctx.db.get(row.listingId);
      if (!user || !listing) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const key = `${row.userId}:${row.listingId}`;
      if (savedSeen.has(key)) {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        savedSeen.add(key);
      }
    }

    const members = await ctx.db.query("groupMembers").collect();
    const memberSeen = new Set<string>();
    for (const row of members) {
      const group = await ctx.db.get(row.groupId);
      const user = await ctx.db.get(row.userId);
      if (!group || !user) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const key = `${row.groupId}:${row.userId}`;
      if (memberSeen.has(key)) {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        memberSeen.add(key);
      }
    }

    const messages = await ctx.db.query("groupMessages").collect();
    for (const row of messages) {
      const group = await ctx.db.get(row.groupId);
      const sender = await ctx.db.get(row.senderId);
      if (!group || !sender) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    const sharedListings = await ctx.db.query("groupSharedListings").collect();
    const sharedSeen = new Set<string>();
    for (const row of sharedListings) {
      const group = await ctx.db.get(row.groupId);
      const listing = await ctx.db.get(row.listingId);
      const sharedBy = await ctx.db.get(row.sharedBy);
      if (!group || !listing || !sharedBy) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const key = `${row.groupId}:${row.listingId}`;
      if (sharedSeen.has(key)) {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        sharedSeen.add(key);
      }
    }

    const votes = await ctx.db.query("groupListingVotes").collect();
    const voteSeen = new Set<string>();
    for (const row of votes) {
      const shared = await ctx.db.get(row.sharedListingId);
      const user = await ctx.db.get(row.userId);
      if (!shared || !user) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const key = `${row.sharedListingId}:${row.userId}`;
      if (voteSeen.has(key)) {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        voteSeen.add(key);
      }
    }

    const matches = await ctx.db.query("roommateMatches").collect();
    const matchSeen = new Set<string>();
    for (const row of matches) {
      const user = await ctx.db.get(row.userId);
      const matchedUser = await ctx.db.get(row.matchedUserId);
      if (!user || !matchedUser) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      const key = `${row.userId}:${row.matchedUserId}:${row.matchType}`;
      if (matchSeen.has(key) && row.status !== "accepted") {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        matchSeen.add(key);
      }
    }

    const reports = await ctx.db.query("reports").collect();
    for (const row of reports) {
      const reporter = await ctx.db.get(row.reporterId);
      if (!reporter) {
        await ctx.db.delete(row._id);
        deleted++;
        continue;
      }
      if (row.targetType === "listing") {
        const parsedTargetId = parseReportTargetId("listing", row.targetId);
        if (!parsedTargetId) {
          await ctx.db.delete(row._id);
          deleted++;
          continue;
        }
        const listing = await ctx.db.normalizeId("apartmentListings", parsedTargetId);
        if (!listing) {
          await ctx.db.delete(row._id);
          deleted++;
        } else if (row.targetId !== `listing:${listing}`) {
          await ctx.db.patch(row._id, { targetId: `listing:${listing}` });
          patched++;
        }
      } else {
        const parsedTargetId = parseReportTargetId("user", row.targetId);
        if (!parsedTargetId) {
          await ctx.db.delete(row._id);
          deleted++;
          continue;
        }
        const user = await ctx.db.normalizeId("users", parsedTargetId);
        if (!user) {
          await ctx.db.delete(row._id);
          deleted++;
        } else if (row.targetId !== `user:${user}`) {
          await ctx.db.patch(row._id, { targetId: `user:${user}` });
          patched++;
        }
      }
    }

    return { deleted, patched };
  },
});
