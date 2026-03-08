"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  Flag,
  MapPin,
  Bed,
  Bath,
  Square,
  Calendar,
  PawPrint,
  Zap,
  Car,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VerifiedBadge } from "../../../components/VerifiedBadge";
import { ContactInfoDisplay } from "../../../components/ContactInfoDisplay";
import { ReportModal } from "../../../components/ReportModal";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function ApartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isTogglingSave, setIsTogglingSave] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);

  const listing = useQuery(api.apartmentListings.getById, { listingId: id as Id<"apartmentListings"> });
  const savedStatus = useQuery(
    api.savedListings.isSaved,
    user?.role === "student" ? { listingId: id as Id<"apartmentListings"> } : "skip",
  );
  const toggleSave = useMutation(api.savedListings.toggle);
  const giveConsent = useMutation(api.savedListings.giveConsent);

  const isSaved = savedStatus ?? false;

  const handleToggleSave = async () => {
    if (isTogglingSave) return;
    setIsTogglingSave(true);
    try {
      const result = await toggleSave({ listingId: id as Id<"apartmentListings"> });
      if (result?.saved) {
        toast.success("Apartment saved!");
        setShowConsentModal(true);
      } else {
        toast.success("Removed from saved.");
      }
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save apartment.");
    } finally {
      setIsTogglingSave(false);
    }
  };

  const handleConsent = async (agree: boolean) => {
    if (!agree) {
      setShowConsentModal(false);
      return;
    }
    if (isSubmittingConsent) return;
    setIsSubmittingConsent(true);
    try {
      await giveConsent({ listingId: id as Id<"apartmentListings"> });
      toast.success("Your contact info has been shared with the provider.");
      setShowConsentModal(false);
    } catch (err) {
      console.error("Consent failed:", err);
      toast.error("Failed to share contact info.");
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  if (listing === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (listing === null) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
        <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-bold">Listing Not Found</h2>
        <p className="mb-4 text-muted-foreground">This listing may have been removed</p>
        <Button size="lg" onClick={() => router.push("/apartments")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Browse Apartments
        </Button>
      </div>
    );
  }

  const {
    title,
    description,
    address,
    city,
    state,
    zipCode,
    rent,
    rentType,
    securityDeposit,
    bedrooms,
    bathrooms,
    squareFeet,
    availableFrom,
    leaseLength,
    amenities,
    images,
    petPolicy,
    utilities,
    parking,
    provider,
    contacts,
  } = listing;

  const rentTypeLabels: Record<string, string> = {
    entire_unit: "Entire Unit",
    per_bed: "Per Bed",
    per_person: "Per Person",
  };

  const handlePrevImage = () => {
    setCurrentImage((prev) => (prev === 0 ? (images?.length ?? 1) - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImage((prev) => (prev === (images?.length ?? 1) - 1 ? 0 : prev + 1));
  };

  const imageList: string[] = images ?? [];
  const providerDisplayName = provider?.companyName || provider?.user?.name || "Unknown Provider";

  return (
    <div className="p-4 lg:p-6">
      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-lg font-semibold">Share Your Info?</h3>
              <button
                onClick={() => setShowConsentModal(false)}
                className="rounded-lg p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="mb-1 text-sm text-muted-foreground">
                Would you like to share your contact information with{" "}
                <strong>{provider?.companyName || "this provider"}</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                They can use it to reach out to you directly about this listing.
              </p>
            </div>
            <div className="flex gap-3 border-t border-border p-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleConsent(false)}
                disabled={isSubmittingConsent}
              >
                No thanks
              </Button>
              <Button className="flex-1" onClick={() => handleConsent(true)} disabled={isSubmittingConsent}>
                {isSubmittingConsent ? "Sharing..." : "Yes, share my info"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to listings
        </button>
        <div className="flex items-center gap-2">
          {user?.role === "student" && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleToggleSave}
              disabled={isTogglingSave}
              className="gap-2"
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
              {isTogglingSave ? "Saving..." : isSaved ? "Saved" : "Save"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowReport(true)}
            title="Report listing"
            className="text-muted-foreground hover:text-destructive"
          >
            <Flag className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showReport && (
        <ReportModal
          targetType="listing"
          targetId={id}
          targetName={listing?.title}
          onClose={() => setShowReport(false)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Image Gallery */}
          {imageList.length > 0 ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
              <img
                src={imageList[currentImage]}
                alt={`${title} - Image ${currentImage + 1}`}
                className="h-full w-full object-cover"
              />
              {imageList.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {imageList.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        className={`h-2 w-2 rounded-full transition-all ${
                          idx === currentImage ? "w-6 bg-white" : "bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Title & Location */}
          <div>
            <h1 className="mb-2 text-2xl font-bold lg:text-3xl">{title}</h1>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-5 w-5" />
              <span>
                {address}, {city}, {state} {zipCode}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={Bed} label="Bedrooms" value={bedrooms === 0 ? "Studio" : bedrooms} />
            <StatCard icon={Bath} label="Bathrooms" value={bathrooms} />
            {squareFeet && <StatCard icon={Square} label="Sq Ft" value={squareFeet.toLocaleString()} />}
            {leaseLength && <StatCard icon={Calendar} label="Lease" value={`${leaseLength} mo`} />}
          </div>

          {/* Description */}
          {description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About This Property</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          )}

          {/* Amenities */}
          {(amenities?.length > 0 || petPolicy || utilities || parking) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Amenities & Policies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {amenities?.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {amenities.map((amenity: string) => (
                      <div key={amenity} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        {amenity}
                      </div>
                    ))}
                  </div>
                )}
                {(petPolicy || utilities || parking) && (
                  <>
                    <Separator />
                    <div className="grid gap-3 sm:grid-cols-3">
                      {petPolicy && (
                        <PolicyItem
                          icon={PawPrint}
                          label="Pets"
                          value={
                            petPolicy === "allowed"
                              ? "Allowed"
                              : petPolicy === "case_by_case"
                                ? "Case by Case"
                                : "Not Allowed"
                          }
                        />
                      )}
                      {utilities && (
                        <PolicyItem
                          icon={Zap}
                          label="Utilities"
                          value={
                            utilities === "included"
                              ? "Included"
                              : utilities === "partial"
                                ? "Partial"
                                : "Not Included"
                          }
                        />
                      )}
                      {parking && (
                        <PolicyItem
                          icon={Car}
                          label="Parking"
                          value={
                            parking === "included"
                              ? "Included"
                              : parking === "available"
                                ? "Available"
                                : "None"
                          }
                        />
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Pricing Card */}
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <div className="mb-4 text-center">
                <p className="text-4xl font-bold">${rent}</p>
                <p className="text-muted-foreground">
                  {rentType === "entire_unit"
                    ? "/month"
                    : rentType === "per_bed"
                      ? "/bed/month"
                      : "/person/month"}
                </p>
                {rentType && rentType !== "entire_unit" && (
                  <Badge variant="secondary" className="mt-2">
                    {rentTypeLabels[rentType]}
                  </Badge>
                )}
              </div>
              <div className="mb-4 space-y-2 text-sm">
                {securityDeposit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Security Deposit</span>
                    <span className="font-medium">${securityDeposit}</span>
                  </div>
                )}
                {availableFrom && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-medium">
                      {new Date(availableFrom).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => setShowContactInfo(!showContactInfo)}
              >
                {showContactInfo ? "Hide Contact Info" : "View Contact Info"}
              </Button>
            </CardContent>
          </Card>

          {/* Provider Card */}
          {provider && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Listed By</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/apartments/provider/${provider._id}`} className="group mb-4 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {providerDisplayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium group-hover:text-primary transition-colors">
                        {providerDisplayName}
                      </span>
                      <VerifiedBadge showText={false} type="business" />
                    </div>
                    <p className="text-xs text-muted-foreground">View all listings →</p>
                  </div>
                </Link>

                {showContactInfo && contacts && contacts.length > 0 && (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <h4 className="text-sm font-medium">Contact Information</h4>
                    <ContactInfoDisplay contacts={contacts} />
                  </div>
                )}

                {showContactInfo && (!contacts || contacts.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No contact information available for this listing.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PolicyItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
