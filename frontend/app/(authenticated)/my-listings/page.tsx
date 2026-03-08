"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  PlusCircle,
  Eye,
  Edit,
  Trash,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Bed,
  Bath,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import type { MyListing } from "@/lib/types";
import { PageHeader } from "@/app/components/PageHeader";
import { EmptyState } from "@/app/components/EmptyState";

export default function MyListingsPage() {
  const rawListings = useQuery(api.apartmentListings.getMyListings);
  const loading = rawListings === undefined;
  const listings = rawListings ?? [];
  const toggleActive = useMutation(api.apartmentListings.toggleActive);
  const removeListing = useMutation(api.apartmentListings.remove);
  const [removing, setRemoving] = useState<string | null>(null);

  // Confirm-delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const typedListings = listings as MyListing[];
  const activeCount = typedListings.filter((l) => l.isActive).length;
  const hiddenCount = typedListings.filter((l) => !l.isActive).length;

  const handleToggle = async (listingId: string, isActive: boolean) => {
    try {
      await toggleActive({ listingId: listingId as Id<"apartmentListings">, isActive: !isActive });
      toast.success(isActive ? "Listing hidden." : "Listing made active.");
    } catch {
      toast.error("Failed to update listing status.");
    }
  };

  const handleRemoveConfirmed = async () => {
    if (!deleteTarget) return;
    setRemoving(deleteTarget.id);
    try {
      await removeListing({ listingId: deleteTarget.id as Id<"apartmentListings"> });
      toast.success("Listing deleted.");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete listing.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={Building2}
        title="My Listings"
        subtitle={`${typedListings.length} total listing${typedListings.length !== 1 ? "s" : ""}`}
        color="blue"
        action={
          <Link href="/my-listings/create">
            <Button size="sm" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Listing
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{hiddenCount}</p>
            <p className="text-sm text-muted-foreground">Hidden</p>
          </CardContent>
        </Card>
      </div>

      {/* Listings Grid */}
      {typedListings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {typedListings.map((listing) => (
            <Card key={listing._id} className="overflow-hidden pt-0 transition-all hover:shadow-md">
              {/* Image */}
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                {listing.images?.[0] ? (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Building2 className="h-8 w-8" />
                  </div>
                )}
                {/* Price badge top-right */}
                <div className="absolute right-3 top-3 flex flex-col gap-1 items-end">
                  <Badge className="bg-background/90 font-semibold text-foreground backdrop-blur-sm">
                    ${listing.rent}/mo
                  </Badge>
                  <Badge className={`text-xs ${listing.isActive ? "bg-green-600/90 text-white" : "bg-muted/90 text-muted-foreground"} backdrop-blur-sm`}>
                    {listing.isActive ? "Active" : "Hidden"}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="mb-1 line-clamp-1 font-semibold">{listing.title}</h3>

                <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{listing.address}, {listing.city}</span>
                </div>

                <div className="mb-4 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Bed className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} BR`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bath className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{listing.bathrooms} BA</span>
                  </div>
                </div>

                {/* Compact action row */}
                <div className="flex items-center gap-1 border-t border-border pt-3">
                  <Link href={`/apartments/${listing._id}`} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Link>
                  <Link href={`/my-listings/${listing._id}/edit`} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground hover:text-foreground">
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => handleToggle(listing._id, listing.isActive)}
                  >
                    {listing.isActive ? (
                      <><ToggleRight className="h-3.5 w-3.5 text-green-600" /> Hide</>
                    ) : (
                      <><ToggleLeft className="h-3.5 w-3.5" /> Show</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1.5 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget({ id: listing._id, title: listing.title })}
                  >
                    <Trash className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No listings yet"
          description="Create your first listing to start receiving interest from students."
          action={
            <Link href="/my-listings/create">
              <Button size="lg" className="gap-2">
                <PlusCircle className="h-5 w-5" />
                Create Your First Listing
              </Button>
            </Link>
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete listing?"
        description={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        loading={!!removing}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
