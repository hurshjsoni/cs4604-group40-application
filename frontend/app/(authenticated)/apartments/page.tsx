"use client";

import { useState, useMemo } from "react";
import { Search, Building2, SlidersHorizontal, MapPin, X, Loader2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ListingCard } from "../../components/ListingCard";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ApartmentListing, College } from "@/lib/types";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";

type SortOption = "newest" | "oldest" | "price_low" | "price_high" | "beds_low" | "beds_high";

export default function ApartmentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Filter states
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rentType, setRentType] = useState("");
  const [petPolicy, setPetPolicy] = useState("");
  const [utilities, setUtilities] = useState("");
  const [parking, setParking] = useState("");
  const [availableBy, setAvailableBy] = useState("");
  const [amenitySearch, setAmenitySearch] = useState("");
  const [filterCollegeId, setFilterCollegeId] = useState("");

  // Colleges for the filter dropdown
  const colleges = (useQuery(api.colleges.list) ?? []) as College[];

  // Paginated listing feed for scalable browse UX.
  const {
    results: paginatedListings,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(api.apartmentListings.listPaginated, {
    isActive: true,
    collegeId: filterCollegeId ? (filterCollegeId as Id<"colleges">) : undefined,
  }, { initialNumItems: 24 });
  const allListings = paginatedListings as ApartmentListing[];
  const loading = paginatedListings === undefined;

  const clearFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setBedrooms("");
    setBathrooms("");
    setRentType("");
    setPetPolicy("");
    setUtilities("");
    setParking("");
    setAvailableBy("");
    setAmenitySearch("");
    setFilterCollegeId("");
  };

  const hasActiveFilters = !!(
    priceMin || priceMax || bedrooms || bathrooms || rentType ||
    petPolicy || utilities || parking || availableBy || amenitySearch || filterCollegeId
  );

  const filteredAndSortedListings = useMemo((): ApartmentListing[] => {
    if (!allListings) return [];

    const filtered = (allListings as ApartmentListing[]).filter((listing) => {
      if (!listing) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          listing.title?.toLowerCase().includes(q) ||
          listing.address?.toLowerCase().includes(q) ||
          listing.city?.toLowerCase().includes(q) ||
          listing.description?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (priceMin && listing.rent < parseInt(priceMin)) return false;
      if (priceMax && listing.rent > parseInt(priceMax)) return false;

      if (bedrooms) {
        if (bedrooms === "3+" && listing.bedrooms < 3) return false;
        if (bedrooms !== "3+" && listing.bedrooms !== parseInt(bedrooms)) return false;
      }

      if (bathrooms) {
        if (bathrooms === "2+" && listing.bathrooms < 2) return false;
        if (bathrooms !== "2+" && listing.bathrooms !== parseFloat(bathrooms)) return false;
      }

      if (rentType && listing.rentType !== rentType) return false;
      if (petPolicy && listing.petPolicy !== petPolicy) return false;
      if (utilities && listing.utilities !== utilities) return false;
      if (parking && listing.parking !== parking) return false;

      if (availableBy) {
        const listingDate = new Date(listing.availableFrom);
        const filterDate = new Date(availableBy);
        if (listingDate > filterDate) return false;
      }

      if (amenitySearch) {
        const q = amenitySearch.toLowerCase();
        if (!listing.amenities?.some((a) => a.toLowerCase().includes(q))) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest": return (b._creationTime ?? 0) - (a._creationTime ?? 0);
        case "oldest": return (a._creationTime ?? 0) - (b._creationTime ?? 0);
        case "price_low": return a.rent - b.rent;
        case "price_high": return b.rent - a.rent;
        case "beds_low": return a.bedrooms - b.bedrooms;
        case "beds_high": return b.bedrooms - a.bedrooms;
        default: return 0;
      }
    });
  }, [allListings, searchQuery, priceMin, priceMax, bedrooms, bathrooms, rentType, petPolicy, utilities, parking, availableBy, amenitySearch, sortBy]);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={Building2}
        title="Browse Apartments"
        subtitle={loading ? "Loading…" : `${allListings?.length ?? 0} apartments available`}
        color="blue"
      />

      {/* Search & Filters */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, address, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="lg"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge className="ml-1 h-5 w-5 border border-primary-foreground/30 bg-primary-foreground text-primary p-0 flex items-center justify-center text-xs">
              {[priceMin, priceMax, bedrooms, bathrooms, rentType, petPolicy, utilities, parking, availableBy, amenitySearch, filterCollegeId].filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="form-group">
                <label className="form-label flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" />
                  College
                </label>
                <select
                  value={filterCollegeId}
                  onChange={(e) => setFilterCollegeId(e.target.value)}
                  className="form-select"
                >
                  <option value="">All Colleges</option>
                  {colleges.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price Range</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="form-input" />
                  <input type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Rent Type</label>
                <select value={rentType} onChange={(e) => setRentType(e.target.value)} className="form-select">
                  <option value="">Any</option>
                  <option value="entire_unit">Entire Unit</option>
                  <option value="per_bed">Per Bed</option>
                  <option value="per_person">Per Person</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bedrooms</label>
                <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="form-select">
                  <option value="">Any</option>
                  <option value="0">Studio</option>
                  <option value="1">1 BR</option>
                  <option value="2">2 BR</option>
                  <option value="3+">3+ BR</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bathrooms</label>
                <select value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="form-select">
                  <option value="">Any</option>
                  <option value="1">1 BA</option>
                  <option value="1.5">1.5 BA</option>
                  <option value="2+">2+ BA</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Available By</label>
                <input type="date" value={availableBy} onChange={(e) => setAvailableBy(e.target.value)} className="form-input" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border pt-4">
              <div className="form-group">
                <label className="form-label">Pet Policy</label>
                <select value={petPolicy} onChange={(e) => setPetPolicy(e.target.value)} className="form-select">
                  <option value="">Any</option>
                  <option value="allowed">Pets Allowed</option>
                  <option value="case_by_case">Case by Case</option>
                  <option value="not_allowed">No Pets</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Utilities</label>
                <select value={utilities} onChange={(e) => setUtilities(e.target.value)} className="form-select">
                  <option value="">Any</option>
                  <option value="included">Included</option>
                  <option value="partial">Partial</option>
                  <option value="not_included">Not Included</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Parking</label>
                <select value={parking} onChange={(e) => setParking(e.target.value)} className="form-select">
                  <option value="">Any</option>
                  <option value="included">Included</option>
                  <option value="available">Available</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amenity Search</label>
                <input
                  type="text"
                  placeholder="Search amenities..."
                  value={amenitySearch}
                  onChange={(e) => setAmenitySearch(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="border-t border-border pt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-muted-foreground">
                  <X className="h-4 w-4" />
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `Showing ${filteredAndSortedListings.length} loaded listings`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="form-select w-auto"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="beds_low">Bedrooms: Low to High</option>
            <option value="beds_high">Bedrooms: High to Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAndSortedListings.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAndSortedListings.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
          {paginationStatus === "CanLoadMore" && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => loadMore(24)}>
                Load More
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={MapPin}
          title="No listings found"
          description={hasActiveFilters ? "Try adjusting your search or filters" : "No apartments have been listed yet"}
          action={hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>Clear all filters</Button>
          ) : undefined}
        />
      )}
    </div>
  );
}
