"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ListingForm, type ListingFormData } from "@/app/components/ListingForm";

export default function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const listing = useQuery(api.apartmentListings.getById, {
    listingId: id as Id<"apartmentListings">,
  });
  const updateListing = useMutation(api.apartmentListings.update);
  const saveImage = useMutation(api.listingImages.saveImage);
  const removeImage = useMutation(api.listingImages.removeImage);

  if (listing === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
        <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-bold">Listing Not Found</h2>
        <p className="mb-4 text-muted-foreground">This listing may have been removed</p>
        <Link href="/my-listings">
          <Button size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Listings
          </Button>
        </Link>
      </div>
    );
  }

  const initialData: ListingFormData = {
    title: listing.title ?? "",
    description: listing.description ?? "",
    address: listing.address ?? "",
    city: listing.city ?? "",
    state: listing.state ?? "VA",
    zipCode: listing.zipCode ?? "",
    rent: listing.rent?.toString() ?? "",
    rentType: listing.rentType ?? "entire_unit",
    securityDeposit: listing.securityDeposit?.toString() ?? "",
    bedrooms: listing.bedrooms?.toString() ?? "",
    bathrooms: listing.bathrooms?.toString() ?? "",
    squareFeet: listing.squareFeet?.toString() ?? "",
    availableFrom: listing.availableFrom ?? "",
    leaseLength: listing.leaseLength?.toString() ?? "12",
    petPolicy: listing.petPolicy ?? "not_allowed",
    utilities: listing.utilities ?? "not_included",
    parking: listing.parking ?? "available",
    notes: listing.notes ?? "",
  };

  // imageRecords is an array of { _id, url } from the resolved listing
  const initialImageRecords = (listing.imageRecords ?? []).map((img: { _id: string; url: string; storageId?: string; sortOrder: number }) => ({
    _id: img._id,
    url: img.url,
  }));

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
          <h1 className="font-semibold">Edit Listing</h1>
          <p className="text-sm text-muted-foreground">{listing.title}</p>
        </div>
      </div>

      <ListingForm
        initialData={initialData}
        initialAmenities={listing.amenities ?? []}
        initialColleges={(listing.collegeIds ?? []).map((id) => id.toString())}
        initialLinks={listing.links ?? []}
        initialImageRecords={initialImageRecords}
        submitLabel="Save Changes"
        successLabel="Saved!"
        onSubmit={async ({ listing: form, amenities, collegeIds, newStorageIds, removedImageIds, links }) => {
          await updateListing({
            listingId: id as Id<"apartmentListings">,
            title: form.title,
            description: form.description,
            address: form.address,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
            rent: parseFloat(form.rent),
            rentType: form.rentType,
            securityDeposit: form.securityDeposit ? parseFloat(form.securityDeposit) : undefined,
            bedrooms: parseInt(form.bedrooms),
            bathrooms: parseFloat(form.bathrooms),
            squareFeet: form.squareFeet ? parseInt(form.squareFeet) : undefined,
            availableFrom: form.availableFrom,
            leaseLength: form.leaseLength ? parseInt(form.leaseLength) : undefined,
            petPolicy: form.petPolicy,
            utilities: form.utilities,
            parking: form.parking,
            amenities,
            collegeIds: collegeIds as Id<"colleges">[],
            links,
            notes: form.notes || undefined,
          });

          // Remove images the user deleted
          for (const imgId of removedImageIds) {
            await removeImage({ imageId: imgId as Id<"listingImages"> });
          }

          // Save newly uploaded images
          const existingCount = initialImageRecords.length - removedImageIds.length;
          for (let i = 0; i < newStorageIds.length; i++) {
            await saveImage({
              listingId: id as Id<"apartmentListings">,
              storageId: newStorageIds[i] as Id<"_storage">,
              sortOrder: existingCount + i,
            });
          }

          toast.success("Listing updated!");
          router.push("/my-listings");
        }}
      />
    </div>
  );
}
