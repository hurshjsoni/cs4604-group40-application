"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ListingForm } from "@/app/components/ListingForm";
import Link from "next/link";

export default function CreateListingPage() {
  const router = useRouter();
  const createListing = useMutation(api.apartmentListings.create);
  const saveImage = useMutation(api.listingImages.saveImage);
  const providerProfile = useQuery(api.providerProfiles.getMyProfile);

  const isProfileComplete =
    providerProfile &&
    !!providerProfile.companyName &&
    !!providerProfile.description &&
    !!providerProfile.address;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
          <Building2 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="font-semibold">Create Listing</h1>
          <p className="text-sm text-muted-foreground">Add a new apartment listing</p>
        </div>
      </div>

      {providerProfile === undefined ? null : !isProfileComplete ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h2 className="mb-1 text-lg font-semibold">Complete Your Profile First</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Before creating a listing, please complete your provider profile, including your company name,
            description, and business address.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Profile
          </Link>
        </div>
      ) : (
      <ListingForm
        submitLabel="Create Listing"
        successLabel="Created!"
        onSubmit={async ({ listing, amenities, collegeIds, newStorageIds, links }) => {
          const listingId = await createListing({
            title: listing.title,
            description: listing.description,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zipCode: listing.zipCode,
            rent: parseFloat(listing.rent),
            rentType: listing.rentType,
            securityDeposit: listing.securityDeposit ? parseFloat(listing.securityDeposit) : undefined,
            bedrooms: parseInt(listing.bedrooms),
            bathrooms: parseFloat(listing.bathrooms),
            squareFeet: listing.squareFeet ? parseInt(listing.squareFeet) : undefined,
            availableFrom: listing.availableFrom,
            leaseLength: listing.leaseLength ? parseInt(listing.leaseLength) : undefined,
            petPolicy: listing.petPolicy,
            utilities: listing.utilities,
            parking: listing.parking,
            amenities,
            collegeIds: collegeIds as Id<"colleges">[],
            links,
            notes: listing.notes || undefined,
          });

          // Save each uploaded image to the listing
          for (let i = 0; i < newStorageIds.length; i++) {
            await saveImage({
              listingId,
              storageId: newStorageIds[i] as Id<"_storage">,
              sortOrder: i,
            });
          }

          toast.success("Listing created!");
          router.push("/my-listings");
        }}
      />
      )}
    </div>
  );
}
