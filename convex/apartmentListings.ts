import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  getAuthedUser,
  getVisibleContactsForViewer,
  requireAuthedUserWithRole,
  stripSensitiveUserFields,
} from "./lib";
import {
  assertMaxLength,
  assertNonEmpty,
  assertNonNegative,
  assertReasonableDate,
  normalizeStringArrayStrict,
  normalizeOptionalTrimmed,
  normalizeTrimmed,
} from "./validation";
import {
  parkingPolicyValidator,
  petPolicyValidator,
  rentTypeValidator,
  utilitiesPolicyValidator,
} from "./domain";

// These validators mirror convex/schema.ts and are used for mutation args.
const rentType = rentTypeValidator;
const petPolicy = petPolicyValidator;
const utilitiesPolicy = utilitiesPolicyValidator;
const parkingPolicy = parkingPolicyValidator;

type Ctx = QueryCtx | MutationCtx;

function assertValidListingNumbers(values: {
  rent?: number;
  securityDeposit?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  leaseLength?: number;
}) {
  assertNonNegative(values.rent, "Rent");
  assertNonNegative(values.securityDeposit, "Security deposit");
  assertNonNegative(values.bedrooms, "Bedrooms");
  assertNonNegative(values.bathrooms, "Bathrooms");
  assertNonNegative(values.squareFeet, "Square feet");
  assertNonNegative(values.leaseLength, "Lease length");
}

function normalizeLinks(
  links: Array<{ label: string; url: string }> | undefined,
) {
  const normalized = (links ?? [])
    .map((link) => ({
      label: normalizeTrimmed(link.label),
      url: normalizeTrimmed(link.url),
    }))
    .filter((link) => link.label && link.url);

  for (const link of normalized) {
    assertMaxLength(link.label, "Link label", 80);
    assertMaxLength(link.url, "Link URL", 1024);
  }

  return normalized;
}

async function getReportsByListingId(
  ctx: MutationCtx,
  listingId: Doc<"apartmentListings">["_id"],
) {
  return await ctx.db
    .query("reports")
    .withIndex("by_target", (q) => q.eq("targetType", "listing").eq("targetId", `listing:${listingId}`))
    .collect();
}

// Resolve a listing with all its related records.
async function resolveListing(
  ctx: QueryCtx,
  listing: Doc<"apartmentListings">,
) {
  const provider = await ctx.db.get(listing.providerId);
  if (!provider) return null;

  const providerUser = stripSensitiveUserFields(await ctx.db.get(provider.userId));
  const providerColleges = await Promise.all(
    provider.collegeIds.map((id) => ctx.db.get(id)),
  );

  const images = await ctx.db
    .query("listingImages")
    .withIndex("by_listing_order", (q) => q.eq("listingId", listing._id))
    .collect();

  const listingColleges = await Promise.all(
    listing.collegeIds.map((id) => ctx.db.get(id)),
  );

  const viewer = await getAuthedUser(ctx);
  const providerContacts = await getVisibleContactsForViewer(
    ctx,
    provider.userId,
    viewer?._id,
  );

  return {
    ...listing,
    provider: {
      ...provider,
      user: providerUser,
      colleges: providerColleges.filter(Boolean),
    },
    contacts: providerContacts,
    colleges: listingColleges.filter(Boolean),
    images: images.map((img) => img.url),
    imageRecords: images,
  };
}

async function getPrimaryProviderProfileForUser(
  ctx: Ctx,
  userId: Doc<"users">["_id"],
) {
  const providers = await ctx.db
    .query("providerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (providers.length === 0) return null;
  providers.sort((a, b) => b._creationTime - a._creationTime);
  return providers[0];
}

async function canViewListing(ctx: QueryCtx, listing: Doc<"apartmentListings">) {
  if (listing.isActive) return true;
  const viewer = await getAuthedUser(ctx);
  if (!viewer || viewer.role !== "provider") return false;
  const viewerProvider = await getPrimaryProviderProfileForUser(ctx, viewer._id);
  return viewerProvider?._id === listing.providerId;
}

export const list = query({
  args: {
    isActive: v.optional(v.boolean()),
    minRent: v.optional(v.number()),
    maxRent: v.optional(v.number()),
    minBedrooms: v.optional(v.number()),
    maxBedrooms: v.optional(v.number()),
    minBathrooms: v.optional(v.number()),
    rentType: v.optional(rentType),
    petPolicy: v.optional(petPolicy),
    utilities: v.optional(utilitiesPolicy),
    parking: v.optional(parkingPolicy),
    collegeId: v.optional(v.id("colleges")),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    amenitySearch: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("oldest"),
        v.literal("price_low"),
        v.literal("price_high"),
        v.literal("beds_low"),
        v.literal("beds_high"),
      ),
    ),
  },
  handler: async (ctx, filters) => {
    const isActive = filters.isActive ?? true;
    const allListings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_active", (q) => q.eq("isActive", isActive))
      .collect();

    // Apply filters
    const results = allListings.filter((listing) => {
      if (filters.minRent !== undefined && listing.rent < filters.minRent) return false;
      if (filters.maxRent !== undefined && listing.rent > filters.maxRent) return false;
      if (filters.minBedrooms !== undefined && listing.bedrooms < filters.minBedrooms) return false;
      if (filters.maxBedrooms !== undefined && listing.bedrooms > filters.maxBedrooms) return false;
      if (filters.minBathrooms !== undefined && listing.bathrooms < filters.minBathrooms) return false;
      if (filters.rentType !== undefined && listing.rentType !== filters.rentType) return false;
      if (filters.petPolicy !== undefined && listing.petPolicy !== filters.petPolicy) return false;
      if (filters.utilities !== undefined && listing.utilities !== filters.utilities) return false;
      if (filters.parking !== undefined && listing.parking !== filters.parking) return false;
      if (filters.city !== undefined && listing.city.toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.state !== undefined && listing.state.toLowerCase() !== filters.state.toLowerCase()) return false;
      if (filters.collegeId !== undefined && !listing.collegeIds.includes(filters.collegeId)) return false;
      if (filters.amenitySearch) {
        const search = filters.amenitySearch.toLowerCase();
        if (!listing.amenities.some((a) => a.toLowerCase().includes(search))) return false;
      }
      return true;
    });

    // Sort
    const sortBy = filters.sortBy ?? "newest";
    results.sort((a, b) => {
      switch (sortBy) {
        case "newest": return b._creationTime - a._creationTime;
        case "oldest": return a._creationTime - b._creationTime;
        case "price_low": return a.rent - b.rent;
        case "price_high": return b.rent - a.rent;
        case "beds_low": return a.bedrooms - b.bedrooms;
        case "beds_high": return b.bedrooms - a.bedrooms;
        default: return 0;
      }
    });

    // Resolve relations
    const resolved = await Promise.all(results.map((l) => resolveListing(ctx, l)));
    return resolved.filter(Boolean);
  },
});

export const getById = query({
  args: { listingId: v.id("apartmentListings") },
  handler: async (ctx, { listingId }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing) return null;
    if (!(await canViewListing(ctx, listing))) return null;
    return await resolveListing(ctx, listing);
  },
});

/**
 * Paginated listing feed for production-scale browsing.
 * Keep this endpoint as the preferred path for infinite-scroll UIs.
 */
export const listPaginated = query({
  args: {
    isActive: v.optional(v.boolean()),
    collegeId: v.optional(v.id("colleges")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { isActive, collegeId, paginationOpts }) => {
    const isActiveFilter = isActive ?? true;
    const page = await ctx.db
      .query("apartmentListings")
      .withIndex("by_active", (q) => q.eq("isActive", isActiveFilter))
      .order("desc")
      .paginate(paginationOpts);

    const narrowed = collegeId
      ? page.page.filter((listing) => listing.collegeIds.includes(collegeId))
      : page.page;
    const resolved = await Promise.all(narrowed.map((listing) => resolveListing(ctx, listing)));
    return {
      ...page,
      page: resolved.filter(Boolean),
    };
  },
});

export const countActive = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("apartmentListings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return active.length;
  },
});

export const latestActive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit ?? 8), 24));
    const rows = await ctx.db
      .query("apartmentListings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(safeLimit);

    const resolved = await Promise.all(rows.map((listing) => resolveListing(ctx, listing)));
    return resolved.filter(Boolean);
  },
});

export const searchActive = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { search, limit }) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit ?? 40), 80));
    const normalizedSearch = normalizeOptionalTrimmed(search)?.toLowerCase();

    const active = await ctx.db
      .query("apartmentListings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const filtered = normalizedSearch
      ? active.filter((listing) =>
          listing.title.toLowerCase().includes(normalizedSearch) ||
          listing.city.toLowerCase().includes(normalizedSearch),
        )
      : active;

    const sorted = filtered.sort((a, b) => b._creationTime - a._creationTime).slice(0, safeLimit);
    const resolved = await Promise.all(sorted.map((listing) => resolveListing(ctx, listing)));
    return resolved.filter(Boolean);
  },
});

export const getByProvider = query({
  args: { providerId: v.id("providerProfiles") },
  handler: async (ctx, { providerId }) => {
    const viewer = await getAuthedUser(ctx);
    const viewerProvider = viewer && viewer.role === "provider"
      ? await getPrimaryProviderProfileForUser(ctx, viewer._id)
      : null;
    const canViewInactive = viewerProvider?._id === providerId;

    const listings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();
    const visibleListings = canViewInactive
      ? listings
      : listings.filter((listing) => listing.isActive);

    return await Promise.all(
      visibleListings.map(async (listing) => {
        const images = await ctx.db
          .query("listingImages")
          .withIndex("by_listing_order", (q) => q.eq("listingId", listing._id))
          .collect();

        const colleges = await Promise.all(
          listing.collegeIds.map((id) => ctx.db.get(id)),
        );

        return {
          ...listing,
          images: images.map((img) => img.url),
          imageRecords: images,
          colleges: colleges.filter(Boolean),
        };
      }),
    );
  },
});

export const getMyListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return [];

    const provider = await getPrimaryProviderProfileForUser(ctx, user._id);
    if (!provider) return [];

    const listings = await ctx.db
      .query("apartmentListings")
      .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
      .collect();

    return await Promise.all(
      listings.map(async (listing) => {
        const images = await ctx.db
          .query("listingImages")
          .withIndex("by_listing_order", (q) => q.eq("listingId", listing._id))
          .collect();

        const colleges = await Promise.all(
          listing.collegeIds.map((id) => ctx.db.get(id)),
        );

        return {
          ...listing,
          images: images.map((img) => img.url),
          imageRecords: images,
          colleges: colleges.filter(Boolean),
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    address: v.string(),
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    rent: v.number(),
    rentType,
    securityDeposit: v.optional(v.number()),
    bedrooms: v.number(),
    bathrooms: v.number(),
    squareFeet: v.optional(v.number()),
    availableFrom: v.string(),
    leaseLength: v.optional(v.number()),
    petPolicy: v.optional(petPolicy),
    utilities: v.optional(utilitiesPolicy),
    parking: v.optional(parkingPolicy),
    amenities: v.optional(v.array(v.string())),
    collegeIds: v.optional(v.array(v.id("colleges"))),
    links: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUserWithRole(ctx, "provider");
    assertValidListingNumbers({
      rent: args.rent,
      securityDeposit: args.securityDeposit,
      bedrooms: args.bedrooms,
      bathrooms: args.bathrooms,
      squareFeet: args.squareFeet,
      leaseLength: args.leaseLength,
    });
    assertReasonableDate(args.availableFrom, "Available from");

    const title = normalizeTrimmed(args.title);
    const description = normalizeTrimmed(args.description);
    const address = normalizeTrimmed(args.address);
    const city = normalizeTrimmed(args.city);
    const state = normalizeTrimmed(args.state);
    const zipCode = normalizeTrimmed(args.zipCode);
    assertNonEmpty(title, "Title");
    assertNonEmpty(description, "Description");
    assertNonEmpty(address, "Address");
    assertNonEmpty(city, "City");
    assertNonEmpty(state, "State");
    assertNonEmpty(zipCode, "Zip code");
    assertMaxLength(title, "Title", 140);
    assertMaxLength(description, "Description", 5000);
    assertMaxLength(address, "Address", 240);
    assertMaxLength(city, "City", 80);
    assertMaxLength(state, "State", 40);
    assertMaxLength(zipCode, "Zip code", 20);
    const notes = normalizeOptionalTrimmed(args.notes);
    assertMaxLength(notes, "Notes", 2000);

    const provider = await getPrimaryProviderProfileForUser(ctx, user._id);
    if (!provider) throw new ConvexError("Provider profile required to create listings");
    for (const collegeId of args.collegeIds ?? []) {
      const college = await ctx.db.get(collegeId);
      if (!college) throw new ConvexError("One or more selected colleges no longer exist");
    }

    return await ctx.db.insert("apartmentListings", {
      providerId: provider._id,
      title,
      description,
      address,
      city,
      state,
      zipCode,
      rent: args.rent,
      rentType: args.rentType,
      securityDeposit: args.securityDeposit,
      bedrooms: args.bedrooms,
      bathrooms: args.bathrooms,
      squareFeet: args.squareFeet,
      availableFrom: args.availableFrom,
      leaseLength: args.leaseLength,
      petPolicy: args.petPolicy,
      utilities: args.utilities,
      parking: args.parking,
      amenities: normalizeStringArrayStrict(args.amenities),
      collegeIds: [...new Set(args.collegeIds ?? [])],
      links: normalizeLinks(args.links),
      notes,
      isActive: true,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    listingId: v.id("apartmentListings"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    rent: v.optional(v.number()),
    rentType: v.optional(rentType),
    securityDeposit: v.optional(v.number()),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    squareFeet: v.optional(v.number()),
    availableFrom: v.optional(v.string()),
    leaseLength: v.optional(v.number()),
    petPolicy: v.optional(petPolicy),
    utilities: v.optional(utilitiesPolicy),
    parking: v.optional(parkingPolicy),
    amenities: v.optional(v.array(v.string())),
    collegeIds: v.optional(v.array(v.id("colleges"))),
    links: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { listingId, ...args }) => {
    const user = await requireAuthedUserWithRole(ctx, "provider");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const provider = await getPrimaryProviderProfileForUser(ctx, user._id);
    if (!provider || listing.providerId !== provider._id) {
      throw new ConvexError("Not authorized to edit this listing");
    }
    assertValidListingNumbers({
      rent: args.rent,
      securityDeposit: args.securityDeposit,
      bedrooms: args.bedrooms,
      bathrooms: args.bathrooms,
      squareFeet: args.squareFeet,
      leaseLength: args.leaseLength,
    });
    assertReasonableDate(args.availableFrom, "Available from");
    if (args.collegeIds !== undefined) {
      for (const collegeId of args.collegeIds) {
        const college = await ctx.db.get(collegeId);
        if (!college) throw new ConvexError("One or more selected colleges no longer exist");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) updates[key] = value;
    }
    if (args.amenities !== undefined) {
      updates.amenities = normalizeStringArrayStrict(args.amenities);
    }
    if (args.collegeIds !== undefined) {
      updates.collegeIds = [...new Set(args.collegeIds)];
    }
    if (args.title !== undefined) {
      const title = normalizeTrimmed(args.title);
      assertNonEmpty(title, "Title");
      assertMaxLength(title, "Title", 140);
      updates.title = title;
    }
    if (args.description !== undefined) {
      const description = normalizeTrimmed(args.description);
      assertNonEmpty(description, "Description");
      assertMaxLength(description, "Description", 5000);
      updates.description = description;
    }
    if (args.address !== undefined) {
      const address = normalizeTrimmed(args.address);
      assertNonEmpty(address, "Address");
      assertMaxLength(address, "Address", 240);
      updates.address = address;
    }
    if (args.city !== undefined) {
      const city = normalizeTrimmed(args.city);
      assertNonEmpty(city, "City");
      assertMaxLength(city, "City", 80);
      updates.city = city;
    }
    if (args.state !== undefined) {
      const state = normalizeTrimmed(args.state);
      assertNonEmpty(state, "State");
      assertMaxLength(state, "State", 40);
      updates.state = state;
    }
    if (args.zipCode !== undefined) {
      const zipCode = normalizeTrimmed(args.zipCode);
      assertNonEmpty(zipCode, "Zip code");
      assertMaxLength(zipCode, "Zip code", 20);
      updates.zipCode = zipCode;
    }
    if (args.notes !== undefined) {
      const notes = normalizeOptionalTrimmed(args.notes);
      assertMaxLength(notes, "Notes", 2000);
      updates.notes = notes;
    }
    if (args.links !== undefined) {
      updates.links = normalizeLinks(args.links);
    }

    await ctx.db.patch(listingId, updates);
    return listingId;
  },
});

export const toggleActive = mutation({
  args: {
    listingId: v.id("apartmentListings"),
    isActive: v.boolean(),
  },
  handler: async (ctx, { listingId, isActive }) => {
    const user = await requireAuthedUserWithRole(ctx, "provider");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const provider = await getPrimaryProviderProfileForUser(ctx, user._id);
    if (!provider || listing.providerId !== provider._id) {
      throw new ConvexError("Not authorized");
    }

    await ctx.db.patch(listingId, { isActive, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { listingId: v.id("apartmentListings") },
  handler: async (ctx, { listingId }) => {
    const user = await requireAuthedUserWithRole(ctx, "provider");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new ConvexError("Listing not found");

    const provider = await getPrimaryProviderProfileForUser(ctx, user._id);
    if (!provider || listing.providerId !== provider._id) {
      throw new ConvexError("Not authorized");
    }

    // Cascade: delete images + storage
    const images = await ctx.db
      .query("listingImages")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
    for (const img of images) {
      if (img.storageId) await ctx.storage.delete(img.storageId);
      await ctx.db.delete(img._id);
    }

    // Cascade: delete saved listing refs
    const savedRefs = await ctx.db
      .query("savedListings")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
    for (const ref of savedRefs) {
      await ctx.db.delete(ref._id);
    }

    // Cascade: delete group-shared listing refs and votes
    const sharedListings = await ctx.db
      .query("groupSharedListings")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
    for (const shared of sharedListings) {
      const votes = await ctx.db
        .query("groupListingVotes")
        .withIndex("by_shared_listing", (q) => q.eq("sharedListingId", shared._id))
        .collect();
      for (const vote of votes) {
        await ctx.db.delete(vote._id);
      }
      await ctx.db.delete(shared._id);
    }

    // Cascade: delete reports tied to this listing.
    const listingReports = await getReportsByListingId(ctx, listingId);
    for (const report of listingReports) {
      await ctx.db.delete(report._id);
    }

    await ctx.db.delete(listingId);
  },
});
