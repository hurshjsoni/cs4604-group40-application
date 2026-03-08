"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "../../../../components/VerifiedBadge";
import { ContactInfoDisplay } from "../../../../components/ContactInfoDisplay";
import { ListingCard } from "../../../../components/ListingCard";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ContactInfo } from "@/lib/types";

export default function ProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = use(params);
  const router = useRouter();

  const provider = useQuery(api.providerProfiles.getById, {
    profileId: providerId as Id<"providerProfiles">,
  });

  const allListings = useQuery(api.apartmentListings.getByProvider, {
    providerId: providerId as Id<"providerProfiles">,
  });

  const contacts = useQuery(
    api.contactInfo.getByUser,
    provider?.userId ? { userId: provider.userId as Id<"users"> } : "skip",
  );

  if (provider === undefined || allListings === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
        <h2 className="mb-4 text-xl font-bold">Provider Not Found</h2>
        <Link href="/apartments">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Apartments
          </Button>
        </Link>
      </div>
    );
  }

  const activeListings = (allListings ?? [])
    .filter((l) => l.isActive)
    .map((l) => ({
      ...l,
      colleges: l.colleges.filter((c): c is NonNullable<typeof c> => c !== null),
      provider,
      contacts: [] as ContactInfo[],
    }));
  const publicContacts = ((contacts ?? []) as ContactInfo[]).filter((c) => c.isPublic);

  return (
    <div className="p-4 lg:p-6">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Provider Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-10 w-10" />
            </div>
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{provider.companyName}</h1>
                {provider.verified && <VerifiedBadge type="business" />}
              </div>
              {provider.description && (
                <p className="mb-4 text-muted-foreground">{provider.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                {provider.address && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {provider.address}
                  </div>
                )}
                {provider.website && (
                  <a
                    href={provider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <Badge variant="secondary" className="text-sm">
                {provider.totalListings} Listings
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Listings */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">
            Available Listings ({activeListings.length})
          </h2>
          {activeListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeListings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No active listings</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contact */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {publicContacts.length > 0 ? (
                <ContactInfoDisplay contacts={publicContacts} />
              ) : (
                <p className="text-sm text-muted-foreground">No public contact info available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
