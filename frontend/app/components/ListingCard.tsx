"use client";

import Link from "next/link";
import { MapPin, Bed, Bath, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "./VerifiedBadge";
import type { ApartmentListing } from "@/lib/types";

interface ListingCardProps {
  listing: ApartmentListing;
}

const rentTypeLabels: Record<string, string> = {
  entire_unit: "",
  per_bed: "/bed",
  per_person: "/person",
};

export function ListingCard({ listing }: ListingCardProps) {
  const { _id, title, rent, rentType, address, city, bedrooms, bathrooms, images, provider, availableFrom, colleges } = listing;

  const rentLabel = rentType === "entire_unit" ? "/mo" : `${rentTypeLabels[rentType] ?? ""}/mo`;

  return (
    <Card className="h-full overflow-hidden transition-all hover:shadow-lg hover:ring-2 hover:ring-primary/20 pt-0">
      {/* Image - links to listing detail */}
      <Link href={`/apartments/${_id}`}>
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {images?.[0] ? (
            <img
              src={images[0]}
              alt={title}
              className="h-full w-full object-cover transition-transform hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
          <div className="absolute right-3 top-3 flex flex-col gap-1 items-end">
            <Badge className="bg-background/90 text-foreground backdrop-blur-sm font-semibold">
              ${rent}{rentLabel}
            </Badge>
            {rentType !== "entire_unit" && (
              <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs">
                {rentType === "per_bed" ? "Per Bed" : "Per Person"}
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <CardContent className="p-4">
        {/* Title - links to listing detail */}
        <Link href={`/apartments/${_id}`}>
          <div className="mb-3">
            <h3 className="font-semibold line-clamp-1 hover:text-primary transition-colors">{title}</h3>
          </div>
        </Link>

        {/* Provider - links to provider page */}
        {provider?._id && (
          <Link
            href={`/apartments/provider/${provider._id}`}
            className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <span>{provider?.companyName || provider?.user?.name || "Unknown"}</span>
            {provider?.verified && <VerifiedBadge showText={false} type="business" className="h-4" />}
          </Link>
        )}
        {!provider?._id && (
          <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{provider?.companyName || "Unknown"}</span>
          </div>
        )}

        {/* Location */}
        <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{address}, {city}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Bed className="h-4 w-4 text-muted-foreground" />
            <span>{bedrooms === 0 ? "Studio" : `${bedrooms} BR`}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="h-4 w-4 text-muted-foreground" />
            <span>{bathrooms} BA</span>
          </div>
        </div>

        {/* College badges */}
        {colleges && colleges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {colleges.filter((college): college is NonNullable<typeof college> => college !== null).map((college) => (
              <div
                key={college._id}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                <GraduationCap className="h-3 w-3 shrink-0" />
                {college.shortName}
              </div>
            ))}
          </div>
        )}

        {/* Available */}
        {availableFrom && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            Available {new Date(availableFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
