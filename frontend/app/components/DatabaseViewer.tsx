"use client";

import { FormEvent, useState } from "react";
import { anyApi } from "convex/server";
import { useQuery } from "convex/react";
import { ChevronDown, Database, ImageIcon, Key, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

type TableRows = Record<string, unknown[]>;

type DbSnapshot = {
  generatedAt: string;
  tables: TableRows;
};

type TableSectionProps = {
  defaultOpen?: boolean;
  rows: unknown[];
  tableName: string;
};

const DB_ACCESS_CODE = "4604";
const DB_DIAGRAM_URL = "/er-diagram.svg";
const DB_DIAGRAM_SVG_URL = DB_DIAGRAM_URL;
const DB_DIAGRAM_WIDTH = 7268.75;
const DB_DIAGRAM_HEIGHT = 1960;

function parseSvgLength(value: string | null) {
  if (!value) return NaN;
  return Number.parseFloat(value);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.click();
}

async function saveDiagramAsPng() {
  const response = await fetch(DB_DIAGRAM_SVG_URL);
  if (!response.ok) {
    throw new Error("Failed to download ER diagram SVG.");
  }

  const svgText = await response.text();
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
  const svgElement = svgDoc.documentElement;
  const viewBox = svgElement.getAttribute("viewBox")?.split(/\s+/).map(Number) ?? [];
  const widthAttr = parseSvgLength(svgElement.getAttribute("width"));
  const heightAttr = parseSvgLength(svgElement.getAttribute("height"));
  const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : viewBox[2];
  const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : viewBox[3];

  if (!width || !height) {
    throw new Error("Could not determine ER diagram size.");
  }

  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to render ER diagram."));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas export is unavailable.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    triggerDownload(canvas.toDataURL("image/png"), "er-diagram.png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function formatCellValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function getTableColumns(rows: unknown[]) {
  const columns = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }

  return Array.from(columns).sort((a, b) => a.localeCompare(b));
}

function TableSection({ defaultOpen = false, rows, tableName }: TableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const columns = getTableColumns(rows);

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open);
      }}
      className="group overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm"
    >
      <summary className="list-none cursor-pointer px-4 py-3.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-5 text-foreground">{tableName}</h2>
              <p className="text-xs text-muted-foreground">
                {rows.length} rows
                {columns.length > 0 ? ` • ${columns.length} columns` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-border bg-background/80 p-1.5 text-muted-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </summary>

      <div className="border-t border-border/70 px-4 pb-4 pt-3">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border bg-muted/40 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {tableName}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-5 text-sm text-muted-foreground">
              No rows in this table.
            </div>
          ) : columns.length === 0 ? (
            <div className="px-3 py-5 text-sm text-muted-foreground">
              This table contains rows that could not be rendered as objects.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="border-b border-border px-2 py-1.5 align-top font-semibold text-foreground"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const record =
                      row && typeof row === "object" && !Array.isArray(row)
                        ? (row as Record<string, unknown>)
                        : {};

                    return (
                      <tr key={rowIndex} className="odd:bg-background even:bg-muted/20">
                        {columns.map((column) => (
                          <td
                            key={`${rowIndex}-${column}`}
                            className="max-w-[240px] border-b border-border/70 px-2 py-1.5 align-top text-muted-foreground"
                          >
                            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-4">
                              {formatCellValue(record[column])}
                            </pre>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/* ─── Entity Schema Reference ──────────────────────────────────────── */

type ColumnDef = {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string; // "referenced_table._id"
  nullable?: boolean;
  description?: string;
};

type EntitySchema = {
  table: string;
  description: string;
  columns: ColumnDef[];
};

const ENTITY_SCHEMAS: EntitySchema[] = [
  {
    table: "users",
    description: "Core identity table for all application users (students, providers, admins).",
    columns: [
      { name: "_id", type: "Id<users>", pk: true, description: "Auto-generated unique identifier" },
      { name: "email", type: "string", description: "User email address (indexed, unique per identity)" },
      { name: "name", type: "string", description: "Display name" },
      { name: "role", type: "\"student\" | \"provider\" | \"admin\"", description: "User type / access tier" },
      { name: "isVerified", type: "boolean", description: "Whether user has a .edu email" },
      { name: "avatarUrl", type: "string", nullable: true, description: "Profile picture URL" },
      { name: "onboardingComplete", type: "boolean", description: "Whether user finished onboarding" },
      { name: "tokenIdentifier", type: "string", description: "Auth provider identity link" },
    ],
  },
  {
    table: "contactInfo",
    description: "Contact details associated with a user (email, phone, social media, etc.).",
    columns: [
      { name: "_id", type: "Id<contactInfo>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Owner of this contact entry" },
      { name: "type", type: "\"email\" | \"phone\" | \"instagram\" | …", description: "Contact channel type" },
      { name: "value", type: "string", description: "Contact handle or number" },
      { name: "customLabel", type: "string", nullable: true, description: "Optional display label" },
      { name: "isPublic", type: "boolean", description: "Whether other users can see this contact" },
    ],
  },
  {
    table: "userPhotos",
    description: "Profile photos uploaded by users, ordered by sortOrder.",
    columns: [
      { name: "_id", type: "Id<userPhotos>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Photo owner" },
      { name: "storageId", type: "Id<_storage>", description: "Convex file storage reference" },
      { name: "url", type: "string", description: "Public URL of the image" },
      { name: "sortOrder", type: "number", description: "Display ordering index" },
    ],
  },
  {
    table: "colleges",
    description: "Reference table of supported colleges / universities.",
    columns: [
      { name: "_id", type: "Id<colleges>", pk: true, description: "Auto-generated unique identifier" },
      { name: "slug", type: "string", description: "URL-friendly identifier (e.g., \"vt\")" },
      { name: "name", type: "string", description: "Full college name" },
      { name: "shortName", type: "string", description: "Abbreviation (e.g., \"VT\")" },
      { name: "location", type: "string", description: "City and state" },
    ],
  },
  {
    table: "studentProfiles",
    description: "Academic profile for students, linked to a college.",
    columns: [
      { name: "_id", type: "Id<studentProfiles>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Student user" },
      { name: "collegeId", type: "Id<colleges>", fk: "colleges._id", nullable: true, description: "Enrolled college" },
      { name: "graduationYear", type: "number", nullable: true, description: "Expected graduation year" },
      { name: "major", type: "string", nullable: true, description: "Field of study" },
    ],
  },
  {
    table: "providerProfiles",
    description: "Housing provider / property management company profile.",
    columns: [
      { name: "_id", type: "Id<providerProfiles>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Provider user account" },
      { name: "companyName", type: "string", description: "Business name" },
      { name: "description", type: "string", nullable: true, description: "Company description" },
      { name: "website", type: "string", nullable: true, description: "Company website URL" },
      { name: "phone", type: "string", nullable: true, description: "Business phone number" },
      { name: "address", type: "string", nullable: true, description: "Business address" },
      { name: "verified", type: "boolean", description: "Admin-verified provider status" },
      { name: "collegeIds", type: "Id<colleges>[]", fk: "colleges._id", description: "Colleges this provider serves" },
    ],
  },
  {
    table: "roommateProfiles",
    description: "Roommate-seeking preferences and lifestyle details for students.",
    columns: [
      { name: "_id", type: "Id<roommateProfiles>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Student user" },
      { name: "collegeId", type: "Id<colleges>", fk: "colleges._id", nullable: true, description: "Target college area" },
      { name: "budgetMin", type: "number", nullable: true, description: "Minimum monthly budget" },
      { name: "budgetMax", type: "number", nullable: true, description: "Maximum monthly budget" },
      { name: "preferredLocations", type: "string[]", description: "Desired neighborhoods / areas" },
      { name: "moveInDate", type: "string", nullable: true, description: "Target move-in date" },
      { name: "moveInFlexibility", type: "enum", nullable: true, description: "How flexible the move-in date is" },
      { name: "leaseDuration", type: "enum", nullable: true, description: "Preferred lease length" },
      { name: "lifestyle", type: "object", description: "Sleep, cleanliness, social, and other habits" },
      { name: "bio", type: "string", nullable: true, description: "Free-form self-description" },
      { name: "dealBreakers", type: "string[]", description: "Hard requirements for a roommate" },
      { name: "isActive", type: "boolean", description: "Whether actively looking for roommates" },
      { name: "lookingFor", type: "enum", nullable: true, description: "Single or multiple roommates" },
      { name: "gender", type: "enum", nullable: true, description: "User's gender" },
      { name: "genderPreference", type: "enum", nullable: true, description: "Preferred roommate gender" },
      { name: "aboutMeTags", type: "string[]", description: "Quick self-description tags" },
      { name: "roommatePreferences", type: "string[]", description: "Desired roommate qualities" },
    ],
  },
  {
    table: "roommateMatches",
    description: "Computed or manual roommate compatibility matches between two students.",
    columns: [
      { name: "_id", type: "Id<roommateMatches>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "First user in the match" },
      { name: "matchedUserId", type: "Id<users>", fk: "users._id", description: "Second user in the match" },
      { name: "compatibilityScore", type: "number", description: "Overall compatibility percentage" },
      { name: "matchBreakdown", type: "object", description: "Detailed score breakdown by category" },
      { name: "status", type: "\"suggested\" | \"pending\" | \"accepted\" | \"declined\"", description: "Current match state" },
      { name: "matchType", type: "\"smart\" | \"manual\"", description: "How the match was created" },
    ],
  },
  {
    table: "apartmentListings",
    description: "Apartment or housing units listed by providers.",
    columns: [
      { name: "_id", type: "Id<apartmentListings>", pk: true, description: "Auto-generated unique identifier" },
      { name: "providerId", type: "Id<providerProfiles>", fk: "providerProfiles._id", description: "Listing owner (provider)" },
      { name: "title", type: "string", description: "Listing headline" },
      { name: "description", type: "string", description: "Detailed description" },
      { name: "address", type: "string", description: "Street address" },
      { name: "city", type: "string", description: "City" },
      { name: "state", type: "string", description: "State" },
      { name: "zipCode", type: "string", description: "Zip / postal code" },
      { name: "rent", type: "number", description: "Monthly rent amount" },
      { name: "rentType", type: "\"entire_unit\" | \"per_bed\" | \"per_person\"", description: "How rent is structured" },
      { name: "securityDeposit", type: "number", nullable: true, description: "Security deposit amount" },
      { name: "bedrooms", type: "number", description: "Number of bedrooms" },
      { name: "bathrooms", type: "number", description: "Number of bathrooms" },
      { name: "squareFeet", type: "number", nullable: true, description: "Unit size in sq ft" },
      { name: "availableFrom", type: "string", description: "Earliest availability date" },
      { name: "leaseLength", type: "number", nullable: true, description: "Lease duration in months" },
      { name: "petPolicy", type: "enum", nullable: true, description: "Pet allowance policy" },
      { name: "utilities", type: "enum", nullable: true, description: "Utilities inclusion policy" },
      { name: "parking", type: "enum", nullable: true, description: "Parking availability" },
      { name: "amenities", type: "string[]", description: "List of amenities" },
      { name: "collegeIds", type: "Id<colleges>[]", fk: "colleges._id", description: "Nearby colleges" },
      { name: "links", type: "object[]", description: "External links (label + URL)" },
      { name: "notes", type: "string", nullable: true, description: "Additional provider notes" },
      { name: "isActive", type: "boolean", description: "Whether listing is published" },
      { name: "updatedAt", type: "number", description: "Last update timestamp" },
    ],
  },
  {
    table: "listingImages",
    description: "Images associated with apartment listings.",
    columns: [
      { name: "_id", type: "Id<listingImages>", pk: true, description: "Auto-generated unique identifier" },
      { name: "listingId", type: "Id<apartmentListings>", fk: "apartmentListings._id", description: "Parent listing" },
      { name: "storageId", type: "Id<_storage>", nullable: true, description: "Convex storage reference" },
      { name: "url", type: "string", description: "Public image URL" },
      { name: "sortOrder", type: "number", description: "Display ordering index" },
    ],
  },
  {
    table: "savedListings",
    description: "Bookmarked / saved listings by students.",
    columns: [
      { name: "_id", type: "Id<savedListings>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Student who saved the listing" },
      { name: "listingId", type: "Id<apartmentListings>", fk: "apartmentListings._id", description: "Saved listing" },
      { name: "consentGiven", type: "boolean", nullable: true, description: "Whether student consented to share info with provider" },
    ],
  },
  {
    table: "roommateGroups",
    description: "Groups of students collaborating to find shared housing.",
    columns: [
      { name: "_id", type: "Id<roommateGroups>", pk: true, description: "Auto-generated unique identifier" },
      { name: "name", type: "string", description: "Group display name" },
      { name: "createdBy", type: "Id<users>", fk: "users._id", description: "User who created the group" },
      { name: "status", type: "\"searching\" | \"found_place\" | \"confirmed\" | \"disbanded\"", description: "Current group stage" },
      { name: "targetBudgetMin", type: "number", nullable: true, description: "Group minimum budget" },
      { name: "targetBudgetMax", type: "number", nullable: true, description: "Group maximum budget" },
      { name: "targetMoveIn", type: "string", nullable: true, description: "Target move-in date" },
      { name: "targetLocation", type: "string", nullable: true, description: "Preferred area" },
      { name: "notes", type: "string", nullable: true, description: "Group notes / goals" },
    ],
  },
  {
    table: "groupMembers",
    description: "Membership junction table linking users to roommate groups.",
    columns: [
      { name: "_id", type: "Id<groupMembers>", pk: true, description: "Auto-generated unique identifier" },
      { name: "groupId", type: "Id<roommateGroups>", fk: "roommateGroups._id", description: "Parent group" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Member user" },
      { name: "role", type: "\"admin\" | \"member\"", description: "Member privilege level in the group" },
      { name: "joinedAt", type: "number", description: "Timestamp when user joined" },
      { name: "status", type: "\"active\" | \"left\" | \"kicked\"", description: "Current membership status" },
    ],
  },
  {
    table: "groupMessages",
    description: "Chat messages within a roommate group.",
    columns: [
      { name: "_id", type: "Id<groupMessages>", pk: true, description: "Auto-generated unique identifier" },
      { name: "groupId", type: "Id<roommateGroups>", fk: "roommateGroups._id", description: "Parent group" },
      { name: "senderId", type: "Id<users>", fk: "users._id", description: "Message author" },
      { name: "content", type: "string", description: "Message text" },
      { name: "messageType", type: "\"text\" | \"system\"", description: "Human message or automated notice" },
    ],
  },
  {
    table: "groupSharedListings",
    description: "Apartment listings shared within a roommate group for collaborative review.",
    columns: [
      { name: "_id", type: "Id<groupSharedListings>", pk: true, description: "Auto-generated unique identifier" },
      { name: "groupId", type: "Id<roommateGroups>", fk: "roommateGroups._id", description: "Parent group" },
      { name: "listingId", type: "Id<apartmentListings>", fk: "apartmentListings._id", description: "Shared listing" },
      { name: "sharedBy", type: "Id<users>", fk: "users._id", description: "User who shared this listing" },
      { name: "notes", type: "string", nullable: true, description: "Sharer's notes" },
      { name: "status", type: "\"proposed\" | \"shortlisted\" | \"rejected\"", description: "Group consensus status" },
    ],
  },
  {
    table: "groupListingVotes",
    description: "Individual member votes on shared group listings.",
    columns: [
      { name: "_id", type: "Id<groupListingVotes>", pk: true, description: "Auto-generated unique identifier" },
      { name: "sharedListingId", type: "Id<groupSharedListings>", fk: "groupSharedListings._id", description: "The shared listing being voted on" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Voting member" },
      { name: "vote", type: "\"interested\" | \"neutral\" | \"not_interested\"", description: "Member's vote" },
      { name: "comment", type: "string", nullable: true, description: "Optional vote rationale" },
    ],
  },
  {
    table: "reports",
    description: "User-submitted moderation reports against listings or other users.",
    columns: [
      { name: "_id", type: "Id<reports>", pk: true, description: "Auto-generated unique identifier" },
      { name: "reporterId", type: "Id<users>", fk: "users._id", description: "User who filed the report" },
      { name: "targetType", type: "\"listing\" | \"user\"", description: "What is being reported" },
      { name: "targetId", type: "string", description: "Encoded reference (e.g., \"listing:<id>\")" },
      { name: "reason", type: "string", description: "Report category" },
      { name: "description", type: "string", nullable: true, description: "Detailed report narrative" },
      { name: "status", type: "\"pending\" | \"reviewed\" | \"resolved\"", description: "Moderation pipeline stage" },
    ],
  },
  {
    table: "userSettings",
    description: "Per-user application preferences and privacy controls.",
    columns: [
      { name: "_id", type: "Id<userSettings>", pk: true, description: "Auto-generated unique identifier" },
      { name: "userId", type: "Id<users>", fk: "users._id", description: "Settings owner" },
      { name: "showInBrowse", type: "boolean", description: "Appear in roommate browse results" },
      { name: "showContactInfo", type: "boolean", description: "Show contact info to other users" },
      { name: "emailNotifications", type: "boolean", description: "Receive email notifications" },
      { name: "matchNotifications", type: "boolean", description: "Receive match alerts" },
      { name: "messageNotifications", type: "boolean", description: "Receive message alerts" },
      { name: "theme", type: "\"light\" | \"dark\" | \"system\"", description: "UI theme preference" },
    ],
  },
];

function EntitySchemaSection({ entity }: { entity: EntitySchema }) {
  const [isOpen, setIsOpen] = useState(false);
  const pkCols = entity.columns.filter((c) => c.pk);
  const fkCols = entity.columns.filter((c) => c.fk);

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm"
    >
      <summary className="list-none cursor-pointer px-4 py-3.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-5 text-foreground">{entity.table}</h3>
              <p className="text-xs text-muted-foreground">
                {entity.columns.length} columns • {pkCols.length} PK • {fkCols.length} FK{fkCols.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fkCols.length > 0 && (
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                → {[...new Set(fkCols.map((c) => c.fk!.split(".")[0]))].join(", ")}
              </span>
            )}
            <div className="rounded-full border border-border bg-background/80 p-1.5 text-muted-foreground">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </div>
      </summary>

      <div className="border-t border-border/70 px-4 pb-4 pt-3">
        <p className="mb-3 text-xs text-muted-foreground">{entity.description}</p>
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[11px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground">Column</th>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground">Type</th>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground text-center">Key</th>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground text-center">Nullable</th>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground">References</th>
                  <th className="border-b border-border px-3 py-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {entity.columns.map((col) => (
                  <tr key={col.name} className="odd:bg-background even:bg-muted/20">
                    <td className="border-b border-border/70 px-3 py-2 align-top font-mono text-[11px] font-medium text-foreground">
                      {col.name}
                    </td>
                    <td className="border-b border-border/70 px-3 py-2 align-top font-mono text-[10px] text-muted-foreground">
                      {col.type}
                    </td>
                    <td className="border-b border-border/70 px-3 py-2 align-top text-center">
                      {col.pk && (
                        <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400">
                          PK
                        </span>
                      )}
                      {col.fk && (
                        <span className="inline-flex items-center rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-500/30 dark:text-blue-400">
                          FK
                        </span>
                      )}
                    </td>
                    <td className="border-b border-border/70 px-3 py-2 align-top text-center text-muted-foreground">
                      {col.nullable ? "Yes" : "No"}
                    </td>
                    <td className="border-b border-border/70 px-3 py-2 align-top font-mono text-[10px] text-blue-600 dark:text-blue-400">
                      {col.fk ?? "—"}
                    </td>
                    <td className="border-b border-border/70 px-3 py-2 align-top text-muted-foreground">
                      {col.description ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </details>
  );
}

type ErPhase = "phase2" | "phase3" | "final";

const ER_PHASE_LABELS: Record<ErPhase, string> = {
  phase2: "Phase 2",
  phase3: "Phase 3",
  final: "Final",
};

export function DatabaseViewer() {
  const [accessCode, setAccessCode] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isSavingDiagram, setIsSavingDiagram] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isSchemaRefOpen, setIsSchemaRefOpen] = useState(false);
  const [isTablesOpen, setIsTablesOpen] = useState(false);
  const [erPhase, setErPhase] = useState<ErPhase>("final");

  const snapshot = useQuery(anyApi.publicDbView.getAllAppTables, {}) as
    | DbSnapshot
    | undefined;

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const matches = accessCode.trim() === DB_ACCESS_CODE;
    setShowError(!matches);

    if (!matches) return;

    setHasAccess(true);
  };

  const handleSaveDiagramAsPng = async () => {
    if (isSavingDiagram) return;

    setIsSavingDiagram(true);
    try {
      await saveDiagramAsPng();
    } finally {
      setIsSavingDiagram(false);
    }
  };

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,rgba(217,119,6,0.07),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <section className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
                Restricted Access
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Database Information
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter the access code to view the Convex database information page.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleUnlock}>
              <div className="space-y-1.5">
                <label htmlFor="db-access-code" className="block text-sm font-medium">
                  Access code
                </label>
                <input
                  id="db-access-code"
                  type="password"
                  value={accessCode}
                  onChange={(event) => {
                    setAccessCode(event.target.value);
                    if (showError) setShowError(false);
                  }}
                  placeholder="Enter code"
                  className={`form-input bg-background ${showError ? "border-red-500 ring-2 ring-red-500/15" : ""}`}
                />
                {showError ? (
                  <p className="text-sm text-red-600">
                    Incorrect code. Try again.
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full sm:w-auto">
                Unlock
              </Button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (snapshot === undefined) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,rgba(217,119,6,0.07),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-border/70 bg-card/90 p-8 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">
              Database Information
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Loading production data from Convex...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const entries = Object.entries(snapshot.tables)
    .sort(([left], [right]) => left.localeCompare(right)) as [string, unknown[]][];
  const totalRows = entries.reduce((count, [, rows]) => count + rows.length, 0);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(217,119,6,0.07),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
                Public Convex Snapshot
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Database Information
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Tables
                </p>
                <p className="mt-1 text-2xl font-semibold">{entries.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Rows
                </p>
                <p className="mt-1 text-2xl font-semibold">{totalRows}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  FK Relations
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {ENTITY_SCHEMAS.reduce((sum, e) => sum + e.columns.filter((c) => c.fk).length, 0)}
                </p>
              </div>
              <div className="col-span-2 rounded-2xl border border-border bg-background/80 px-4 py-3 sm:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Generated
                </p>
                <p className="mt-1 text-sm font-medium leading-5">
                  {new Date(snapshot.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <details
            open={isDiagramOpen}
            onToggle={(event) => {
              setIsDiagramOpen(event.currentTarget.open);
            }}
            className="group overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm"
          >
            <summary className="list-none cursor-pointer px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">ER Diagram (UML)</h2>
                  <p className="text-sm text-muted-foreground">
                    {erPhase === "final"
                      ? "Final schema — all 18 entities"
                      : erPhase === "phase3"
                        ? "Phase 3 — added matching, groups, messaging"
                        : "Phase 2 — initial core entities"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Phase switcher */}
                  <div className="flex items-center rounded-lg border border-border bg-background/80 p-0.5 gap-0.5">
                    {(["phase2", "phase3", "final"] as ErPhase[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          setErPhase(p);
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          erPhase === p
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {ER_PHASE_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  {erPhase === "final" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        void handleSaveDiagramAsPng();
                      }}
                      disabled={isSavingDiagram}
                    >
                      <ImageIcon className="h-4 w-4" />
                      {isSavingDiagram ? "Saving..." : "Save PNG"}
                    </Button>
                  )}
                  {(erPhase === "phase2" || erPhase === "phase3") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        triggerDownload(`/${erPhase}-er-diagram.png`, `${erPhase}-er-diagram.png`);
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Save PNG
                    </Button>
                  )}
                  <div className="rounded-full border border-border bg-background/80 p-2 text-muted-foreground">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isDiagramOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
              </div>
            </summary>
            <div className="border-t border-border/70 bg-background p-3">
              {erPhase === "final" ? (
                <div className="overflow-x-auto">
                  <div
                    className="w-max"
                    style={{ minWidth: `${DB_DIAGRAM_WIDTH}px` }}
                  >
                    <img
                      alt="Final ER Diagram — all 18 entities"
                      src={DB_DIAGRAM_URL}
                      className="block rounded-xl border border-border bg-white"
                      style={{
                        width: `${DB_DIAGRAM_WIDTH}px`,
                        height: `${DB_DIAGRAM_HEIGHT}px`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <img
                    alt={`${ER_PHASE_LABELS[erPhase]} ER Diagram`}
                    src={`/${erPhase}-er-diagram.png`}
                    className="block rounded-xl border border-border bg-white max-w-full"
                  />
                </div>
              )}
            </div>
          </details>

          <details
            open={isSchemaRefOpen}
            onToggle={(event) => {
              setIsSchemaRefOpen(event.currentTarget.open);
            }}
            className="group overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm"
          >
            <summary className="list-none cursor-pointer px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Entity Schema Reference — Primary &amp; Foreign Keys</h2>
                  <p className="text-sm text-muted-foreground">
                    A table per entity showing all columns, primary keys (PK), and foreign key (FK) relationships
                  </p>
                </div>
                <div className="rounded-full border border-border bg-background/80 p-2 text-muted-foreground">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isSchemaRefOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            </summary>

            <div className="border-t border-border/70 px-4 pb-4 pt-4">
              <div className="mb-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400 mr-1.5">PK</span>
                  Primary Key — uniquely identifies each row.
                  <span className="mx-2 text-border">|</span>
                  <span className="inline-flex items-center rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-500/30 dark:text-blue-400 mr-1.5">FK</span>
                  Foreign Key — references another entity&apos;s primary key.
                  <span className="mx-2 text-border">|</span>
                  All tables include system-generated <code className="rounded bg-muted px-1 font-mono text-[10px]">_creationTime</code> (auto-populated timestamp).
                </p>
              </div>
              <div className="space-y-4">
                {ENTITY_SCHEMAS.map((entity) => (
                  <EntitySchemaSection key={entity.table} entity={entity} />
                ))}
              </div>
            </div>
          </details>

          <details
            open={isTablesOpen}
            onToggle={(event) => {
              setIsTablesOpen(event.currentTarget.open);
            }}
            className="group overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm"
          >
            <summary className="list-none cursor-pointer px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">All tables</h2>
                  <p className="text-sm text-muted-foreground">
                    Expand to browse all the tables in the Convex DB (live)
                  </p>
                </div>
                <div className="rounded-full border border-border bg-background/80 p-2 text-muted-foreground">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isTablesOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            </summary>

            <div className="border-t border-border/70 px-4 pb-4 pt-4">
              <div className="space-y-4">
                {entries.map(([tableName, rows]) => (
                  <TableSection
                    key={tableName}
                    tableName={tableName}
                    rows={rows}
                    defaultOpen={false}
                  />
                ))}
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
