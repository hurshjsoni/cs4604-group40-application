import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { createAuth } from "./betterAuth/auth";

const COLLEGES = [
  { slug: "vt", name: "Virginia Tech", shortName: "VT", location: "Blacksburg, VA" },
  { slug: "uva", name: "University of Virginia", shortName: "UVA", location: "Charlottesville, VA" },
  { slug: "gmu", name: "George Mason University", shortName: "GMU", location: "Fairfax, VA" },
  { slug: "vcu", name: "Virginia Commonwealth University", shortName: "VCU", location: "Richmond, VA" },
  { slug: "jmu", name: "James Madison University", shortName: "JMU", location: "Harrisonburg, VA" },
  { slug: "wm", name: "William & Mary", shortName: "W&M", location: "Williamsburg, VA" },
] as const;

const PASSWORDS = {
  admin: "Admin12345!",
  user: "User12345!",
  provider: "Provider12345!",
} as const;

type SeedUser = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: "student" | "provider" | "admin";
};

const MATCH_BREAKDOWN = {
  budgetScore: 80,
  scheduleScore: 75,
  cleanlinessScore: 78,
  socialScore: 82,
  lifestyleScore: 79,
  locationScore: 84,
  matchedCriteria: ["Budget", "Schedule", "Location"],
  potentialConflicts: ["Different social preferences"],
  aiInsight: "Strong overall compatibility with minor lifestyle tradeoffs.",
};

const LIFESTYLES = [
  {
    sleepSchedule: "early_bird" as const,
    wakeUpTime: "before_7am",
    bedTime: "before_10pm",
    cleanliness: "very_clean" as const,
    socialLevel: "introvert" as const,
    guestFrequency: "rarely" as const,
    noiseLevel: "very_quiet" as const,
    smoking: "never" as const,
    drinking: "never" as const,
    pets: "no_pets" as const,
  },
  {
    sleepSchedule: "night_owl" as const,
    wakeUpTime: "after_11am",
    bedTime: "after_2am",
    cleanliness: "moderate" as const,
    socialLevel: "extrovert" as const,
    guestFrequency: "often" as const,
    noiseLevel: "lively" as const,
    smoking: "never" as const,
    drinking: "socially" as const,
    pets: "want_pet" as const,
  },
  {
    sleepSchedule: "flexible" as const,
    wakeUpTime: "7am_9am",
    bedTime: "10pm_12am",
    cleanliness: "clean" as const,
    socialLevel: "ambivert" as const,
    guestFrequency: "sometimes" as const,
    noiseLevel: "moderate" as const,
    smoking: "never" as const,
    drinking: "socially" as const,
    pets: "no_pets" as const,
  },
] as const;

const APARTMENT_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1464890100898-a385f744067f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1600&q=80",
] as const;

const STUDENT_PERSONAS = [
  { name: "Maya Thompson", email: "maya.thompson@example.com", major: "Computer Science", bio: "Junior who likes clean shared spaces, weekday gym sessions, and quiet evenings for project work." },
  { name: "Ethan Brooks", email: "ethan.brooks@example.com", major: "Mechanical Engineering", bio: "Early riser, intramural soccer player, and dependable roommate who keeps common areas tidy." },
  { name: "Sofia Ramirez", email: "sofia.ramirez@example.com", major: "Biology", bio: "Pre-med student, organized schedule, and enjoys meal-prepping on Sundays." },
  { name: "Noah Patel", email: "noah.patel@example.com", major: "Finance", bio: "Business major with a part-time internship and a preference for calm weekday routines." },
  { name: "Olivia Chen", email: "olivia.chen@example.com", major: "Architecture", bio: "Studio-focused and respectful of quiet hours, especially before design reviews." },
  { name: "Liam Carter", email: "liam.carter@example.com", major: "Information Systems", bio: "Balanced social/academic lifestyle and reliable with rent and shared chores." },
  { name: "Ava Johnson", email: "ava.johnson@example.com", major: "Psychology", bio: "Friendly and communicative roommate who values a positive and respectful home vibe." },
  { name: "Jackson Reed", email: "jackson.reed@example.com", major: "Civil Engineering", bio: "Likes structured schedules, clean kitchens, and early morning classes." },
  { name: "Isabella Nguyen", email: "isabella.nguyen@example.com", major: "Marketing", bio: "Creative, social on weekends, and considerate about noise during study hours." },
  { name: "Lucas Foster", email: "lucas.foster@example.com", major: "Data Science", bio: "Quiet coder, coffee fan, and usually studies from home in the evenings." },
  { name: "Harper Davis", email: "harper.davis@example.com", major: "Nursing", bio: "Clinical rotations during the week and values roommates who communicate clearly." },
  { name: "Mason Cooper", email: "mason.cooper@example.com", major: "Political Science", bio: "Debate team member, clean living style, and prefers low-key weeknights." },
  { name: "Amelia Price", email: "amelia.price@example.com", major: "Public Health", bio: "Organized and collaborative, with a strong preference for shared cleanliness standards." },
  { name: "Benjamin Ward", email: "benjamin.ward@example.com", major: "Electrical Engineering", bio: "Hands-on project builder who keeps a predictable routine and neat workspace." },
  { name: "Charlotte Bailey", email: "charlotte.bailey@example.com", major: "English", bio: "Book lover and part-time tutor who appreciates a quiet apartment in the evenings." },
  { name: "Henry Collins", email: "henry.collins@example.com", major: "Supply Chain Management", bio: "Practical and easygoing roommate focused on reliability and respectful boundaries." },
  { name: "Ella Mitchell", email: "ella.mitchell@example.com", major: "Environmental Science", bio: "Sustainability-minded and good about shared responsibilities and utilities." },
  { name: "Daniel Murphy", email: "daniel.murphy@example.com", major: "Computer Engineering", bio: "Works on robotics projects and prefers roommates who value direct communication." },
  { name: "Grace Turner", email: "grace.turner@example.com", major: "Education", bio: "Student teacher with an early schedule and a strong preference for tidy common spaces." },
] as const;

const PROVIDER_PERSONAS = [
  { name: "Riley Morgan", email: "riley.morgan@blueridgehousing.com", companyName: "Blue Ridge Student Living", website: "https://blueridgestudentliving.com" },
  { name: "Jordan Kim", email: "jordan.kim@campusnestva.com", companyName: "Campus Nest Virginia", website: "https://campusnestva.com" },
  { name: "Taylor Bennett", email: "taylor.bennett@oakandmaplepm.com", companyName: "Oak & Maple Property Management", website: "https://oakandmaplepm.com" },
  { name: "Casey Alvarez", email: "casey.alvarez@piedmonthousinggroup.com", companyName: "Piedmont Housing Group", website: "https://piedmonthousinggroup.com" },
  { name: "Morgan Ellis", email: "morgan.ellis@scholarlivingco.com", companyName: "Scholar Living Co.", website: "https://scholarlivingco.com" },
] as const;

const LISTING_PERSONAS = [
  { title: "Maple Court Lofts", description: "Modern loft-style apartments with updated kitchens, study-friendly layouts, and fast maintenance response." },
  { title: "The Landing at College Ave", description: "Walkable location near dining and transit with furnished options and community study areas." },
  { title: "Ridgeview Commons", description: "Quiet mid-rise community with secure access, in-unit laundry, and flexible lease terms." },
  { title: "Campus Grove Apartments", description: "Bright units with roommate-friendly floorplans and a large resident lounge." },
  { title: "Hawthorne Square", description: "Spacious apartments featuring stainless appliances and strong value for students." },
  { title: "University Park Residences", description: "Pet-friendly complex with fitness center, package lockers, and covered parking." },
  { title: "East Main Flats", description: "Downtown-adjacent apartments with updated interiors and easy bus access to campus." },
  { title: "Red Oak Terrace", description: "Comfortable student housing with private bedrooms and collaborative common spaces." },
  { title: "Summit House", description: "Well-managed apartment community with strong security and quiet-hour enforcement." },
  { title: "Pine & Pearl Living", description: "Renovated units, modern finishes, and attentive on-site property staff." },
  { title: "Jefferson Walk", description: "Popular for roommate groups thanks to balanced pricing and practical layouts." },
  { title: "Southgate Studios & Suites", description: "Studio and multi-bedroom options close to grocery stores and campus shuttle routes." },
  { title: "Cedar Point Apartments", description: "Reliable student-focused housing with upgraded kitchens and bike storage." },
  { title: "Elm Street Residences", description: "Convenient location with spacious living areas and individual leasing options." },
  { title: "Mill District Flats", description: "Contemporary apartments with energy-efficient utilities and common amenity spaces." },
  { title: "Parkline on Madison", description: "High-demand property offering modern finishes and responsive property management." },
  { title: "Northview Place", description: "Calm residential setting, practical floorplans, and strong value per bedroom." },
  { title: "The Commons on River", description: "Student community with social events, secure entry, and upgraded appliances." },
  { title: "Broad Street Living", description: "Flexible layouts for pairs or larger roommate groups, near major campus corridors." },
  { title: "Foundry Court", description: "Well-maintained apartments with roomy kitchens and easy parking access." },
] as const;

async function ensureAuthUser(
  ctx: MutationCtx,
  email: string,
  name: string,
  password: string,
) {
  const existing = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email }],
  })) as { _id: string } | null;
  if (existing?._id) return existing._id;

  const auth = createAuth(ctx as Parameters<typeof createAuth>[0]);
  await auth.api.signUpEmail({ body: { email, name, password } });

  const created = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email }],
  })) as { _id: string } | null;

  if (!created?._id) {
    throw new Error(`Failed to create Better Auth user for ${email}`);
  }
  return created._id;
}

async function wipeAppTables(ctx: MutationCtx) {
  const userPhotos = await ctx.db.query("userPhotos").collect();
  for (const row of userPhotos) {
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  }

  const listingImages = await ctx.db.query("listingImages").collect();
  for (const row of listingImages) {
    if (row.storageId) await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  }

  const tableOrder = [
    "groupListingVotes",
    "groupSharedListings",
    "groupMessages",
    "groupMembers",
    "roommateMatches",
    "savedListings",
    "reports",
    "apartmentListings",
    "roommateGroups",
    "roommateProfiles",
    "studentProfiles",
    "providerProfiles",
    "contactInfo",
    "userSettings",
    "users",
    "colleges",
  ] as const;

  for (const table of tableOrder) {
    const rows = await ctx.db.query(table).collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }
}

async function wipeBetterAuthTables(ctx: MutationCtx) {
  const paginationOpts = { cursor: null, numItems: 100000 };
  const models = ["session", "account", "verification", "user", "jwks"] as const;

  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation(components.betterAuth.adapter.deleteMany as any, {
      input: { model },
      paginationOpts,
    });
  }
}

async function runSeed(ctx: MutationCtx) {
    if (process.env.CONVEX_DEPLOYMENT?.startsWith("prod:")) {
      throw new Error("Seeding is disabled for production deployments");
    }
    await wipeAppTables(ctx);
    await wipeBetterAuthTables(ctx);

    const collegesBySlug: Record<string, Id<"colleges">> = {};
    for (const college of COLLEGES) {
      collegesBySlug[college.slug] = await ctx.db.insert("colleges", { ...college });
    }

    const users: SeedUser[] = [];

    const authAdminId = await ensureAuthUser(ctx, "group40@admin.com", "Morgan Lee", PASSWORDS.admin);
    const authUserId = await ensureAuthUser(ctx, "group40@user.com", "Alex Carter", PASSWORDS.user);
    const authProviderId = await ensureAuthUser(ctx, "group40@provider.com", "Jordan Patel", PASSWORDS.provider);

    const adminId = await ctx.db.insert("users", {
      email: "group40@admin.com",
      name: "Morgan Lee",
      role: "admin",
      isVerified: true,
      onboardingComplete: true,
      tokenIdentifier: authAdminId,
    });
    users.push({ _id: adminId, email: "group40@admin.com", name: "Morgan Lee", role: "admin" });

    const focusStudentId = await ctx.db.insert("users", {
      email: "group40@user.com",
      name: "Alex Carter",
      role: "student",
      isVerified: true,
      onboardingComplete: true,
      tokenIdentifier: authUserId,
    });
    users.push({ _id: focusStudentId, email: "group40@user.com", name: "Alex Carter", role: "student" });

    const focusProviderUserId = await ctx.db.insert("users", {
      email: "group40@provider.com",
      name: "Jordan Patel",
      role: "provider",
      isVerified: true,
      onboardingComplete: true,
      tokenIdentifier: authProviderId,
    });
    users.push({ _id: focusProviderUserId, email: "group40@provider.com", name: "Jordan Patel", role: "provider" });

    for (let i = 0; i < STUDENT_PERSONAS.length; i++) {
      const persona = STUDENT_PERSONAS[i];
      const id = await ctx.db.insert("users", {
        email: persona.email,
        name: persona.name,
        role: "student",
        isVerified: i % 2 === 0,
        onboardingComplete: true,
        tokenIdentifier: `persona|student-${i + 1}`,
      });
      users.push({ _id: id, email: persona.email, name: persona.name, role: "student" });
    }

    for (let i = 0; i < PROVIDER_PERSONAS.length; i++) {
      const persona = PROVIDER_PERSONAS[i];
      const id = await ctx.db.insert("users", {
        email: persona.email,
        name: persona.name,
        role: "provider",
        isVerified: true,
        onboardingComplete: true,
        tokenIdentifier: `persona|provider-${i + 1}`,
      });
      users.push({ _id: id, email: persona.email, name: persona.name, role: "provider" });
    }

    const adminTwoId = await ctx.db.insert("users", {
      email: "casey.reynolds@admin.example.com",
      name: "Casey Reynolds",
      role: "admin",
      isVerified: true,
      onboardingComplete: true,
      tokenIdentifier: "persona|admin-2",
    });
    users.push({ _id: adminTwoId, email: "casey.reynolds@admin.example.com", name: "Casey Reynolds", role: "admin" });

    for (const user of users) {
      await ctx.db.insert("userSettings", {
        userId: user._id,
        showInBrowse: user.role === "student",
        showContactInfo: user.role !== "admin",
        emailNotifications: true,
        matchNotifications: true,
        messageNotifications: true,
        theme: "system",
      });
    }

    for (const user of users) {
      await ctx.db.insert("contactInfo", {
        userId: user._id,
        type: "email",
        value: user.email,
        isPublic: true,
      });
      if (user.role !== "admin") {
        await ctx.db.insert("contactInfo", {
          userId: user._id,
          type: "phone",
          value: `(540) 555-${String(Math.floor(1000 + Math.random() * 8999))}`,
          isPublic: user.role === "provider",
        });
      }
    }

    const studentUsers = users.filter((u) => u.role === "student");
    const providerUsers = users.filter((u) => u.role === "provider");

    for (let i = 0; i < studentUsers.length; i++) {
      const s = studentUsers[i];
      const college = COLLEGES[i % COLLEGES.length];
      const persona = i === 0
        ? { major: "Computer Science" }
        : STUDENT_PERSONAS[i - 1];
      await ctx.db.insert("studentProfiles", {
        userId: s._id,
        collegeId: collegesBySlug[college.slug],
        graduationYear: 2027 + (i % 4),
        major: persona.major,
      });
    }

    const providerProfiles: Array<{ _id: Id<"providerProfiles">; userId: Id<"users"> }> = [];
    for (let i = 0; i < providerUsers.length; i++) {
      const p = providerUsers[i];
      const collegeA = COLLEGES[i % COLLEGES.length];
      const collegeB = COLLEGES[(i + 1) % COLLEGES.length];
      const providerPersona = i === 0 ? null : PROVIDER_PERSONAS[i - 1];
      const profileId = await ctx.db.insert("providerProfiles", {
        userId: p._id,
        companyName: p.email === "group40@provider.com"
          ? "Highland Student Housing"
          : providerPersona?.companyName ?? "Campus Housing Group",
        description: p.email === "group40@provider.com"
          ? "Regional provider focused on reliable student apartments near transit and campus amenities."
          : `Property management team led by ${p.name}, specializing in student-friendly leases.`,
        website: p.email === "group40@provider.com"
          ? "https://highlandstudenthousing.com"
          : providerPersona?.website ?? "https://campushousinggroup.com",
        phone: `(540) 700-${String(1000 + i)}`,
        address: `${100 + i} Provider Ave, ${collegeA.location}`,
        verified: true,
        collegeIds: [collegesBySlug[collegeA.slug], collegesBySlug[collegeB.slug]],
      });
      providerProfiles.push({ _id: profileId, userId: p._id });
    }

    const roommateProfiles: Id<"roommateProfiles">[] = [];
    for (let i = 0; i < studentUsers.length; i++) {
      const s = studentUsers[i];
      const college = COLLEGES[i % COLLEGES.length];
      const lifestyle = LIFESTYLES[i % LIFESTYLES.length];
      const studentPersona = i === 0 ? null : STUDENT_PERSONAS[i - 1];
      const profileId = await ctx.db.insert("roommateProfiles", {
        userId: s._id,
        collegeId: collegesBySlug[college.slug],
        budgetMin: 500 + i * 20,
        budgetMax: 900 + i * 30,
        preferredLocations: [college.location.split(",")[0], `${college.shortName} Campus`],
        moveInDate: "2026-08-01",
        moveInFlexibility: "within_month",
        leaseDuration: "full_year",
        lifestyle,
        bio: s.email === "group40@user.com"
          ? "Computer science student looking for a responsible roommate near campus with a practical budget."
          : (studentPersona?.bio ?? `${s.name} is a reliable roommate with balanced study and social habits.`),
        dealBreakers: ["Smoking indoors", "Unpaid utilities"],
        isActive: true,
        lookingFor: i % 3 === 0 ? "single_roommate" : i % 3 === 1 ? "multiple_roommates" : "any",
        gender: i % 2 === 0 ? "male" : "female",
        genderPreference: "no_preference",
        aboutMeTags: ["Clean", "Respectful", "Communicative"],
        roommatePreferences: ["Quiet at night", "Pays on time", "Shared chores"],
      });
      roommateProfiles.push(profileId);
    }

    const listings: Id<"apartmentListings">[] = [];
    for (let i = 0; i < 20; i++) {
      const provider = providerProfiles[i % providerProfiles.length];
      const college = COLLEGES[i % COLLEGES.length];
      const listingPersona = LISTING_PERSONAS[i];
      const listingId = await ctx.db.insert("apartmentListings", {
        providerId: provider._id,
        title: listingPersona.title,
        description: listingPersona.description,
        address: `${200 + i} Market St`,
        city: college.location.split(",")[0],
        state: "VA",
        zipCode: `24${String(100 + i).padStart(3, "0")}`,
        rent: 700 + i * 35,
        rentType: i % 3 === 0 ? "entire_unit" : i % 3 === 1 ? "per_bed" : "per_person",
        securityDeposit: 500 + i * 10,
        bedrooms: (i % 4) + 1,
        bathrooms: (i % 2) + 1,
        squareFeet: 650 + i * 20,
        availableFrom: "2026-08-01",
        leaseLength: 12,
        petPolicy: i % 3 === 0 ? "allowed" : i % 3 === 1 ? "not_allowed" : "case_by_case",
        utilities: i % 3 === 0 ? "included" : i % 3 === 1 ? "not_included" : "partial",
        parking: i % 3 === 0 ? "included" : i % 3 === 1 ? "available" : "none",
        amenities: ["In-unit Laundry", "Gym", "Study Lounge"],
        collegeIds: [collegesBySlug[college.slug]],
        links: [],
        notes: i % 2 === 0 ? "Utilities and parking options vary by floorplan." : undefined,
        isActive: true,
        updatedAt: Date.now(),
      });
      listings.push(listingId);
      await ctx.db.insert("listingImages", {
        listingId,
        url: APARTMENT_IMAGE_URLS[i % APARTMENT_IMAGE_URLS.length],
        sortOrder: 0,
      });
    }

    let savedCount = 0;
    for (let i = 0; i < studentUsers.length; i++) {
      for (let j = 0; j < 2; j++) {
        const listingId = listings[(i * 2 + j) % listings.length];
        await ctx.db.insert("savedListings", {
          userId: studentUsers[i]._id,
          listingId,
          consentGiven: studentUsers[i]._id === focusStudentId ? true : j % 2 === 0,
        });
        savedCount += 1;
      }
    }

    const matches: Id<"roommateMatches">[] = [];
    for (let i = 1; i < studentUsers.length; i++) {
      matches.push(
        await ctx.db.insert("roommateMatches", {
          userId: focusStudentId,
          matchedUserId: studentUsers[i]._id,
          compatibilityScore: 65 + (i % 30),
          matchBreakdown: MATCH_BREAKDOWN,
          status: i % 4 === 0 ? "accepted" : i % 4 === 1 ? "declined" : "pending",
          matchType: i % 2 === 0 ? "smart" : "manual",
        }),
      );
    }
    if (matches.length < 20) {
      for (let i = 0; i < 20 - matches.length; i++) {
        matches.push(
          await ctx.db.insert("roommateMatches", {
            userId: studentUsers[(i + 1) % studentUsers.length]._id,
            matchedUserId: studentUsers[(i + 2) % studentUsers.length]._id,
            compatibilityScore: 60 + i,
            matchBreakdown: MATCH_BREAKDOWN,
            status: "pending",
            matchType: "smart",
          }),
        );
      }
    }

    const groups: Id<"roommateGroups">[] = [];
    for (let i = 0; i < 5; i++) {
      groups.push(
        await ctx.db.insert("roommateGroups", {
          name: `Roommate Circle ${i + 1}`,
          createdBy: studentUsers[i]._id,
          status: "searching",
          targetBudgetMin: 600 + i * 50,
          targetBudgetMax: 1200 + i * 60,
          targetMoveIn: "2026-08-01",
          targetLocation: COLLEGES[i % COLLEGES.length].location,
          notes: "Focused on finding a clean and budget-aligned apartment before the semester starts.",
        }),
      );
    }

    let groupMembersCount = 0;
    let groupMessagesCount = 0;
    const sharedListings: Id<"groupSharedListings">[] = [];

    for (let i = 0; i < groups.length; i++) {
      const groupId = groups[i];
      const members = [studentUsers[i], studentUsers[(i + 1) % studentUsers.length], studentUsers[(i + 2) % studentUsers.length]];
      for (let m = 0; m < members.length; m++) {
        await ctx.db.insert("groupMembers", {
          groupId,
          userId: members[m]._id,
          role: m === 0 ? "admin" : "member",
          joinedAt: Date.now() - (m + 1) * 1000,
          status: "active",
        });
        groupMembersCount += 1;
      }

      for (let msg = 0; msg < 4; msg++) {
        await ctx.db.insert("groupMessages", {
          groupId,
          senderId: members[msg % members.length]._id,
          content: msg === 0
            ? "Hey everyone, let's shortlist two places this week and compare commute times."
            : `Quick update ${msg + 1}: I found another option with in-unit laundry and better parking.`,
          messageType: "text",
        });
        groupMessagesCount += 1;
      }

      const sharedId = await ctx.db.insert("groupSharedListings", {
        groupId,
        listingId: listings[i],
        sharedBy: members[0]._id,
        notes: "Looks promising based on budget and location.",
        status: i % 3 === 0 ? "proposed" : i % 3 === 1 ? "shortlisted" : "rejected",
      });
      sharedListings.push(sharedId);

      for (let v = 0; v < members.length; v++) {
        await ctx.db.insert("groupListingVotes", {
          sharedListingId: sharedId,
          userId: members[v]._id,
          vote: v === 0 ? "interested" : v === 1 ? "neutral" : "not_interested",
          comment: v === 0 ? "Great fit for our budget." : v === 1 ? "Could work if commute is manageable." : "Not ideal for my schedule.",
        });
      }
    }

    for (let i = 0; i < 20; i++) {
      const reporter = studentUsers[i % studentUsers.length];
      if (i % 2 === 0) {
        const listing = listings[i % listings.length];
        await ctx.db.insert("reports", {
          reporterId: reporter._id,
          targetType: "listing",
          targetId: `listing:${listing}`,
          reason: i % 4 === 0 ? "spam" : "misleading_listing",
          description: `Listing details did not match expected amenities for report #${i + 1}.`,
          status: i % 3 === 0 ? "pending" : i % 3 === 1 ? "reviewed" : "resolved",
        });
      } else {
        const target = studentUsers[(i + 3) % studentUsers.length];
        await ctx.db.insert("reports", {
          reporterId: reporter._id,
          targetType: "user",
          targetId: `user:${target._id}`,
          reason: i % 3 === 0 ? "harassment" : "fake_profile",
          description: `User conduct issue documented in moderation report #${i + 1}.`,
          status: i % 3 === 0 ? "pending" : i % 3 === 1 ? "reviewed" : "resolved",
        });
      }
    }

    const contactInfoCount = (await ctx.db.query("contactInfo").collect()).length;
    const studentProfileCount = (await ctx.db.query("studentProfiles").collect()).length;
    const listingImageCount = (await ctx.db.query("listingImages").collect()).length;
    const voteCount = (await ctx.db.query("groupListingVotes").collect()).length;
    const reportCount = (await ctx.db.query("reports").collect()).length;
    const settingsCount = (await ctx.db.query("userSettings").collect()).length;

    return {
      message: "Database reset and sample data populated successfully.",
      credentials: {
        admin: { email: "group40@admin.com", password: PASSWORDS.admin },
        user: { email: "group40@user.com", password: PASSWORDS.user },
        provider: { email: "group40@provider.com", password: PASSWORDS.provider },
      },
      counts: {
        users: users.length,
        colleges: COLLEGES.length,
        contactInfo: contactInfoCount,
        userPhotos: 0,
        studentProfiles: studentProfileCount,
        providerProfiles: providerProfiles.length,
        roommateProfiles: roommateProfiles.length,
        roommateMatches: matches.length,
        apartmentListings: listings.length,
        listingImages: listingImageCount,
        savedListings: savedCount,
        roommateGroups: groups.length,
        groupMembers: groupMembersCount,
        groupMessages: groupMessagesCount,
        groupSharedListings: sharedListings.length,
        groupListingVotes: voteCount,
        reports: reportCount,
        userSettings: settingsCount,
      },
    };
}

export const resetAndSeedCore = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await runSeed(ctx);
  },
});

export const resetAndSeedAll = internalAction({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return await ctx.runMutation(internal.seed.resetAndSeedCore, {});
  },
});

export const seedAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await runSeed(ctx);
  },
});
