import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  contactTypeValidator,
  groupStatusValidator,
  lifestyleValidator,
  matchBreakdownValidator,
  matchStatusValidator,
  matchTypeValidator,
  parkingPolicyValidator,
  petPolicyValidator,
  rentTypeValidator,
  utilitiesPolicyValidator,
} from "./domain";

export default defineSchema({
  // ==========================================
  // 1. Core Identity
  // ==========================================

  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("student"), v.literal("provider"), v.literal("admin")),
    isVerified: v.boolean(),
    avatarUrl: v.optional(v.string()),
    onboardingComplete: v.boolean(),
    tokenIdentifier: v.string(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  contactInfo: defineTable({
    userId: v.id("users"),
    type: contactTypeValidator,
    value: v.string(),
    customLabel: v.optional(v.string()),
    isPublic: v.boolean(),
  })
    .index("by_user", ["userId"]),

  userPhotos: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    url: v.string(),
    sortOrder: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "sortOrder"]),

  // ==========================================
  // 2. Reference Data
  // ==========================================

  colleges: defineTable({
    slug: v.string(),
    name: v.string(),
    shortName: v.string(),
    location: v.string(),
  })
    .index("by_slug", ["slug"]),

  // ==========================================
  // 3. Profiles
  // ==========================================

  studentProfiles: defineTable({
    userId: v.id("users"),
    collegeId: v.optional(v.id("colleges")),
    graduationYear: v.optional(v.number()),
    major: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),

  providerProfiles: defineTable({
    userId: v.id("users"),
    companyName: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    verified: v.boolean(),
    collegeIds: v.array(v.id("colleges")),
  })
    .index("by_user", ["userId"]),

  roommateProfiles: defineTable({
    userId: v.id("users"),
    collegeId: v.optional(v.id("colleges")),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    preferredLocations: v.array(v.string()),
    moveInDate: v.optional(v.string()),
    moveInFlexibility: v.optional(
      v.union(v.literal("exact"), v.literal("within_week"), v.literal("within_month"), v.literal("flexible")),
    ),
    leaseDuration: v.optional(
      v.union(v.literal("semester"), v.literal("academic_year"), v.literal("full_year"), v.literal("flexible")),
    ),
    lifestyle: lifestyleValidator,
    bio: v.optional(v.string()),
    dealBreakers: v.array(v.string()),
    isActive: v.boolean(),
    lookingFor: v.optional(
      v.union(v.literal("single_roommate"), v.literal("multiple_roommates"), v.literal("any")),
    ),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    genderPreference: v.optional(
      v.union(
        v.literal("same_gender"),
        v.literal("any_gender"),
        v.literal("no_preference"),
        v.literal("male"),
        v.literal("female"),
      ),
    ),
    aboutMeTags: v.array(v.string()),
    roommatePreferences: v.array(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_college", ["collegeId"])
    .index("by_active", ["isActive"]),

  // ==========================================
  // 4. Roommate Matching
  // ==========================================

  roommateMatches: defineTable({
    userId: v.id("users"),
    matchedUserId: v.id("users"),
    compatibilityScore: v.number(),
    matchBreakdown: matchBreakdownValidator,
    status: matchStatusValidator,
    matchType: matchTypeValidator,
  })
    .index("by_user", ["userId"])
    .index("by_matched_user", ["matchedUserId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_and_matched", ["userId", "matchedUserId"]),

  // ==========================================
  // 5. Apartment Listings
  // ==========================================

  apartmentListings: defineTable({
    providerId: v.id("providerProfiles"),
    title: v.string(),
    description: v.string(),
    address: v.string(),
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    rent: v.number(),
    rentType: rentTypeValidator,
    securityDeposit: v.optional(v.number()),
    bedrooms: v.number(),
    bathrooms: v.number(),
    squareFeet: v.optional(v.number()),
    availableFrom: v.string(),
    leaseLength: v.optional(v.number()),
    petPolicy: v.optional(petPolicyValidator),
    utilities: v.optional(utilitiesPolicyValidator),
    parking: v.optional(parkingPolicyValidator),
    amenities: v.array(v.string()),
    collegeIds: v.array(v.id("colleges")),
    links: v.array(v.object({ label: v.string(), url: v.string() })),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_provider", ["providerId"])
    .index("by_active", ["isActive"])
    .index("by_rent", ["rent"])
    .index("by_bedrooms", ["bedrooms"])
    .index("by_city_state", ["city", "state"]),

  listingImages: defineTable({
    listingId: v.id("apartmentListings"),
    storageId: v.optional(v.id("_storage")),
    url: v.string(),
    sortOrder: v.number(),
  })
    .index("by_listing", ["listingId"])
    .index("by_listing_order", ["listingId", "sortOrder"]),

  // ==========================================
  // 6. Saved Listings
  // ==========================================

  savedListings: defineTable({
    userId: v.id("users"),
    listingId: v.id("apartmentListings"),
    consentGiven: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_listing", ["listingId"])
    .index("by_user_listing", ["userId", "listingId"]),

  // ==========================================
  // 7. Groups & Messaging
  // ==========================================

  roommateGroups: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    status: groupStatusValidator,
    targetBudgetMin: v.optional(v.number()),
    targetBudgetMax: v.optional(v.number()),
    targetMoveIn: v.optional(v.string()),
    targetLocation: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_creator", ["createdBy"]),

  groupMembers: defineTable({
    groupId: v.id("roommateGroups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
    status: v.union(v.literal("active"), v.literal("left"), v.literal("kicked")),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),

  groupMessages: defineTable({
    groupId: v.id("roommateGroups"),
    senderId: v.id("users"),
    content: v.string(),
    messageType: v.union(v.literal("text"), v.literal("system")),
  })
    .index("by_group", ["groupId"])
    .index("by_group_type", ["groupId", "messageType"])
    .index("by_sender", ["senderId"]),

  groupSharedListings: defineTable({
    groupId: v.id("roommateGroups"),
    listingId: v.id("apartmentListings"),
    sharedBy: v.id("users"),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("proposed"),
      v.literal("shortlisted"),
      v.literal("rejected"),
    ),
  })
    .index("by_group", ["groupId"])
    .index("by_group_listing", ["groupId", "listingId"])
    .index("by_listing", ["listingId"])
    .index("by_shared_by", ["sharedBy"]),

  groupListingVotes: defineTable({
    sharedListingId: v.id("groupSharedListings"),
    userId: v.id("users"),
    vote: v.union(
      v.literal("interested"),
      v.literal("neutral"),
      v.literal("not_interested"),
    ),
    comment: v.optional(v.string()),
  })
    .index("by_shared_listing", ["sharedListingId"])
    .index("by_shared_listing_user", ["sharedListingId", "userId"])
    .index("by_user", ["userId"]),

  // ==========================================
  // 8. Reports
  // ==========================================

  reports: defineTable({
    reporterId: v.id("users"),
    targetType: v.union(v.literal("listing"), v.literal("user")),
    // Canonical format: `${targetType}:${id}` (e.g. `listing:<id>`, `user:<id>`).
    // String is used because it can reference multiple tables.
    targetId: v.string(),
    reason: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),
  })
    .index("by_reporter", ["reporterId"])
    .index("by_target_type", ["targetType"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_status", ["status"]),

  // ==========================================
  // 9. User Settings
  // ==========================================

  userSettings: defineTable({
    userId: v.id("users"),
    showInBrowse: v.boolean(),
    showContactInfo: v.boolean(),
    emailNotifications: v.boolean(),
    matchNotifications: v.boolean(),
    messageNotifications: v.boolean(),
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  })
    .index("by_user", ["userId"]),
});
