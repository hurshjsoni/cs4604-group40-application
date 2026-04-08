"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Plus, X, Check, Save, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AMENITIES_LIST } from "@/lib/constants";
import type { Id } from "@/convex/_generated/dataModel";
import type { RentType, PetPolicy, UtilitiesPolicy, ParkingPolicy, College } from "@/lib/types";

export interface ListingFormData {
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  rent: string;
  rentType: RentType;
  securityDeposit: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  availableFrom: string;
  leaseLength: string;
  petPolicy: PetPolicy;
  utilities: UtilitiesPolicy;
  parking: ParkingPolicy;
  notes: string;
}

export const DEFAULT_LISTING_FORM: ListingFormData = {
  title: "",
  description: "",
  address: "",
  city: "",
  state: "VA",
  zipCode: "",
  rent: "",
  rentType: "entire_unit",
  securityDeposit: "",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  availableFrom: "",
  leaseLength: "12",
  petPolicy: "not_allowed",
  utilities: "not_included",
  parking: "available",
  notes: "",
};

/** An image that already exists in the database (edit mode) */
export interface ExistingImageRecord {
  _id: string;
  url: string;
}

interface ListingFormProps {
  initialData?: ListingFormData;
  initialAmenities?: string[];
  initialColleges?: string[];
  initialLinks?: { label: string; url: string }[];
  /** Existing images already saved in DB (for edit mode) */
  initialImageRecords?: ExistingImageRecord[];
  submitLabel: string;
  successLabel: string;
  onSubmit: (data: {
    listing: ListingFormData;
    amenities: string[];
    collegeIds: string[];
    /** Storage IDs of newly uploaded images – call api.listingImages.saveImage for each */
    newStorageIds: string[];
    /** IDs of existing image records to delete – call api.listingImages.removeImage for each */
    removedImageIds: string[];
    links: { label: string; url: string }[];
  }) => Promise<void>;
}

export function ListingForm({
  initialData,
  initialAmenities = [],
  initialColleges = [],
  initialLinks = [],
  initialImageRecords = [],
  submitLabel,
  successLabel,
  onSubmit,
}: ListingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colleges = useQuery(api.colleges.list) ?? [];
  const collegeOptions = colleges as College[];
  const generateUploadUrl = useMutation(api.listingImages.generateUploadUrl);

  const [listing, setListing] = useState<ListingFormData>(initialData || DEFAULT_LISTING_FORM);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialAmenities);
  const [newAmenity, setNewAmenity] = useState("");
  const [selectedColleges, setSelectedColleges] = useState<string[]>(initialColleges);

  // Existing DB images (edit mode) - user can remove them
  const [existingImages, setExistingImages] = useState<ExistingImageRecord[]>(initialImageRecords);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);

  // Newly uploaded files - store preview URL + storageId
  const [newUploads, setNewUploads] = useState<{ previewUrl: string; storageId: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const activeObjectUrlsRef = useRef<Set<string>>(new Set());

  const [propertyLinks, setPropertyLinks] = useState<{ label: string; url: string }[]>(initialLinks);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const update = (field: keyof ListingFormData, value: string) =>
    setListing((prev) => ({ ...prev, [field]: value }));

  const addAmenity = (amenity: string) => {
    const trimmed = amenity.trim();
    if (trimmed && !selectedAmenities.includes(trimmed)) {
      setSelectedAmenities((prev) => [...prev, trimmed]);
    }
  };

  const handleAddCustomAmenity = () => {
    if (newAmenity.trim()) {
      addAmenity(newAmenity.trim());
      setNewAmenity("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed");
        const { storageId } = (await result.json()) as { storageId?: Id<"_storage"> };
        if (!storageId) throw new Error("Upload response missing storage id");
        const previewUrl = URL.createObjectURL(file);
        activeObjectUrlsRef.current.add(previewUrl);
        setNewUploads((prev) => [...prev, { previewUrl, storageId }]);
      }
      toast.success("Photo uploaded!");
    } catch (err) {
      console.error("Image upload failed:", err);
      toast.error("Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeNewUpload = (index: number) => {
    setNewUploads((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        activeObjectUrlsRef.current.delete(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  useEffect(() => {
    const activeUrls = activeObjectUrlsRef.current;
    return () => {
      for (const url of activeUrls) {
        URL.revokeObjectURL(url);
      }
      activeUrls.clear();
    };
  }, []);

  const removeExistingImage = (imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img._id !== imageId));
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const addLink = () => {
    if (newLinkLabel.trim() && newLinkUrl.trim()) {
      setPropertyLinks((prev) => [...prev, { label: newLinkLabel.trim(), url: newLinkUrl.trim() }]);
      setNewLinkLabel("");
      setNewLinkUrl("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        listing,
        amenities: selectedAmenities,
        collegeIds: selectedColleges,
        newStorageIds: newUploads.map((u) => u.storageId),
        removedImageIds,
        links: propertyLinks,
      });
      setIsSaved(true);
    } catch (err) {
      console.error("Submit failed:", err);
      toast.error("Failed to save listing. Please try again.");
      setIsSubmitting(false);
    }
  };

  const previewImage = existingImages[0]?.url ?? newUploads[0]?.previewUrl;

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
              <CardDescription>Upload property photos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <ImagePlus className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload photos"}</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB each</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Existing images (edit mode) */}
              {existingImages.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Saved Photos</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {existingImages.map((img) => (
                      <div key={img._id} className="group relative">
                        <div
                          className="aspect-video rounded-lg border border-border bg-cover bg-center"
                          style={{ backgroundImage: `url(${img.url})` }}
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(img._id)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New uploads */}
              {newUploads.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">New Photos</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {newUploads.map((upload, index) => (
                      <div key={index} className="group relative">
                        <div
                          className="aspect-video rounded-lg border border-border bg-cover bg-center"
                          style={{ backgroundImage: `url(${upload.previewUrl})` }}
                        />
                        <button
                          type="button"
                          onClick={() => removeNewUpload(index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
              <CardDescription>Main details about the property</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="form-group">
                <Label>Title *</Label>
                <input value={listing.title} onChange={(e) => update("title", e.target.value)} placeholder="Enter listing title" className="form-input" required />
              </div>
              <div className="form-group">
                <Label>Description *</Label>
                <textarea value={listing.description} onChange={(e) => update("description", e.target.value)} placeholder="Enter property description" className="form-textarea" required />
              </div>
              <div className="form-group">
                <Label>Near Colleges</Label>
                <div className="flex flex-wrap gap-2">
                  {collegeOptions.map((college) => (
                    <button
                      key={college._id}
                      type="button"
                      onClick={() =>
                        setSelectedColleges((prev) =>
                          prev.includes(college._id) ? prev.filter((id) => id !== college._id) : [...prev, college._id],
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                        selectedColleges.includes(college._id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {college.shortName}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
              <CardDescription>Property address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="form-group">
                <Label>Street Address *</Label>
                <input value={listing.address} onChange={(e) => update("address", e.target.value)} placeholder="Enter street address" className="form-input" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="form-group">
                  <Label>City *</Label>
                  <input value={listing.city} onChange={(e) => update("city", e.target.value)} placeholder="Enter city" className="form-input" required />
                </div>
                <div className="form-group">
                  <Label>State</Label>
                  <select value={listing.state} onChange={(e) => update("state", e.target.value)} className="form-select">
                    <option value="VA">Virginia</option>
                  </select>
                </div>
                <div className="form-group">
                  <Label>ZIP Code *</Label>
                  <input value={listing.zipCode} onChange={(e) => update("zipCode", e.target.value)} placeholder="Enter ZIP" className="form-input" required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property Details</CardTitle>
              <CardDescription>Size and specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="form-group">
                  <Label>Bedrooms *</Label>
                  <input type="number" min="0" step="1" value={listing.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} placeholder="0 for studio" className="form-input" required />
                </div>
                <div className="form-group">
                  <Label>Bathrooms *</Label>
                  <input type="number" min="0.5" step="0.5" value={listing.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} placeholder="Enter bathrooms" className="form-input" required />
                </div>
                <div className="form-group">
                  <Label>Square Feet</Label>
                  <input type="number" value={listing.squareFeet} onChange={(e) => update("squareFeet", e.target.value)} placeholder="Enter sq ft" className="form-input" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing & Availability</CardTitle>
              <CardDescription>Rent and lease terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="form-group">
                  <Label>Monthly Rent ($) *</Label>
                  <input type="number" value={listing.rent} onChange={(e) => update("rent", e.target.value)} placeholder="Enter amount" className="form-input" required />
                </div>
                <div className="form-group">
                  <Label>Rent Type *</Label>
                  <select value={listing.rentType} onChange={(e) => update("rentType", e.target.value)} className="form-select">
                    <option value="entire_unit">Entire Unit</option>
                    <option value="per_bed">Per Bed</option>
                    <option value="per_person">Per Person</option>
                  </select>
                </div>
                <div className="form-group">
                  <Label>Security Deposit ($)</Label>
                  <input type="number" value={listing.securityDeposit} onChange={(e) => update("securityDeposit", e.target.value)} placeholder="Enter amount" className="form-input" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-group">
                  <Label>Available From *</Label>
                  <input type="date" value={listing.availableFrom} onChange={(e) => update("availableFrom", e.target.value)} className="form-input" required />
                </div>
                <div className="form-group">
                  <Label>Lease Length (months)</Label>
                  <select value={listing.leaseLength} onChange={(e) => update("leaseLength", e.target.value)} className="form-select">
                    <option value="6">6 months</option>
                    <option value="9">9 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Policies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policies</CardTitle>
              <CardDescription>What&apos;s included</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="form-group">
                  <Label>Pet Policy</Label>
                  <select value={listing.petPolicy} onChange={(e) => update("petPolicy", e.target.value)} className="form-select">
                    <option value="allowed">Allowed</option>
                    <option value="case_by_case">Case by Case</option>
                    <option value="not_allowed">Not Allowed</option>
                  </select>
                </div>
                <div className="form-group">
                  <Label>Utilities</Label>
                  <select value={listing.utilities} onChange={(e) => update("utilities", e.target.value)} className="form-select">
                    <option value="included">Included</option>
                    <option value="partial">Partial</option>
                    <option value="not_included">Not Included</option>
                  </select>
                </div>
                <div className="form-group">
                  <Label>Parking</Label>
                  <select value={listing.parking} onChange={(e) => update("parking", e.target.value)} className="form-select">
                    <option value="included">Included</option>
                    <option value="available">Available</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Amenities</CardTitle>
              <CardDescription>Click to add common amenities or add your own</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Quick Add</Label>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES_LIST.map((amenity) => (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => addAmenity(amenity)}
                      disabled={selectedAmenities.includes(amenity)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                        selectedAmenities.includes(amenity)
                          ? "cursor-not-allowed bg-muted text-muted-foreground opacity-50"
                          : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group border-t border-border pt-4">
                <Label>Add Custom Amenity</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomAmenity())}
                    placeholder="Enter amenity name"
                    className="form-input flex-1"
                  />
                  <Button type="button" variant="outline" size="default" onClick={handleAddCustomAmenity}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {selectedAmenities.length > 0 && (
                <div className="border-t border-border pt-4">
                  <Label className="mb-2 block">Selected ({selectedAmenities.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedAmenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary" className="gap-1 bg-primary/10 px-3 py-1.5 text-primary">
                        {amenity}
                        <button
                          type="button"
                          onClick={() => setSelectedAmenities((prev) => prev.filter((a) => a !== amenity))}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Property Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property Links</CardTitle>
              <CardDescription>Add links to virtual tours, floor plans, etc.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Label (e.g. Virtual Tour)" className="form-input flex-1" />
                <input type="url" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="URL" className="form-input flex-1" />
                <Button type="button" variant="outline" size="default" onClick={addLink}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {propertyLinks.length > 0 && (
                <div className="space-y-2">
                  {propertyLinks.map((link, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">{link.label}</p>
                        <p className="max-w-xs truncate text-xs text-muted-foreground">{link.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPropertyLinks((prev) => prev.filter((_, i) => i !== index))}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Notes</CardTitle>
              <CardDescription>Any extra information for potential tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="form-group">
                <textarea value={listing.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Enter any additional notes" className="form-textarea" rows={4} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {previewImage ? (
                <div className="mb-3 aspect-video rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${previewImage})` }} />
              ) : (
                <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <h3 className="font-semibold">{listing.title || "Listing Title"}</h3>
              <p className="text-sm text-muted-foreground">{listing.rent ? `$${listing.rent}/mo` : "$---/mo"}</p>
              <p className="text-xs text-muted-foreground">{listing.city || "City"}, {listing.state}</p>
              {selectedAmenities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedAmenities.slice(0, 3).map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                  ))}
                  {selectedAmenities.length > 3 && (
                    <Badge variant="secondary" className="text-[10px]">+{selectedAmenities.length - 3}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isSubmitting || isSaved}>
            {isSaved ? (
              <>
                <Check className="h-5 w-5" />
                {successLabel}
              </>
            ) : isSubmitting ? (
              "Saving…"
            ) : (
              <>
                <Save className="h-5 w-5" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
