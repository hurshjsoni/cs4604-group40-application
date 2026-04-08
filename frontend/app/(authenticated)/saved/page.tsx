"use client";

import Link from "next/link";
import { Heart, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "../../components/ListingCard";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export default function SavedPage() {
  const savedData = useQuery(api.savedListings.getByUser);
  const loading = savedData === undefined;

  const savedListings = (savedData ?? []).filter(isPresent);
  const listingsWithDetails = savedListings.filter((s) => s.listing !== null);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={Heart}
        title="Saved Listings"
        subtitle={loading ? "Loading…" : `${listingsWithDetails.length} apartments saved`}
        color="red"
      />

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : listingsWithDetails.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listingsWithDetails.map((saved) =>
            saved.listing ? <ListingCard key={saved._id} listing={saved.listing} /> : null,
          )}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="No saved listings yet"
          description="Start browsing and save apartments you're interested in for quick access later."
          action={
            <Link href="/apartments">
              <Button size="lg" className="gap-2">
                <Building2 className="h-5 w-5" />
                Browse Apartments
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
