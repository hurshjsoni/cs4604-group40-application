# ARFinder Database Design (CS4604)

## 1. System Overview

This project uses **Convex** as the operational database and server function runtime.
The data model is designed around:

- Identity and role separation (`users`, `studentProfiles`, `providerProfiles`).
- Marketplace listing workflows (`apartmentListings`, `listingImages`, `savedListings`).
- Roommate discovery and social collaboration (`roommateProfiles`, `roommateMatches`, groups and messages).
- Safety and moderation (`reports`).

## 2. Schema Structure

Primary schema file: `convex/schema.ts`

### 2.1 Core identity

- `users`: canonical identity, role, verification, auth token mapping.
- `userSettings`: per-user visibility and notification preferences.
- `contactInfo`: one-to-many contact methods with privacy flags.
- `userPhotos`: one-to-many ordered profile photos.

### 2.2 Reference data

- `colleges`: normalized college lookup table referenced by multiple domains.

### 2.3 Role-based profiles

- `studentProfiles`: academic metadata.
- `providerProfiles`: listing provider metadata and college coverage.
- `roommateProfiles`: roommate preference/lifestyle data.

### 2.4 Listings and interest graph

- `apartmentListings`: core listing entity authored by providers.
- `listingImages`: one-to-many ordered listing media.
- `savedListings`: user-to-listing relationship with consent state.

### 2.5 Matching and collaboration

- `roommateMatches`: directed match records with status and breakdown.
- `roommateGroups`: group planning entity.
- `groupMembers`: membership records with role and lifecycle status.
- `groupMessages`: chat/system messages.
- `groupSharedListings`: listing proposals in group context.
- `groupListingVotes`: per-user vote on shared listings.

### 2.6 Moderation

- `reports`: user-generated moderation records targeting users/listings.

## 3. Normalization Rationale

- **3NF-oriented** design: user identity is separated from role-specific attributes.
- Colleges are normalized into a reference table and linked by ID.
- Contact records and photos are decomposed into child tables for one-to-many modeling.
- Group collaboration entities are decomposed into independent relation tables (`groupMembers`, `groupSharedListings`, `groupListingVotes`) to avoid embedded arrays with poor queryability.
- Academic-major data is normalized to `studentProfiles.major` (and intentionally not duplicated in `roommateProfiles.lifestyle`) to avoid update anomalies.

## 4. Relationship Mapping

- `users` 1:N `contactInfo`
- `users` 1:N `userPhotos`
- `users` 1:1 (logical) `userSettings`
- `users` 1:1 (logical, by role) `studentProfiles` / `providerProfiles` / `roommateProfiles`
- `providerProfiles` 1:N `apartmentListings`
- `apartmentListings` 1:N `listingImages`
- `users` N:M `apartmentListings` via `savedListings`
- `users` N:M `roommateGroups` via `groupMembers`
- `roommateGroups` 1:N `groupMessages`
- `roommateGroups` N:M `apartmentListings` via `groupSharedListings`
- `groupSharedListings` N:M `users` via `groupListingVotes`

## 5. Index Strategy

Key indexes are defined for:

- Authentication and identity lookup (`users.by_token`, `users.by_email`).
- Ownership lookups (`providerProfiles.by_user`, `studentProfiles.by_user`, `roommateProfiles.by_user`).
- High-frequency listing access (`apartmentListings.by_active`, `apartmentListings.by_provider`).
- Uniqueness-by-contract paths (`savedListings.by_user_listing`, `groupMembers.by_group_user`, `groupSharedListings.by_group_listing`, `groupListingVotes.by_shared_listing_user`).
- Message feed access (`groupMessages.by_group`, `groupMessages.by_group_type`).
- Moderation filtering (`reports.by_status`, `reports.by_target`).

## 6. Constraint Enforcement

Constraints are enforced through:

- Convex validators (`v.*`) in schema and mutation args.
- Shared runtime validators in `convex/validation.ts`:
  - non-empty string checks
  - max-length checks
  - non-negative numeric checks
  - range-order checks
  - date sanity checks
  - normalized string/email handling
- Role guards via `requireAuthedUserWithRole` to prevent cross-role writes.

## 7. Pagination Strategy

To avoid unbounded reads on browse workloads, paginated endpoints are provided:

- `apartmentListings.listPaginated`
- `roommateProfiles.listActivePaginated`

Both use Convex `paginationOptsValidator` and return `paginate`-shaped results for infinite scroll.

## 8. Referential Integrity Program

Integrity operations are formalized in `convex/dataIntegrity.ts`:

- `audit` (internal query): scans for orphaned references and duplicate logical keys.
- `repair` (internal mutation): performs safe cleanup:
  - removes orphaned rows
  - de-duplicates one-to-one logical tables
  - normalizes invalid foreign-key arrays by dropping missing references

This provides a repeatable integrity workflow for grading/demo and production hygiene.

## 9. Security and Access Design

- All write endpoints require authenticated identity.
- Sensitive write paths are role-gated (`student` vs `provider`).
- Moderation-only report status operations are internal-only.
- Contact visibility is enforced via `userSettings.showContactInfo` and ownership rules.

## 10. Known Tradeoffs

- Convex does not provide SQL-style declarative foreign keys or unique constraints; logical uniqueness is enforced with indexed lookups and guarded mutations.
- Some rich filters still run as post-query filter passes after indexed narrowing; paginated endpoints are the preferred production path.
