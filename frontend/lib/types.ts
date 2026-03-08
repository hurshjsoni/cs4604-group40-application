// ============================================================
// Core enums - used across the app
// ============================================================

export type UserRole = "student" | "provider" | "admin";

export type ContactType =
  | "email"
  | "phone"
  | "instagram"
  | "snapchat"
  | "discord"
  | "twitter"
  | "linkedin"
  | "other";

export type RentType = "entire_unit" | "per_bed" | "per_person";
export type PetPolicy = "allowed" | "not_allowed" | "case_by_case";
export type UtilitiesPolicy = "included" | "not_included" | "partial";
export type ParkingPolicy = "included" | "available" | "none";
export type MatchStatus = "pending" | "accepted" | "declined";
export type MatchType = "smart" | "manual";
export type GroupStatus = "searching" | "found_place" | "confirmed" | "disbanded";
export type GroupMemberRole = "admin" | "member";
export type GroupMemberStatus = "active" | "left" | "kicked";

// ============================================================
// Shared primitive interfaces
// ============================================================

/** Shape used by ContactInfoDisplay */
export interface ContactInfo {
  _id: string;
  userId?: string;
  type: ContactType;
  value: string;
  customLabel?: string | null;
  isPublic: boolean;
}

/** College record */
export interface College {
  _id: string;
  slug: string;
  name: string;
  shortName: string;
  location: string;
}

/** Lifestyle preferences object (mirrors Convex schema) */
export interface LifestylePreferences {
  sleepSchedule?: "early_bird" | "night_owl" | "flexible";
  wakeUpTime?: string;
  bedTime?: string;
  cleanliness?: "very_clean" | "clean" | "moderate" | "relaxed";
  cleaningFrequency?: "daily" | "weekly" | "biweekly" | "monthly";
  socialLevel?: "introvert" | "ambivert" | "extrovert";
  guestFrequency?: "never" | "rarely" | "sometimes" | "often" | "very_often";
  overnightGuests?: "never" | "rarely" | "sometimes" | "often";
  noiseLevel?: "very_quiet" | "quiet" | "moderate" | "lively";
  studyEnvironment?: "complete_silence" | "quiet" | "some_noise_ok" | "anywhere";
  musicPreference?: "headphones_only" | "low_volume" | "moderate" | "loud_ok";
  smoking?: "never" | "outside_only" | "yes";
  drinking?: "never" | "socially" | "regularly";
  pets?: "no_pets" | "have_pet" | "want_pet" | "allergic";
  petTypes?: string[];
  yearInSchool?: "freshman" | "sophomore" | "junior" | "senior" | "graduate" | "other";
  studyHabits?: "home_only" | "library_only" | "mixed" | "anywhere";
  workSchedule?: "no_job" | "part_time" | "full_time" | "internship";
  temperaturePreference?: "cold" | "moderate" | "warm";
  cookingFrequency?: "never" | "rarely" | "sometimes" | "often" | "daily";
  dietaryRestrictions?: string[];
  sharedSpaceUsage?: "minimal" | "moderate" | "frequent";
}

// ============================================================
// Resolved data shapes (what Convex resolvers return)
// ============================================================

/** User record as stored in the DB */
export interface AppUser {
  _id: string;
  _creationTime: number;
  email: string;
  name: string;
  role: UserRole;
  isVerified: boolean;
  avatarUrl?: string | null;
  onboardingComplete: boolean;
}

/** Provider profile with resolved user */
export interface ResolvedProvider {
  _id: string;
  userId: string;
  companyName: string;
  description?: string;
  website?: string;
  phone?: string;
  address?: string;
  verified: boolean;
  collegeIds: string[];
  user: AppUser | null;
  colleges: College[];
}

/** Image record for a listing */
export interface ListingImage {
  _id: string;
  listingId: string;
  storageId?: string;
  url: string;
  sortOrder: number;
}

/** Fully resolved apartment listing (as returned by apartmentListings.list / getById) */
export interface ApartmentListing {
  _id: string;
  _creationTime: number;
  providerId: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  rent: number;
  rentType: RentType;
  securityDeposit?: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  availableFrom: string;
  leaseLength?: number;
  petPolicy?: PetPolicy;
  utilities?: UtilitiesPolicy;
  parking?: ParkingPolicy;
  amenities: string[];
  collegeIds: string[];
  links: Array<{ label: string; url: string }>;
  notes?: string;
  isActive: boolean;
  updatedAt: number;
  /** Resolved relations */
  provider: {
    _id?: string;
    companyName?: string;
    verified?: boolean;
    user?: AppUser | null;
    colleges?: Array<College | null>;
  } | null;
  images: string[];
  imageRecords?: ListingImage[];
  colleges: Array<College | null>;
  contacts?: ContactInfo[];
}

/** Listing shape returned by getMyListings (partial - no full provider resolution) */
export interface MyListing {
  _id: string;
  _creationTime: number;
  title: string;
  rent: number;
  rentType: RentType;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  isActive: boolean;
  availableFrom: string;
  images: string[];
  imageRecords: ListingImage[];
  colleges: College[];
}

// ============================================================
// Roommate profiles
// ============================================================

/** Photo record as stored in DB */
export interface UserPhoto {
  _id: string;
  userId: string;
  storageId: string;
  url: string;
  sortOrder: number;
}

/** Fully resolved roommate profile (as returned by roommateProfiles.listActive / getByUser) */
export interface RoommateProfileWithUser {
  _id: string;
  _creationTime: number;
  userId: string;
  collegeId?: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredLocations: string[];
  moveInDate?: string;
  moveInFlexibility?: "exact" | "within_week" | "within_month" | "flexible";
  leaseDuration?: "semester" | "academic_year" | "full_year" | "flexible";
  lifestyle: LifestylePreferences;
  bio?: string;
  dealBreakers: string[];
  isActive: boolean;
  lookingFor?: "single_roommate" | "multiple_roommates" | "any";
  gender?: "male" | "female";
  genderPreference?: "same_gender" | "any_gender" | "no_preference" | "male" | "female";
  aboutMeTags: string[];
  roommatePreferences: string[];
  /** Resolved relations */
  user?: AppUser & { contactInfo?: ContactInfo[] };
  college?: College | null;
  photos?: UserPhoto[];
}

// ============================================================
// Match breakdown
// ============================================================

export interface MatchBreakdown {
  budgetScore: number;
  scheduleScore: number;
  cleanlinessScore: number;
  socialScore: number;
  lifestyleScore: number;
  locationScore: number;
  matchedCriteria: string[];
  potentialConflicts: string[];
  aiInsight?: string;
}

/** Fully resolved roommate match (as returned by roommateMatches.getForUser) */
export interface RoommateMatch {
  _id: string;
  _creationTime: number;
  userId: string;
  matchedUserId: string;
  compatibilityScore: number;
  matchBreakdown: MatchBreakdown;
  status: MatchStatus;
  matchType: MatchType;
  /** Resolved relations */
  matchedUser?: (AppUser & { contactInfo?: ContactInfo[] }) | null;
  profile?: RoommateProfileWithUser | null;
  photos?: UserPhoto[];
  sender?: (AppUser & { contactInfo?: ContactInfo[] }) | null;
}

// ============================================================
// Groups
// ============================================================

/** Group member with resolved user */
export interface GroupMemberWithUser {
  _id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: number;
  status: GroupMemberStatus;
  user?: AppUser | null;
}

/** Fully resolved group (as returned by groups.getMyGroups / getById) */
export interface GroupWithDetails {
  _id: string;
  _creationTime: number;
  name: string;
  createdBy: string;
  status: GroupStatus;
  targetBudgetMin?: number;
  targetBudgetMax?: number;
  targetMoveIn?: string;
  targetLocation?: string;
  notes?: string;
  /** Resolved relations */
  members: GroupMemberWithUser[];
  messageCount: number;
  sharedListingCount: number;
}

// ============================================================
// Saved listings / provider dashboard
// ============================================================

/** Shape returned by savedListings.getByUser */
export interface SavedListingWithListing {
  _id: string;
  _creationTime: number;
  userId: string;
  listingId: string;
  consentGiven?: boolean;
  listing: ApartmentListing | null;
}

/** Shape returned by savedListings.getStudentsInterestedInMyListings */
export interface InterestedStudent {
  savedId: string;
  student: { id: string; name: string; email: string };
  listing?: { id?: string; title: string } | null;
  contacts?: ContactInfo[];
}
