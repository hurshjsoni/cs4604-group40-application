import { mutation, query, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { components } from "./_generated/api";
import { createAuth } from "./betterAuth/auth";
import { requireAuthedUser, requireAuthedUserWithRole } from "./lib";
import {
  assertMaxLength,
  assertNonEmpty,
  normalizeEmail,
  normalizeTrimmed,
} from "./validation";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_EMAIL = "group40@admin.com";
const DEFAULT_SETTINGS = {
  showInBrowse: false,
  showContactInfo: false,
  emailNotifications: true,
  matchNotifications: true,
  messageNotifications: true,
  theme: "system" as const,
};

function parseReportTargetId(targetType: "listing" | "user", targetId: string) {
  const trimmed = targetId.trim();
  if (!trimmed) return null;
  const [prefix, raw] = trimmed.split(":", 2);
  if (raw === undefined) return null;
  if (prefix !== targetType || !raw) return null;
  return raw;
}

async function getReportsByTarget(
  ctx: MutationCtx | QueryCtx,
  targetType: "listing" | "user",
  targetId: string,
) {
  return await ctx.db
    .query("reports")
    .withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", `${targetType}:${targetId}`))
    .collect();
}

async function requireAdmin(ctx: Parameters<typeof requireAuthedUser>[0]) {
  const user = await requireAuthedUserWithRole(ctx, "admin");
  return user;
}

async function ensureSettingsRow(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length > 0) {
    rows.sort((a, b) => b._creationTime - a._creationTime);
    for (const duplicate of rows.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }
    return;
  }
  await ctx.db.insert("userSettings", {
    userId,
    ...DEFAULT_SETTINGS,
  });
}

async function getLatestSettingsByUser(ctx: MutationCtx | QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestStudentProfileByUser(ctx: MutationCtx | QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("studentProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestProviderProfileByUser(ctx: MutationCtx | QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("providerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function getLatestRoommateProfileByUser(ctx: MutationCtx | QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("roommateProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => b._creationTime - a._creationTime);
  return rows[0];
}

async function deleteListingCascade(
  ctx: MutationCtx,
  listingId: Id<"apartmentListings">,
) {
  const images = await ctx.db
    .query("listingImages")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  for (const image of images) {
    if (image.storageId) {
      try {
        await ctx.storage.delete(image.storageId);
      } catch {
        // Ignore missing storage objects during cascade delete.
      }
    }
    await ctx.db.delete(image._id);
  }

  const saves = await ctx.db
    .query("savedListings")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  for (const row of saves) await ctx.db.delete(row._id);

  const sharedListings = await ctx.db
    .query("groupSharedListings")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  for (const shared of sharedListings) {
    const votes = await ctx.db
      .query("groupListingVotes")
      .withIndex("by_shared_listing", (q) => q.eq("sharedListingId", shared._id))
      .collect();
    for (const vote of votes) await ctx.db.delete(vote._id);
    await ctx.db.delete(shared._id);
  }

  const listingReports = await getReportsByTarget(ctx, "listing", listingId);
  for (const report of listingReports) await ctx.db.delete(report._id);

  await ctx.db.delete(listingId);
}

export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, providerProfiles, roommateProfiles, listings, reports, matches, groups, saved] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("providerProfiles").collect(),
        ctx.db.query("roommateProfiles").collect(),
        ctx.db.query("apartmentListings").collect(),
        ctx.db.query("reports").collect(),
        ctx.db.query("roommateMatches").collect(),
        ctx.db.query("roommateGroups").collect(),
        ctx.db.query("savedListings").collect(),
      ]);

    const now = Date.now();
    const last7 = now - DAY_MS * 7;
    const last30 = now - DAY_MS * 30;
    const listingToProvider = new Map(listings.map((l) => [l._id, l.providerId]));
    const providerSavedCounts = new Map<Id<"providerProfiles">, number>();
    for (const row of saved) {
      const providerId = listingToProvider.get(row.listingId);
      if (!providerId) continue;
      providerSavedCounts.set(providerId, (providerSavedCounts.get(providerId) ?? 0) + 1);
    }

    const reportsByReason: Record<string, number> = {};
    for (const report of reports) {
      reportsByReason[report.reason] = (reportsByReason[report.reason] ?? 0) + 1;
    }

    const providerRows = await Promise.all(
      providerProfiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        const providerListings = listings.filter((l) => l.providerId === profile._id);
        return {
          providerId: profile._id,
          userId: profile.userId,
          name: profile.companyName || user?.name || "Provider",
          email: user?.email ?? "",
          verified: profile.verified,
          listingCount: providerListings.length,
          activeListingCount: providerListings.filter((l) => l.isActive).length,
          saves: providerSavedCounts.get(profile._id) ?? 0,
        };
      }),
    );

    providerRows.sort((a, b) => b.listingCount - a.listingCount || b.saves - a.saves);

    return {
      totals: {
        users: users.length,
        students: users.filter((u) => u.role === "student").length,
        providers: users.filter((u) => u.role === "provider").length,
        admins: users.filter((u) => u.role === "admin").length,
        verifiedUsers: users.filter((u) => u.isVerified).length,
        providerProfiles: providerProfiles.length,
        activeRoommateProfiles: roommateProfiles.filter((p) => p.isActive).length,
        listings: listings.length,
        activeListings: listings.filter((l) => l.isActive).length,
        reports: reports.length,
        pendingReports: reports.filter((r) => r.status === "pending").length,
        reviewedReports: reports.filter((r) => r.status === "reviewed").length,
        resolvedReports: reports.filter((r) => r.status === "resolved").length,
        groups: groups.length,
        matches: matches.length,
        pendingMatches: matches.filter((m) => m.status === "pending").length,
      },
      growth: {
        usersLast7d: users.filter((u) => u._creationTime >= last7).length,
        usersLast30d: users.filter((u) => u._creationTime >= last30).length,
        listingsLast30d: listings.filter((l) => l._creationTime >= last30).length,
        reportsLast30d: reports.filter((r) => r._creationTime >= last30).length,
      },
      reportsByReason,
      topProviders: providerRows.slice(0, 8),
    };
  },
});

export const listReports = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    await requireAdmin(ctx);
    const max = Math.min(Math.max(limit ?? 100, 1), 250);

    const reports = status
      ? await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", status)).collect()
      : await ctx.db.query("reports").collect();

    reports.sort((a, b) => b._creationTime - a._creationTime);
    const sliced = reports.slice(0, max);

    return await Promise.all(
      sliced.map(async (report) => {
        const reporter = await ctx.db.get(report.reporterId);
        const parsedTargetId = parseReportTargetId(report.targetType, report.targetId);
        let target: Record<string, unknown> | null = null;
        let targetHref: string | null = null;

        if (report.targetType === "listing" && parsedTargetId) {
          const listingId = await ctx.db.normalizeId("apartmentListings", parsedTargetId);
          if (listingId) {
            const listing = await ctx.db.get(listingId);
            if (listing) {
              target = {
                id: listing._id,
                title: listing.title,
                city: listing.city,
                state: listing.state,
                isActive: listing.isActive,
              };
              targetHref = `/apartments/${listing._id}`;
            }
          }
        } else if (report.targetType === "user" && parsedTargetId) {
          const userId = await ctx.db.normalizeId("users", parsedTargetId);
          if (userId) {
            const user = await ctx.db.get(userId);
            if (user) {
              target = {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
              };
              targetHref = `/admin/users/${user._id}`;
            }
          }
        }

        return {
          ...report,
          reporter: reporter
            ? { id: reporter._id, name: reporter.name, email: reporter.email, role: reporter.role }
            : null,
          target,
          targetHref,
        };
      }),
    );
  },
});

export const getUserDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const [contacts, settings, studentProfile, providerProfile, roommateProfile] = await Promise.all([
      ctx.db.query("contactInfo").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      getLatestSettingsByUser(ctx, userId),
      getLatestStudentProfileByUser(ctx, userId),
      getLatestProviderProfileByUser(ctx, userId),
      getLatestRoommateProfileByUser(ctx, userId),
    ]);

    const roommateCollege = roommateProfile?.collegeId ? await ctx.db.get(roommateProfile.collegeId) : null;
    const studentCollege = studentProfile?.collegeId ? await ctx.db.get(studentProfile.collegeId) : null;
    const photos = await ctx.db
      .query("userPhotos")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    let providerListings: Array<Doc<"apartmentListings">> = [];
    if (providerProfile) {
      providerListings = await ctx.db
        .query("apartmentListings")
        .withIndex("by_provider", (q) => q.eq("providerId", providerProfile._id))
        .collect();
    }

    const reportsByUser = await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", userId))
      .collect();
    const reportsAgainstUser = await getReportsByTarget(ctx, "user", userId);

    const matchesCreated = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const matchesReceived = await ctx.db
      .query("roommateMatches")
      .withIndex("by_matched_user", (q) => q.eq("matchedUserId", userId))
      .collect();

    return {
      user,
      contacts,
      settings,
      studentProfile: studentProfile ? { ...studentProfile, college: studentCollege } : null,
      providerProfile: providerProfile ? { ...providerProfile, listings: providerListings } : null,
      roommateProfile: roommateProfile ? { ...roommateProfile, college: roommateCollege, photos } : null,
      stats: {
        listings: providerListings.length,
        matches: matchesCreated.length + matchesReceived.length,
        reportsByUser: reportsByUser.length,
        reportsAgainstUser: reportsAgainstUser.length,
      },
    };
  },
});

export const setReportStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("reviewed"), v.literal("resolved")),
  },
  handler: async (ctx, { reportId, status }) => {
    await requireAdmin(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) throw new ConvexError("Report not found");
    await ctx.db.patch(reportId, { status });
  },
});

export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(v.union(v.literal("student"), v.literal("provider"), v.literal("admin"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { search, role, limit }) => {
    await requireAdmin(ctx);
    const max = Math.min(Math.max(limit ?? 200, 1), 500);
    const q = search?.trim().toLowerCase() ?? "";

    let users = await ctx.db.query("users").collect();
    if (role) users = users.filter((user) => user.role === role);
    if (q) {
      users = users.filter((user) =>
        user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
      );
    }
    users.sort((a, b) => b._creationTime - a._creationTime);

    const trimmed = users.slice(0, max);
    return await Promise.all(
      trimmed.map(async (user) => {
        const [studentProfile, providerProfile, roommateProfile] = await Promise.all([
          getLatestStudentProfileByUser(ctx, user._id),
          getLatestProviderProfileByUser(ctx, user._id),
          getLatestRoommateProfileByUser(ctx, user._id),
        ]);
        return {
          ...user,
          hasStudentProfile: !!studentProfile,
          hasProviderProfile: !!providerProfile,
          hasRoommateProfile: !!roommateProfile,
          isRoommateActive: roommateProfile?.isActive ?? false,
          providerVerified: providerProfile?.verified ?? false,
        };
      }),
    );
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("student"), v.literal("provider"), v.literal("admin")),
  },
  handler: async (ctx, { name, email, password, role }) => {
    await requireAdmin(ctx);

    const normalizedName = normalizeTrimmed(name);
    const normalizedEmail = normalizeEmail(email);
    assertNonEmpty(normalizedName, "Name");
    assertNonEmpty(normalizedEmail, "Email");
    assertMaxLength(normalizedName, "Name", 120);
    assertMaxLength(normalizedEmail, "Email", 254);
    if (password.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    const existingApp = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    if (existingApp.length > 0) {
      throw new ConvexError("A user with this email already exists");
    }

    const auth = createAuth(ctx as Parameters<typeof createAuth>[0]);
    await auth.api.signUpEmail({
      body: { name: normalizedName, email: normalizedEmail, password },
    });

    const authUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: normalizedEmail }],
    })) as { _id: string } | null;

    if (!authUser?._id) {
      throw new ConvexError("Failed to create auth user");
    }

    const existingByToken = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", authUser._id))
      .collect();
    if (existingByToken.length > 0) {
      throw new ConvexError("A user with this auth identity already exists");
    }

    const userId = await ctx.db.insert("users", {
      name: normalizedName,
      email: normalizedEmail,
      role,
      isVerified: normalizedEmail.endsWith(".edu"),
      onboardingComplete: role === "admin",
      tokenIdentifier: authUser._id,
    });

    await ensureSettingsRow(ctx, userId);
    return userId;
  },
});

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);
    if (admin._id === userId) {
      throw new ConvexError("You cannot delete your own account");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    // Convex does not enforce SQL-style cascading deletes, so this mutation
    // performs explicit cross-table cleanup to prevent orphaned records.
    const [contactRows, photoRows, studentProfiles, providerProfiles, roommateProfiles, settingsRows] =
      await Promise.all([
        ctx.db.query("contactInfo").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("userPhotos").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("studentProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("providerProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("roommateProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("userSettings").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ]);

    for (const row of contactRows) await ctx.db.delete(row._id);
    for (const row of settingsRows) await ctx.db.delete(row._id);

    for (const photo of photoRows) {
      try {
        await ctx.storage.delete(photo.storageId);
      } catch {
        // Ignore missing storage objects during user cleanup.
      }
      await ctx.db.delete(photo._id);
    }
    for (const row of studentProfiles) await ctx.db.delete(row._id);
    for (const row of roommateProfiles) await ctx.db.delete(row._id);

    const userMatchesA = await ctx.db
      .query("roommateMatches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const userMatchesB = await ctx.db
      .query("roommateMatches")
      .withIndex("by_matched_user", (q) => q.eq("matchedUserId", userId))
      .collect();
    const matchIdsToDelete = new Set([...userMatchesA, ...userMatchesB].map((match) => match._id));
    for (const matchId of matchIdsToDelete) {
      await ctx.db.delete(matchId);
    }
 
    const saves = await ctx.db
      .query("savedListings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of saves) await ctx.db.delete(row._id);

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const member of memberships) await ctx.db.delete(member._id);

    const votesByUser = await ctx.db
      .query("groupListingVotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const vote of votesByUser) await ctx.db.delete(vote._id);

    const messages = await ctx.db
      .query("groupMessages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();
    for (const message of messages) await ctx.db.delete(message._id);

    const sharedByUser = await ctx.db
      .query("groupSharedListings")
      .withIndex("by_shared_by", (q) => q.eq("sharedBy", userId))
      .collect();
    for (const shared of sharedByUser) {
      const votes = await ctx.db
        .query("groupListingVotes")
        .withIndex("by_shared_listing", (q) => q.eq("sharedListingId", shared._id))
        .collect();
      for (const vote of votes) await ctx.db.delete(vote._id);
      await ctx.db.delete(shared._id);
    }

    const userReports = await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", userId))
      .collect();
    for (const report of userReports) await ctx.db.delete(report._id);

    const targetUserReports = await getReportsByTarget(ctx, "user", userId);
    for (const report of targetUserReports) await ctx.db.delete(report._id);

    const createdGroups = await ctx.db
      .query("roommateGroups")
      .withIndex("by_creator", (q) => q.eq("createdBy", userId))
      .collect();
    for (const group of createdGroups) {
      const groupMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const member of groupMembers) await ctx.db.delete(member._id);

      const groupMsgs = await ctx.db
        .query("groupMessages")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const groupMsg of groupMsgs) await ctx.db.delete(groupMsg._id);

      const shared = await ctx.db
        .query("groupSharedListings")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      for (const item of shared) {
        const votes = await ctx.db
          .query("groupListingVotes")
          .withIndex("by_shared_listing", (q) => q.eq("sharedListingId", item._id))
          .collect();
        for (const vote of votes) await ctx.db.delete(vote._id);
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(group._id);
    }

    for (const provider of providerProfiles) {
      const listings = await ctx.db
        .query("apartmentListings")
        .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
        .collect();
      for (const listing of listings) {
        await deleteListingCascade(ctx, listing._id);
      }
      await ctx.db.delete(provider._id);
    }

    await ctx.db.delete(userId);

    const authUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: user.email }],
    })) as { _id: string } | null;

    if (authUser?._id) {
      try {
        const paginationOpts = { cursor: null, numItems: 5000 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.runMutation(components.betterAuth.adapter.deleteMany as any, {
          input: {
            model: "session",
            where: [{ field: "userId", value: authUser._id }],
          },
          paginationOpts,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.runMutation(components.betterAuth.adapter.deleteMany as any, {
          input: {
            model: "account",
            where: [{ field: "userId", value: authUser._id }],
          },
          paginationOpts,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.runMutation(components.betterAuth.adapter.deleteOne as any, {
          input: {
            model: "user",
            where: [{ field: "_id", value: authUser._id }],
          },
        });
      } catch {
        // Keep app-layer deletion successful even if auth-component cleanup fails.
      }
    }

    return { success: true };
  },
});

export const seedDefaultAdmin = internalMutation({
  args: {},
  handler: async (ctx) => {
    const configuredPassword = process.env.DEFAULT_ADMIN_PASSWORD?.trim();
    if (!configuredPassword || configuredPassword.length < 12) {
      throw new ConvexError("DEFAULT_ADMIN_PASSWORD must be set to a strong password (min 12 chars)");
    }
    const existingAppAdmins = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", DEFAULT_ADMIN_EMAIL))
      .collect();
    if (existingAppAdmins.length > 0) {
      existingAppAdmins.sort((a, b) => a._creationTime - b._creationTime);
      const canonical = existingAppAdmins[0];
      for (const duplicate of existingAppAdmins.slice(1)) {
        await ctx.db.delete(duplicate._id);
      }
      if (canonical.role !== "admin") {
        await ctx.db.patch(canonical._id, { role: "admin", onboardingComplete: true });
      }
      await ensureSettingsRow(ctx, canonical._id);
      return {
        created: false,
        email: DEFAULT_ADMIN_EMAIL,
        message: "Admin account already existed.",
      };
    }

    const existingAuthUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: DEFAULT_ADMIN_EMAIL }],
    })) as { _id: string; name?: string } | null;

    let authUserId = existingAuthUser?._id ?? null;

    if (!authUserId) {
      const auth = createAuth(ctx as Parameters<typeof createAuth>[0]);
      await auth.api.signUpEmail({
        body: {
          name: "Group 40 Admin",
          email: DEFAULT_ADMIN_EMAIL,
          password: configuredPassword,
        },
      });

      const createdAuthUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: DEFAULT_ADMIN_EMAIL }],
      })) as { _id: string } | null;
      authUserId = createdAuthUser?._id ?? null;
    }

    if (!authUserId) {
      throw new ConvexError("Failed to create default admin auth account");
    }

    const userId = await ctx.db.insert("users", {
      email: DEFAULT_ADMIN_EMAIL,
      name: "Group 40 Admin",
      role: "admin",
      isVerified: true,
      onboardingComplete: true,
      tokenIdentifier: authUserId,
    });

    await ensureSettingsRow(ctx, userId);

    return {
      created: true,
      email: DEFAULT_ADMIN_EMAIL,
      message: "Default admin account created.",
    };
  },
});
